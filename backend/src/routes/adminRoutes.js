import { Router } from "express";
import { createFlat, createResident, listFlats, listResidents } from "../controllers/adminController.js";
import { generateBills, listAdminBills } from "../controllers/billController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/flats", listFlats);
router.post("/flats", createFlat);
router.get("/residents", listResidents);
router.post("/residents", createResident);
router.get("/bills", listAdminBills);
router.post("/bills/generate", generateBills);

export default router;
