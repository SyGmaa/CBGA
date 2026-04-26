import { Router } from "express";
import * as masterController from "../controllers/master.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/fakultas", authMiddleware, masterController.getFakultas);
router.get("/prodi", authMiddleware, masterController.getProdi);
router.get("/gedung", authMiddleware, masterController.getGedung);

export default router;
