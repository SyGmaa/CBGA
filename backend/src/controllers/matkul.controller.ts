import type { Request, Response } from "express";
import prisma from "../services/prisma.ts";

export async function getAll(req: Request, res: Response) {
  try {
    const data = await prisma.mataKuliah.findMany({
      include: { prodi: { include: { fakultas: true } } },
      orderBy: [{ semester: "asc" }, { kodeMk: "asc" }],
    });
    res.json(data);
  } catch (error) {
    console.error("GetAll Matkul Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const data = await prisma.mataKuliah.findUnique({
      where: { id: Number(req.params.id) },
      include: { prodi: { include: { fakultas: true } } },
    });
    if (!data) { res.status(404).json({ error: "Mata kuliah tidak ditemukan" }); return; }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const { kodeMk, namaMk, sks, semester, jumlahMhs, idProdi, isAktif } = req.body;
    const data = await prisma.mataKuliah.create({
      data: { 
        kodeMk, 
        namaMk, 
        sks: Number(sks), 
        semester: Number(semester), 
        jumlahMhs: Number(jumlahMhs), 
        idProdi: Number(idProdi),
        isAktif: isAktif !== undefined ? Boolean(isAktif) : true
      },
    });
    res.status(201).json(data);
  } catch (error: any) {
    console.error("Create Matkul Error:", error);
    if (error?.code === "P2002") {
      res.status(409).json({ error: "Kode MK sudah ada" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { kodeMk, namaMk, sks, semester, jumlahMhs, idProdi, isAktif } = req.body;
    const data = await prisma.mataKuliah.update({
      where: { id: Number(req.params.id) },
      data: { 
        kodeMk, 
        namaMk, 
        sks: Number(sks), 
        semester: Number(semester), 
        jumlahMhs: Number(jumlahMhs), 
        idProdi: Number(idProdi),
        isAktif: isAktif !== undefined ? Boolean(isAktif) : undefined
      },
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
  } catch (error: any) {
    if (error.code === 'P2003') {
      res.status(400).json({ error: "Mata kuliah tidak dapat dihapus karena sedang digunakan dalam jadwal atau data lain." });
      return;
    }
    console.error("Remove Matkul Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
