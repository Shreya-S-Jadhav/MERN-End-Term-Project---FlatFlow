import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createResidentDispute, listResidentDisputes } from "../controllers/disputeController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const disputeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many dispute submissions. Please try again later." },
});

router.use(requireAuth, requireRole("resident"));
router.get("/my-disputes", listResidentDisputes);
router.post("/disputes", disputeRateLimit, createResidentDispute);

export default router;
