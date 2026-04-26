import type { Request, Response } from "express";
import prisma from "../services/prisma.ts";

export async function getStats(req: Request, res: Response) {
  try {
    const [totalMatkul, totalDosen, totalRuangan, totalSlotWaktu, totalJadwal] =
      await Promise.all([
        prisma.mataKuliah.count(),
        prisma.dosen.count(),
        prisma.ruangan.count(),
        prisma.slotWaktu.count(),
        prisma.jadwalMaster.count(),
      ]);

    const latestJadwal = await prisma.jadwalMaster.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tahunAkademik: true,
        semesterTipe: true,
        status: true,
        fitnessScore: true,
        createdAt: true,
      },
    });

    res.json({
      totalMatkul,
      totalDosen,
      totalRuangan,
      totalSlotWaktu,
      totalJadwal,
      latestJadwal,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
