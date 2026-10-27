import { Router } from "express";
import { createFlat, createResident, listFlats, listResidents } from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/flats", listFlats);
router.post("/flats", createFlat);
router.get("/residents", listResidents);
router.post("/residents", createResident);

export default router;
