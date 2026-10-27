import crypto from "node:crypto";
import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import { createNotification } from "../services/notifications.js";
import Payment from "../models/Payment.js";
import { getRazorpayClient, verifyPaymentSignature, verifyWebhookSignature } from "../services/razorpay.js";

function requestBody(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function paymentResult(payment) {
  return {
    id: payment.id,
    status: payment.status,
    amountPaise: payment.amountPaise,
    currency: payment.currency,
    paidAt: payment.paidAt,
  };
}

async function settleCapturedPayment(orderId, paymentId) {
  const session = await mongoose.startSession();
  let outcome;

  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({ gatewayOrderId: orderId }).session(session);
      if (!payment) {
        outcome = { kind: "not_found" };
        return;
      }

      if (
        payment.gatewayPaymentId === paymentId &&
        ["verified", "reconciliation_required"].includes(payment.status)
      ) {
        outcome = { kind: payment.status, payment };
        return;
      }

      const priorPayment = await Payment.findOne({
        gatewayPaymentId: paymentId,
        _id: { $ne: payment._id },
      }).session(session);
      if (priorPayment) {
        outcome = { kind: "payment_conflict" };
        return;
      }

      const bill = await Bill.findById(payment.bill).session(session);
      if (!bill) {
        throw new Error("Payment references a bill that no longer exists.");
      }

      payment.gatewayPaymentId = paymentId;
      payment.paidAt = new Date();

      if (bill.status === "unpaid") {
        bill.status = "paid";
        await bill.save({ session });
        payment.status = "verified";
        await payment.save({ session });
        await createNotification(
          {
            recipient: payment.resident,
            type: "payment_verified",
            title: "Payment confirmed",
            message: `Your payment of INR ${(payment.amountPaise / 100).toFixed(2)} for bill ${bill.billNumber} is confirmed.`,
            link: "#bills-heading",
            eventKey: `payment-verified:${payment._id}`,
          },
          session,
        );
        outcome = { kind: "verified", payment };
        return;
      }

      payment.status = "reconciliation_required";
      await payment.save({ session });
      outcome = { kind: "reconciliation_required", payment };
    });
  } finally {
    await session.endSession();
  }

  return outcome;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

export async function createPaymentOrder(request, response) {
  const body = requestBody(request.body);
  const billId = typeof body.billId === "string" ? body.billId : "";

  if (!mongoose.isValidObjectId(billId)) {
    return response.status(400).json({ message: "A valid bill ID is required." });
  }

  const bill = await Bill.findOne({ _id: billId, flat: request.user.flat?._id || request.user.flat });
  if (!bill) {
    return response.status(404).json({ message: "Bill not found for your flat." });
  }
  if (bill.status !== "unpaid") {
    return response.status(409).json({ message: "This bill is already paid or cannot be paid." });
  }

  const gateway = getRazorpayClient();
  if (!gateway) {
    return response.status(503).json({
      message: "Razorpay test credentials are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env.",
    });
  }

  const receipt = `FF-${crypto.randomUUID().replaceAll("-", "")}`;
  let order;
  try {
    order = await gateway.orders.create({
      amount: bill.amountPaise,
      currency: "INR",
      receipt,
      notes: {
        billId: bill.id,
        residentId: request.user.id,
      },
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error.message);
    return response.status(502).json({ message: "The payment provider could not create an order. Please try again." });
  }

  if (order.amount !== bill.amountPaise || order.currency !== "INR" || typeof order.id !== "string") {
    console.error("Razorpay returned an order that did not match the stored bill amount or currency.");
    return response.status(502).json({ message: "The payment provider returned an invalid order. Please contact the society admin." });
  }

  const payment = await Payment.create({
    bill: bill._id,
    resident: request.user._id,
    amountPaise: bill.amountPaise,
    currency: "INR",
    gatewayOrderId: order.id,
    status: "pending",
  });

  return response.status(201).json({
    paymentId: payment.id,
    orderId: order.id,
    amountPaise: bill.amountPaise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID,
    billNumber: bill.billNumber,
  });
}

export async function verifyPayment(request, response) {
  const body = requestBody(request.body);
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const gatewayPaymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";

  if (
    orderId.length > 100 ||
    gatewayPaymentId.length > 100 ||
    !verifyPaymentSignature(orderId, gatewayPaymentId, signature, process.env.RAZORPAY_KEY_SECRET)
  ) {
    return response.status(400).json({ message: "The payment signature is invalid." });
  }

  const payment = await Payment.findOne({
    gatewayOrderId: orderId,
    resident: request.user._id,
  });
  if (!payment) {
    return response.status(404).json({ message: "Payment order not found for your account." });
  }

  const gateway = getRazorpayClient();
  if (!gateway) {
    return response.status(503).json({ message: "Razorpay is not configured on the server." });
  }

  let capturedPayment;
  try {
    capturedPayment = await gateway.payments.fetch(gatewayPaymentId);
  } catch (error) {
    console.error("Razorpay payment lookup failed:", error.message);
    return response.status(502).json({ message: "Payment confirmation could not be retrieved. Please retry verification." });
  }

  if (
    capturedPayment.order_id !== orderId ||
    capturedPayment.amount !== payment.amountPaise ||
    capturedPayment.currency !== payment.currency ||
    capturedPayment.status !== "captured" ||
    capturedPayment.captured !== true
  ) {
    return response.status(409).json({
      message: "The gateway has not confirmed a captured payment for this bill. The bill remains unpaid.",
    });
  }

  const result = await settleCapturedPayment(orderId, gatewayPaymentId);
  if (result.kind === "not_found") {
    return response.status(404).json({ message: "Payment order not found." });
  }
  if (result.kind === "payment_conflict") {
    return response.status(409).json({ message: "This gateway payment is already associated with another order." });
  }
  if (result.kind === "reconciliation_required") {
    return response.status(202).json({
      payment: paymentResult(result.payment),
      message: "Payment was captured, but this bill was already paid. The society admin must reconcile this payment.",
    });
  }

  return response.status(200).json({
    payment: paymentResult(result.payment),
    message: "Payment verified and bill marked paid.",
  });
}

export async function handleRazorpayWebhook(request, response) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return response.status(503).json({ message: "The Razorpay webhook secret is not configured." });
  }

  const signature = request.get("x-razorpay-signature");
  if (!verifyWebhookSignature(request.body, signature, webhookSecret)) {
    return response.status(400).json({ message: "The webhook signature is invalid." });
  }

  let event;
  try {
    event = JSON.parse(request.body.toString("utf8"));
  } catch {
    return response.status(400).json({ message: "The webhook body is invalid." });
  }

  if (event.event === "payment.failed") {
    const failedPayment = event.payload?.payment?.entity;
    if (
      !failedPayment ||
      typeof failedPayment.order_id !== "string" ||
      typeof failedPayment.id !== "string" ||
      !Number.isSafeInteger(failedPayment.amount) ||
      failedPayment.currency !== "INR" ||
      failedPayment.status !== "failed"
    ) {
      return response.status(400).json({ message: "The failed payment event is incomplete or invalid." });
    }

    const payment = await Payment.findOne({ gatewayOrderId: failedPayment.order_id });
    if (!payment) {
      return response.status(404).json({ message: "Payment order is not registered." });
    }
    if (payment.amountPaise !== failedPayment.amount || payment.currency !== failedPayment.currency) {
      return response.status(400).json({ message: "Gateway payment amount does not match the stored order." });
    }

    if (payment.status === "pending") {
      await Payment.updateOne(
        { _id: payment._id, status: "pending" },
        {
          $set: {
            status: "failed",
            gatewayPaymentId: failedPayment.id,
            failure: {
              gatewayPaymentId: failedPayment.id,
              code: typeof failedPayment.error_code === "string" ? failedPayment.error_code.slice(0, 100) : undefined,
              description:
                typeof failedPayment.error_description === "string"
                  ? failedPayment.error_description.slice(0, 500)
                  : undefined,
              source:
                typeof failedPayment.error_source === "string" ? failedPayment.error_source.slice(0, 100) : undefined,
              step: typeof failedPayment.error_step === "string" ? failedPayment.error_step.slice(0, 100) : undefined,
              failedAt: new Date(),
            },
          },
        },
      );
    }

    const updatedPayment = await Payment.findById(payment._id);
    return response.status(200).json({ received: true, processed: true, status: updatedPayment.status });
  }

  if (event.event !== "payment.captured") {
    return response.status(200).json({ received: true, processed: false });
  }

  const capturedPayment = event.payload?.payment?.entity;
  if (
    !capturedPayment ||
    typeof capturedPayment.order_id !== "string" ||
    typeof capturedPayment.id !== "string" ||
    !Number.isSafeInteger(capturedPayment.amount) ||
    capturedPayment.currency !== "INR" ||
    capturedPayment.status !== "captured" ||
    capturedPayment.captured !== true
  ) {
    return response.status(400).json({ message: "The captured payment event is incomplete or invalid." });
  }

  const payment = await Payment.findOne({ gatewayOrderId: capturedPayment.order_id });
  if (!payment) {
    return response.status(404).json({ message: "Payment order is not registered." });
  }
  if (payment.amountPaise !== capturedPayment.amount || payment.currency !== capturedPayment.currency) {
    return response.status(400).json({ message: "Gateway payment amount does not match the stored order." });
  }

  const result = await settleCapturedPayment(capturedPayment.order_id, capturedPayment.id);
  if (result.kind === "not_found") {
    return response.status(404).json({ message: "Payment order is not registered." });
  }
  if (result.kind === "payment_conflict") {
    return response.status(409).json({ message: "Gateway payment is already associated with another order." });
  }

  return response.status(200).json({
    received: true,
    processed: true,
    status: result.kind,
  });
}

export async function listResidentPayments(request, response) {
  const payments = await Payment.find({ resident: request.user._id })
    .populate("bill", "billNumber billingPeriod dueDate")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return response.status(200).json({
    payments: payments.map((payment) => ({
      id: payment._id,
      status: payment.status,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      failure: payment.failure
        ? {
            gatewayPaymentId: payment.failure.gatewayPaymentId,
            code: payment.failure.code,
            description: payment.failure.description,
            failedAt: payment.failure.failedAt,
          }
        : null,
      bill: payment.bill
        ? {
            id: payment.bill._id,
            billNumber: payment.bill.billNumber,
            billingPeriod: payment.bill.billingPeriod,
            dueDate: payment.bill.dueDate.toISOString().slice(0, 10),
          }
        : null,
    })),
  });
}

export async function getResidentReceipt(request, response) {
  if (!mongoose.isValidObjectId(request.params.paymentId)) {
    return response.status(400).json({ message: "The payment ID is invalid." });
  }

  const payment = await Payment.findOne({
    _id: request.params.paymentId,
    resident: request.user._id,
    status: "verified",
  }).populate("bill", "billNumber billingPeriod");

  if (!payment) {
    return response.status(404).json({ message: "A verified receipt was not found for your account." });
  }

  const paidAt = payment.paidAt ? payment.paidAt.toISOString() : "Unavailable";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>FlatFlow receipt ${escapeHtml(payment.bill.billNumber)}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1.5rem;color:#202124}dl{display:grid;grid-template-columns:12rem 1fr;gap:.8rem}dt{font-weight:600}button{padding:.6rem 1rem}@media print{button{display:none}body{margin:0}}</style>
  </head>
  <body>
    <main>
      <h1>FlatFlow payment receipt</h1>
      <p>Payment verified by Razorpay.</p>
      <dl>
        <dt>Bill number</dt><dd>${escapeHtml(payment.bill.billNumber)}</dd>
        <dt>Billing period</dt><dd>${escapeHtml(payment.bill.billingPeriod)}</dd>
        <dt>Amount paid</dt><dd>INR ${(payment.amountPaise / 100).toFixed(2)}</dd>
        <dt>Payment reference</dt><dd>${escapeHtml(payment.gatewayPaymentId)}</dd>
        <dt>Paid at</dt><dd>${escapeHtml(paidAt)}</dd>
      </dl>
      <button type="button" onclick="window.print()">Print / save receipt</button>
    </main>
  </body>
</html>`;

  return response
    .status(200)
    .type("html")
    .set("Content-Disposition", `inline; filename="flatflow-${payment.bill.billNumber}-receipt.html"`)
    .send(html);
}

export async function listAdminPayments(request, response) {
  const allowedStatuses = new Set(["pending", "failed", "verified", "reconciliation_required"]);
  const status = typeof request.query.status === "string" ? request.query.status : "";
  const limit = request.query.limit === undefined ? 50 : Number(request.query.limit);
  if ((status && !allowedStatuses.has(status)) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return response.status(400).json({ message: "Provide a valid payment status and a limit between 1 and 100." });
  }

  const filter = status ? { status } : {};
  const payments = await Payment.find(filter)
    .populate("bill", "billNumber billingPeriod")
    .populate("resident", "name email flat")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return response.status(200).json({
    payments: payments.map((payment) => ({
      id: payment._id,
      status: payment.status,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      gatewayOrderId: payment.gatewayOrderId,
      gatewayPaymentId: payment.gatewayPaymentId || null,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      failure: payment.failure
        ? {
            gatewayPaymentId: payment.failure.gatewayPaymentId,
            code: payment.failure.code,
            description: payment.failure.description,
            failedAt: payment.failure.failedAt,
          }
        : null,
      bill: payment.bill
        ? {
            id: payment.bill._id,
            billNumber: payment.bill.billNumber,
            billingPeriod: payment.bill.billingPeriod,
          }
        : null,
      resident: payment.resident
        ? {
            id: payment.resident._id,
            name: payment.resident.name,
            email: payment.resident.email,
            flat: payment.resident.flat,
          }
        : null,
    })),
  });
}
