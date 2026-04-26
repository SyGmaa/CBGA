import type { Request, Response } from "express";
import prisma from "../services/prisma.ts";

export async function getAll(req: Request, res: Response) {
  try {
    const data = await prisma.mataKuliah.findMany({
      include: { userProdi: { select: { id: true, username: true } } },
      orderBy: [{ semester: "asc" }, { kodeMk: "asc" }],
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const data = await prisma.mataKuliah.findUnique({
      where: { id: Number(req.params.id) },
      include: { userProdi: { select: { id: true, username: true } } },
    });
    if (!data) { res.status(404).json({ error: "Mata kuliah tidak ditemukan" }); return; }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const { kodeMk, namaMk, sks, semester, jumlahMhs, idUserProdi } = req.body;
    const data = await prisma.mataKuliah.create({
      data: { kodeMk, namaMk, sks, semester, jumlahMhs, idUserProdi },
    });
    res.status(201).json(data);
  } catch (error: any) {
    if (error?.code === "P2002") {
      res.status(409).json({ error: "Kode MK sudah ada" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { kodeMk, namaMk, sks, semester, jumlahMhs, idUserProdi } = req.body;
    const data = await prisma.mataKuliah.update({
      where: { id: Number(req.params.id) },
      data: { kodeMk, namaMk, sks, semester, jumlahMhs, idUserProdi },
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await prisma.mataKuliah.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Mata kuliah berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
