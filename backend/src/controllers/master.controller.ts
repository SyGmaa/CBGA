import type { Request, Response } from "express";
import prisma from "../services/prisma.ts";

export async function getFakultas(req: Request, res: Response) {
  try {
    const data = await prisma.fakultas.findMany({
      orderBy: { namaFakultas: "asc" },
    });
    res.json(data);
  } catch (error) {
    console.error("Error in getFakultas:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getProdi(req: Request, res: Response) {
  try {
    const data = await prisma.prodi.findMany({
      include: { fakultas: true },
      orderBy: { namaProdi: "asc" },
    });
    res.json(data);
  } catch (error) {
    console.error("Error in getProdi:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getGedung(req: Request, res: Response) {
  try {
    const data = await prisma.gedung.findMany({
      orderBy: { namaGedung: "asc" },
    });
    res.json(data);
  } catch (error) {
    console.error("Error in getGedung:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
