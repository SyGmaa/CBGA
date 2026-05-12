import type { Request, Response } from "express";
import prisma from "../services/prisma.ts";

export async function getAll(req: Request, res: Response) {
  try {
    const authReq = req as any;
    const filter = authReq.user.role === "PRODI" ? { dosen: { idProdi: authReq.user.idProdi } } : {};

    const data = await prisma.preferensiWaktuDosen.findMany({
      where: filter,
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
    const authReq = req as any;
    const dosenId = Number(req.params.dosenId);

    // Check ownership for PRODI role
    if (authReq.user.role === "PRODI") {
      const dosen = await prisma.dosen.findUnique({
        where: { id: dosenId },
        select: { idProdi: true }
      });
      if (!dosen || dosen.idProdi !== authReq.user.idProdi) {
        res.status(403).json({ error: "Anda tidak memiliki akses ke data dosen ini" });
        return;
      }
    }

    const data = await prisma.preferensiWaktuDosen.findMany({
      where: { idDosen: dosenId },
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
    const authReq = req as any;
    const { idDosen, idSlotWaktu, status } = req.body;

    // Check ownership for PRODI role
    if (authReq.user.role === "PRODI") {
      const dosen = await prisma.dosen.findUnique({
        where: { id: idDosen },
        select: { idProdi: true }
      });
      if (!dosen || dosen.idProdi !== authReq.user.idProdi) {
        res.status(403).json({ error: "Anda tidak memiliki akses ke data dosen ini" });
        return;
      }
    }

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
    const authReq = req as any;
    const { status } = req.body;

    // Check ownership for PRODI role
    if (authReq.user.role === "PRODI") {
      const existing = await prisma.preferensiWaktuDosen.findUnique({
        where: { id: Number(req.params.id) },
        include: { dosen: true }
      });
      if (!existing || existing.dosen.idProdi !== authReq.user.idProdi) {
        res.status(403).json({ error: "Anda tidak memiliki akses ke preferensi ini" });
        return;
      }
    }

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
    const authReq = req as any;

    // Check ownership for PRODI role
    if (authReq.user.role === "PRODI") {
      const existing = await prisma.preferensiWaktuDosen.findUnique({
        where: { id: Number(req.params.id) },
        include: { dosen: true }
      });
      if (!existing || existing.dosen.idProdi !== authReq.user.idProdi) {
        res.status(403).json({ error: "Anda tidak memiliki akses ke preferensi ini" });
        return;
      }
    }

    await prisma.preferensiWaktuDosen.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Preferensi berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
