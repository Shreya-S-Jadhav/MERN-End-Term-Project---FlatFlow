import mongoose from "mongoose";

const flatSchema = new mongoose.Schema(
  {
    flatNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    wing: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

flatSchema.index({ wing: 1, flatNumber: 1 }, { unique: true });

const Flat = mongoose.model("Flat", flatSchema);

export default Flat;
