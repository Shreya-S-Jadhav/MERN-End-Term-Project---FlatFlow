import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    flat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flat",
      required: true,
      immutable: true,
    },
    billingPeriod: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
      immutable: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
      immutable: true,
    },
    issueDate: {
      type: Date,
      required: true,
      immutable: true,
    },
    dueDate: {
      type: Date,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
  },
  { timestamps: true },
);

billSchema.index({ flat: 1, billingPeriod: 1 }, { unique: true });
billSchema.index({ billingPeriod: 1, dueDate: 1, status: 1 });

const Bill = mongoose.model("Bill", billSchema);

export default Bill;
