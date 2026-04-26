import type { Request, Response } from "express";
import prisma from "../services/prisma.ts";

export async function getAll(req: Request, res: Response) {
  try {
    const data = await prisma.slotWaktu.findMany({
      orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const data = await prisma.slotWaktu.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!data) { res.status(404).json({ error: "Slot waktu tidak ditemukan" }); return; }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const { hari, jamMulai, jamSelesai } = req.body;
    const data = await prisma.slotWaktu.create({
      data: { hari, jamMulai, jamSelesai },
    });
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { hari, jamMulai, jamSelesai } = req.body;
    const data = await prisma.slotWaktu.update({
      where: { id: Number(req.params.id) },
      data: { hari, jamMulai, jamSelesai },
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await prisma.slotWaktu.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Slot waktu berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
