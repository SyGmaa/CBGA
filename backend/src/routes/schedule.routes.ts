import { Router } from "express";
import * as controller from "../controllers/schedule.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authMiddleware, controller.getAllSchedules);
router.post("/generate", authMiddleware, controller.generateSchedule);
router.post("/bulk-delete", authMiddleware, controller.bulkDeleteSchedules);
router.get("/result/:id", authMiddleware, controller.getResult);
router.put("/update-slot/:detailId", authMiddleware, controller.updateSlot);
router.delete("/:id", authMiddleware, controller.deleteSchedule);

export default router;
