import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    bill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      required: true,
      immutable: true,
    },
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
      immutable: true,
    },
    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      immutable: true,
    },
    gatewayOrderId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    gatewayPaymentId: {
      type: String,
      default: undefined,
    },
    failure: {
      gatewayPaymentId: String,
      code: String,
      description: String,
      source: String,
      step: String,
      failedAt: Date,
    },
    status: {
      type: String,
      enum: ["pending", "failed", "verified", "reconciliation_required"],
      default: "pending",
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

paymentSchema.index(
  { gatewayPaymentId: 1 },
  { unique: true, partialFilterExpression: { gatewayPaymentId: { $type: "string" } } },
);
paymentSchema.index({ resident: 1, createdAt: -1 });
paymentSchema.index({ bill: 1, status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
