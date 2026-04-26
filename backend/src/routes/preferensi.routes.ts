import { Router } from "express";
import * as controller from "../controllers/preferensi.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authMiddleware, controller.getAll);
router.get("/dosen/:dosenId", authMiddleware, controller.getByDosen);
router.post("/", authMiddleware, controller.create);
router.put("/:id", authMiddleware, controller.update);
router.delete("/:id", authMiddleware, controller.remove);

export default router;
