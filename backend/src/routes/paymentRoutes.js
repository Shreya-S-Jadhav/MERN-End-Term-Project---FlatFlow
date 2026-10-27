import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  createPaymentOrder,
  getResidentReceipt,
  listResidentPayments,
  verifyPayment,
} from "../controllers/paymentController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many payment requests. Please try again later." },
});

router.use(requireAuth, requireRole("resident"));
router.post("/create-order", paymentRateLimit, createPaymentOrder);
router.post("/verify", paymentRateLimit, verifyPayment);
router.get("/my-payments", listResidentPayments);
router.get("/:paymentId/receipt", getResidentReceipt);

export default router;
