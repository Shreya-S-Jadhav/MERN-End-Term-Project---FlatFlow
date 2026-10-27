import { Router } from "express";
import { listResidentBills } from "../controllers/billController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/my-bills", requireAuth, requireRole("resident"), listResidentBills);

export default router;
