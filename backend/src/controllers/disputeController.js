import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Dispute from "../models/Dispute.js";

const categories = new Set(["incorrect_amount", "payment_issue", "bill_details", "other"]);
const adminStatuses = new Set(["under_review", "resolved", "rejected"]);
const listStatuses = new Set(["open", "under_review", "resolved", "rejected"]);

function requestBody(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function validateDisputeInput(bodyValue) {
  const body = requestBody(bodyValue);
  const billId = typeof body.billId === "string" ? body.billId : "";
  const category = typeof body.category === "string" ? body.category : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!mongoose.isValidObjectId(billId)) {
    return { error: "Select a valid bill to dispute." };
  }
  if (!categories.has(category)) {
    return { error: "Select a valid dispute category." };
  }
  if (subject.length < 3 || subject.length > 100) {
    return { error: "The subject must be between 3 and 100 characters." };
  }
  if (description.length < 10 || description.length > 2000) {
    return { error: "The description must be between 10 and 2000 characters." };
  }

  return { input: { billId, category, subject, description } };
}

export function validateDisputeUpdate(bodyValue, currentStatus) {
  const body = requestBody(bodyValue);
  const status = typeof body.status === "string" ? body.status : "";
  const adminResponse = typeof body.adminResponse === "string" ? body.adminResponse.trim() : "";

  if (!listStatuses.has(currentStatus) || !adminStatuses.has(status)) {
    return { error: "Choose a valid next dispute status." };
  }
  if (currentStatus === "resolved" || currentStatus === "rejected") {
    return { error: "A closed dispute cannot be changed." };
  }
  if (currentStatus === "under_review" && status === "open") {
    return { error: "A dispute under review cannot be reopened." };
  }
  if (adminResponse.length > 2000) {
    return { error: "The response must be 2000 characters or fewer." };
  }
  if ((status === "resolved" || status === "rejected") && adminResponse.length < 3) {
    return { error: "Add a response of at least 3 characters before closing the dispute." };
  }

  return { update: { status, adminResponse } };
}

function mapDispute(dispute) {
  return {
    id: dispute._id,
    category: dispute.category,
    subject: dispute.subject,
    description: dispute.description,
    status: dispute.status,
    adminResponse: dispute.adminResponse,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
    closedAt: dispute.closedAt,
    bill: dispute.bill
      ? {
          id: dispute.bill._id,
          billNumber: dispute.bill.billNumber,
          billingPeriod: dispute.bill.billingPeriod,
          amountPaise: dispute.bill.amountPaise,
          status: dispute.bill.status,
          flat: dispute.bill.flat
            ? {
                id: dispute.bill.flat._id,
                flatNumber: dispute.bill.flat.flatNumber,
                wing: dispute.bill.flat.wing,
              }
            : null,
        }
      : null,
    resident: dispute.resident
      ? {
          id: dispute.resident._id,
          name: dispute.resident.name,
          email: dispute.resident.email,
          flat: dispute.resident.flat
            ? {
                id: dispute.resident.flat._id,
                flatNumber: dispute.resident.flat.flatNumber,
                wing: dispute.resident.flat.wing,
              }
            : null,
        }
      : null,
    reviewedBy:
      dispute.reviewedBy && typeof dispute.reviewedBy === "object" && dispute.reviewedBy.name
        ? { id: dispute.reviewedBy._id, name: dispute.reviewedBy.name }
        : null,
  };
}

export async function createResidentDispute(request, response) {
  const parsed = validateDisputeInput(request.body);
  if (parsed.error) return response.status(400).json({ message: parsed.error });
  if (!request.user.flat) {
    return response.status(400).json({ message: "Your account must be assigned to a flat before disputing a bill." });
  }

  const bill = await Bill.findOne({
    _id: parsed.input.billId,
    flat: request.user.flat._id || request.user.flat,
  })
    .select("_id")
    .lean();
  if (!bill) {
    return response.status(404).json({ message: "The selected bill was not found for your flat." });
  }

  try {
    const dispute = await Dispute.create({
      bill: bill._id,
      activeBill: bill._id,
      resident: request.user._id,
      category: parsed.input.category,
      subject: parsed.input.subject,
      description: parsed.input.description,
    });

    const populatedDispute = await Dispute.findById(dispute._id)
      .populate({ path: "bill", select: "billNumber billingPeriod amountPaise status flat", populate: { path: "flat", select: "flatNumber wing" } })
      .lean();
    return response.status(201).json({ dispute: mapDispute(populatedDispute) });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ message: "An open dispute already exists for this bill." });
    }
    if (error.name === "ValidationError") {
      return response.status(400).json({ message: "The dispute details are invalid." });
    }
    throw error;
  }
}

export async function listResidentDisputes(request, response) {
  const disputes = await Dispute.find({ resident: request.user._id })
    .populate({ path: "bill", select: "billNumber billingPeriod amountPaise status flat", populate: { path: "flat", select: "flatNumber wing" } })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return response.status(200).json({ disputes: disputes.map(mapDispute) });
}

export async function listAdminDisputes(request, response) {
  const status = typeof request.query.status === "string" ? request.query.status : "";
  const limit = request.query.limit === undefined ? 50 : Number(request.query.limit);
  if ((status && !listStatuses.has(status)) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return response.status(400).json({ message: "Choose a valid dispute status and a limit between 1 and 100." });
  }

  const disputes = await Dispute.find(status ? { status } : {})
    .populate({ path: "bill", select: "billNumber billingPeriod amountPaise status flat", populate: { path: "flat", select: "flatNumber wing" } })
    .populate({ path: "resident", select: "name email flat", populate: { path: "flat", select: "flatNumber wing" } })
    .populate("reviewedBy", "name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return response.status(200).json({ disputes: disputes.map(mapDispute) });
}

export async function updateAdminDispute(request, response) {
  const disputeId = request.params.disputeId;
  if (!mongoose.isValidObjectId(disputeId)) {
    return response.status(400).json({ message: "The dispute ID is invalid." });
  }

  const dispute = await Dispute.findById(disputeId);
  if (!dispute) {
    return response.status(404).json({ message: "Dispute not found." });
  }

  const parsed = validateDisputeUpdate(request.body, dispute.status);
  if (parsed.error) return response.status(400).json({ message: parsed.error });

  const update = {
    $set: {
      status: parsed.update.status,
      adminResponse: parsed.update.adminResponse,
      reviewedBy: request.user._id,
    },
  };
  if (parsed.update.status === "resolved" || parsed.update.status === "rejected") {
    update.$set.closedAt = new Date();
    update.$unset = { activeBill: "" };
  }
  const updatedDispute = await Dispute.findOneAndUpdate(
    { _id: dispute._id, status: dispute.status },
    update,
    { new: true, runValidators: true },
  );
  if (!updatedDispute) {
    return response.status(409).json({ message: "The dispute changed while you were reviewing it. Reload and try again." });
  }

  const populatedDispute = await Dispute.findById(updatedDispute._id)
    .populate({ path: "bill", select: "billNumber billingPeriod amountPaise status flat", populate: { path: "flat", select: "flatNumber wing" } })
    .populate({ path: "resident", select: "name email flat", populate: { path: "flat", select: "flatNumber wing" } })
    .populate("reviewedBy", "name")
    .lean();

  return response.status(200).json({ dispute: mapDispute(populatedDispute) });
}
