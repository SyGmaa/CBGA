import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../services/prisma.ts";
import { JWT_SECRET } from "../middleware/auth.middleware.js";

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username dan password harus diisi" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      res.status(401).json({ error: "Username atau password salah" });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: "Username atau password salah" });
      return;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, idProdi: user.idProdi },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        idProdi: user.idProdi,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    const authReq = req as any;
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      select: { id: true, username: true, email: true, role: true, idProdi: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
