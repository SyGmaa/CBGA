import type { Request, Response } from "express";
import prisma from "../services/prisma.ts";

export async function getAll(req: Request, res: Response) {
  try {
    const data = await prisma.dosen.findMany({
      include: { prodi: true },
      orderBy: { namaDosen: "asc" },
    });
    res.json(data);
  } catch (error) {
    console.error("Error in getAll Dosen:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const data = await prisma.dosen.findUnique({
      where: { id: Number(req.params.id) },
      include: { 
        prodi: true,
        preferensiWaktu: { include: { slotWaktu: true } } 
      },
    });
    if (!data) { res.status(404).json({ error: "Dosen tidak ditemukan" }); return; }
    res.json(data);
  } catch (error) {
    console.error("Error in getById Dosen:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const { nidn, namaDosen, idProdi } = req.body;
    const data = await prisma.dosen.create({
      data: { 
        nidn, 
        namaDosen, 
        idProdi: idProdi ? Number(idProdi) : null 
      },
    });
    res.status(201).json(data);
  } catch (error: any) {
    console.error("Error in create Dosen:", error);
    if (error?.code === "P2002") {
      res.status(409).json({ error: "NIDN sudah ada" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { nidn, namaDosen, idProdi } = req.body;
    const data = await prisma.dosen.update({
      where: { id: Number(req.params.id) },
      data: { 
        nidn, 
        namaDosen, 
        idProdi: idProdi ? Number(idProdi) : null 
      },
    });
    res.json(data);
  } catch (error) {
    console.error("Error in update Dosen:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await prisma.dosen.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Dosen berhasil dihapus" });
  } catch (error: any) {
    if (error.code === 'P2003') {
      res.status(400).json({ error: "Dosen tidak dapat dihapus karena sedang digunakan dalam jadwal atau data lain." });
      return;
    }
    console.error("Error in remove Dosen:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
