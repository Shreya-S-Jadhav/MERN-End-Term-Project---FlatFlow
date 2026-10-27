import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import test from "node:test";
import { verifyPaymentSignature, verifyWebhookSignature } from "../src/services/razorpay.js";

test("payment signature accepts the gateway HMAC for the order and payment IDs", () => {
  const secret = randomBytes(32).toString("hex");
  const orderId = "order_test_123";
  const paymentId = "pay_test_456";
  const signature = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

  assert.equal(verifyPaymentSignature(orderId, paymentId, signature, secret), true);
});

test("payment signature rejects a changed order, payment, malformed digest, or missing secret", () => {
  const secret = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", secret).update("order_test_123|pay_test_456").digest("hex");

  assert.equal(verifyPaymentSignature("order_other", "pay_test_456", signature, secret), false);
  assert.equal(verifyPaymentSignature("order_test_123", "pay_other", signature, secret), false);
  assert.equal(verifyPaymentSignature("order_test_123", "pay_test_456", "invalid", secret), false);
  assert.equal(verifyPaymentSignature("order_test_123", "pay_test_456", signature, ""), false);
});

test("webhook signature verifies the exact raw request body", () => {
  const secret = randomBytes(32).toString("hex");
  const rawBody = Buffer.from('{"event":"payment.captured"}');
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.equal(verifyWebhookSignature(rawBody, signature, secret), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature, secret), false);
  assert.equal(verifyWebhookSignature(rawBody.toString("utf8"), signature, secret), false);
});
