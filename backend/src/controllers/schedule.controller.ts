import type { Request, Response } from "express";
import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../services/prisma.ts";
import pkg from "../../../generated/prisma/index.js";
const { StatusJadwal } = pkg;

// Store active socket.io instance reference
let ioInstance: any = null;
export function setIoInstance(io: any) {
  ioInstance = io;
}

export async function generateSchedule(req: Request, res: Response) {
  try {
    const { tahunAkademik, semesterTipe } = req.body;

    if (!tahunAkademik || !semesterTipe) {
      res.status(400).json({ error: "tahunAkademik dan semesterTipe harus diisi" });
      return;
    }

    // Create JadwalMaster with GENERATING status
    const jadwalMaster = await prisma.jadwalMaster.create({
      data: {
        tahunAkademik,
        semesterTipe,
        status: StatusJadwal.GENERATING,
      },
    });

    // Fetch all required data
    const [mataKuliah, ruanganList, slotWaktuList, preferensiList] = await Promise.all([
      prisma.mataKuliah.findMany(),
      prisma.ruangan.findMany(),
      prisma.slotWaktu.findMany(),
      prisma.preferensiWaktuDosen.findMany({
        where: { status: "UNAVAILABLE" },
      }),
    ]);

    // Build matkul-dosen pairs (from seed data, each MK has a pre-assigned dosen)
    // In real scenario, this would come from a separate assignment table
    const jadwalDetails = await prisma.jadwalDetail.findMany({
      where: { idJadwalMaster: jadwalMaster.id },
    });

    // For now, we need to get dosen assignments from the seed pattern
    // We'll fetch all MK and match with their typical dosen assignments
    const matkulDosenPairs = mataKuliah.map((mk) => {
      // Default: assign dosen based on existing logic
      return {
        idMatkul: mk.id,
        idDosen: 1, // Will be overridden by actual assignment
        semester: mk.semester,
        jumlahMhs: mk.jumlahMhs,
      };
    });

    // Try to get actual dosen assignments from any previous schedule or a lookup
    // For simplicity, we'll use a basic mapping based on the seed data pattern
    const dosenAssignments: { [kodeMk: string]: string } = {
      TIF101: "111111", TIF102: "666666", TIF103: "222222", TIF104: "777777",
      TIF301: "111111", TIF302: "333333", TIF303: "333333", TIF304: "444444",
      TIF501: "111111", TIF502: "222222", TIF503: "333333",
      TIF701: "555555", TIF702: "222222", TIF703: "555555",
    };

    const dosenList = await prisma.dosen.findMany();
    const dosenNidnMap = new Map(dosenList.map((d) => [d.nidn, d.id]));

    for (const pair of matkulDosenPairs) {
      const mk = mataKuliah.find((m) => m.id === pair.idMatkul);
      if (mk) {
        const nidn = dosenAssignments[mk.kodeMk];
        if (nidn) {
          const dosenId = dosenNidnMap.get(nidn);
          if (dosenId) pair.idDosen = dosenId;
        }
      }
    }

    // Build data structures for worker
    const allRuanganIds = ruanganList.map((r) => r.id);
    const allSlotWaktuIds = slotWaktuList.map((s) => s.id);
    const ruanganKapasitasMap: [number, number][] = ruanganList.map((r) => [r.id, r.kapasitas]);

    const preferensiMap: { [dosenId: number]: number[] } = {};
    for (const pref of preferensiList) {
      if (!preferensiMap[pref.idDosen]) {
        preferensiMap[pref.idDosen] = [];
      }
      preferensiMap[pref.idDosen]!.push(pref.idSlotWaktu);
    }

    // Start worker thread
    const workerPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../algorithms/cbga.worker.ts"
    );

    // Use tsx to run the worker
    const worker = new Worker(workerPath, {
      workerData: {
        matkulDosenPairs,
        allRuanganIds,
        allSlotWaktuIds,
        ruanganKapasitasMap,
        preferensiMap,
        config: {
          populationSize: 50,
          maxGenerations: 1000,
          mutationRate: 0.03,
          crossoverRate: 0.8,
          elitismCount: 2,
          tournamentSize: 3,
        },
      },
      execArgv: ["--import", "tsx"],
    });

    worker.on("message", async (msg: any) => {
      if (msg.type === "progress") {
        // Emit progress via Socket.io
        if (ioInstance) {
          ioInstance.emit("ga_progress", {
            jadwalMasterId: jadwalMaster.id,
            ...msg.data,
          });
        }
      }

      if (msg.type === "completed") {
        try {
          // Save results to database
          const { kromosom, fitness, conflicts } = msg.data;

          // Create JadwalDetail records
          for (const gen of kromosom) {
            await prisma.jadwalDetail.create({
              data: {
                idJadwalMaster: jadwalMaster.id,
                idMatkul: gen.idMatkul,
                idDosen: gen.idDosen,
                idRuangan: gen.idRuangan,
                idSlotWaktu: gen.idSlotWaktu,
              },
            });
          }

          // Update JadwalMaster status
          const status = conflicts.length === 0 ? StatusJadwal.FINAL : StatusJadwal.DRAFT;
          await prisma.jadwalMaster.update({
            where: { id: jadwalMaster.id },
            data: {
              status,
              fitnessScore: fitness,
            },
          });

          if (ioInstance) {
            ioInstance.emit("ga_completed", {
              jadwalMasterId: jadwalMaster.id,
              fitness,
              conflictCount: conflicts.length,
              status,
            });
          }
        } catch (error) {
          console.error("Error saving results:", error);
          if (ioInstance) {
            ioInstance.emit("ga_error", {
              jadwalMasterId: jadwalMaster.id,
              error: "Gagal menyimpan hasil",
            });
          }
        }
      }
    });

    worker.on("error", async (error) => {
      console.error("Worker error:", error);
      await prisma.jadwalMaster.update({
        where: { id: jadwalMaster.id },
        data: { status: StatusJadwal.DRAFT },
      });
      if (ioInstance) {
        ioInstance.emit("ga_error", {
          jadwalMasterId: jadwalMaster.id,
          error: error.message,
        });
      }
    });

    res.status(202).json({
      message: "Proses generasi jadwal dimulai",
      jadwalMasterId: jadwalMaster.id,
    });
  } catch (error) {
    console.error("Generate schedule error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getResult(req: Request, res: Response) {
  try {
    const jadwal = await prisma.jadwalMaster.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        jadwalDetail: {
          include: {
            mataKuliah: true,
            dosen: true,
            ruangan: true,
            slotWaktu: true,
          },
        },
      },
    });

    if (!jadwal) {
      res.status(404).json({ error: "Jadwal tidak ditemukan" });
      return;
    }

    res.json(jadwal);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllSchedules(req: Request, res: Response) {
  try {
    const schedules = await prisma.jadwalMaster.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { jadwalDetail: true } },
      },
    });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateSlot(req: Request, res: Response) {
  try {
    const { idRuangan, idSlotWaktu } = req.body;
    const detailId = Number(req.params.detailId);

    const updated = await prisma.jadwalDetail.update({
      where: { id: detailId },
      data: { idRuangan, idSlotWaktu },
      include: {
        mataKuliah: true,
        dosen: true,
        ruangan: true,
        slotWaktu: true,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteSchedule(req: Request, res: Response) {
  try {
    await prisma.jadwalMaster.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Jadwal berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
