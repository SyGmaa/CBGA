import type { Request, Response } from "express";
import prisma from "../services/prisma.ts";

export async function getAll(req: Request, res: Response) {
  try {
    const data = await prisma.ruangan.findMany({
      orderBy: [{ namaGedung: "asc" }, { namaRuangan: "asc" }],
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const data = await prisma.ruangan.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!data) { res.status(404).json({ error: "Ruangan tidak ditemukan" }); return; }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const { namaRuangan, namaGedung, kapasitas } = req.body;
    const data = await prisma.ruangan.create({
      data: { namaRuangan, namaGedung, kapasitas },
    });
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { namaRuangan, namaGedung, kapasitas } = req.body;
    const data = await prisma.ruangan.update({
      where: { id: Number(req.params.id) },
      data: { namaRuangan, namaGedung, kapasitas },
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await prisma.ruangan.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Ruangan berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
