import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "cbga-secret-key-2026";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    idProdi: number | null;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token tidak ditemukan" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token!, JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
      idProdi: number | null;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token tidak valid" });
  }
}

export { JWT_SECRET };
