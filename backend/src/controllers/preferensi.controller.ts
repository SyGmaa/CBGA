import type { Request, Response } from "express";
import prisma from "../services/prisma.ts";

export async function getAll(req: Request, res: Response) {
  try {
    const data = await prisma.preferensiWaktuDosen.findMany({
      include: {
        dosen: true,
        slotWaktu: true,
      },
      orderBy: [{ idDosen: "asc" }, { idSlotWaktu: "asc" }],
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getByDosen(req: Request, res: Response) {
  try {
    const data = await prisma.preferensiWaktuDosen.findMany({
      where: { idDosen: Number(req.params.dosenId) },
      include: { slotWaktu: true },
      orderBy: { idSlotWaktu: "asc" },
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const { idDosen, idSlotWaktu, status } = req.body;
    const data = await prisma.preferensiWaktuDosen.create({
      data: { idDosen, idSlotWaktu, status },
      include: { dosen: true, slotWaktu: true },
    });
    res.status(201).json(data);
  } catch (error: any) {
    if (error?.code === "P2002") {
      res.status(409).json({ error: "Preferensi untuk dosen & slot ini sudah ada" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { status } = req.body;
    const data = await prisma.preferensiWaktuDosen.update({
      where: { id: Number(req.params.id) },
      data: { status },
      include: { dosen: true, slotWaktu: true },
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await prisma.preferensiWaktuDosen.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Preferensi berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
