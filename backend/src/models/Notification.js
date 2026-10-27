import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    type: {
      type: String,
      enum: ["payment_verified", "dispute_updated"],
      required: true,
      immutable: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
      immutable: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
      immutable: true,
    },
    link: {
      type: String,
      required: true,
      enum: ["#bills-heading", "#resident-disputes-heading"],
      immutable: true,
    },
    eventKey: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, readAt: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
