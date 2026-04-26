import { Router } from "express";
import { login, getProfile } from "../controllers/auth.controller.ts";
import { authMiddleware } from "../middleware/auth.middleware.ts";

const router = Router();

router.post("/login", login);
router.get("/profile", authMiddleware, getProfile);

export default router;
