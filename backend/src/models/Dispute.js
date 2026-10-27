import mongoose from "mongoose";

const disputeSchema = new mongoose.Schema(
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
    activeBill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: undefined,
    },
    category: {
      type: String,
      enum: ["incorrect_amount", "payment_issue", "bill_details", "other"],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["open", "under_review", "resolved", "rejected"],
      default: "open",
    },
    adminResponse: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

disputeSchema.index(
  { activeBill: 1 },
  { unique: true, partialFilterExpression: { activeBill: { $type: "objectId" } } },
);
disputeSchema.index({ resident: 1, createdAt: -1 });
disputeSchema.index({ status: 1, createdAt: -1 });

const Dispute = mongoose.model("Dispute", disputeSchema);

export default Dispute;
