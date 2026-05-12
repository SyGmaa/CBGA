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
    const { tahunAkademik, semesterTipe, jumlahJadwal = 1, maxGenerasi = 500 } = req.body;
    const requestedSchedules = Math.min(Number(jumlahJadwal) || 1, 1000);
    const maxGenLimit = Math.min(Number(maxGenerasi) || 500, 2000);

    if (!tahunAkademik || !semesterTipe) {
      res.status(400).json({ error: "tahunAkademik dan semesterTipe harus diisi" });
      return;
    }

    // Create multiple JadwalMaster with GENERATING status
    const masters = await prisma.$transaction(
      Array.from({ length: requestedSchedules }).map((_, i) =>
        prisma.jadwalMaster.create({
          data: {
            tahunAkademik: requestedSchedules > 1 ? `${tahunAkademik} (Alt ${i + 1})` : tahunAkademik,
            semesterTipe,
            status: StatusJadwal.GENERATING,
          },
        })
      )
    );
    const jadwalMasterId = masters[0].id;

    const authReq = req as any;
    const isProdiRole = authReq.user.role === "PRODI";

    // Fetch all required data (Ordered slots are CRITICAL for consecutive session logic)
    const [mataKuliah, ruanganList, slotWaktuList, preferensiList] = await Promise.all([
      prisma.mataKuliah.findMany({
        where: {
          isAktif: true,
          idProdi: isProdiRole ? authReq.user.idProdi : undefined,
          semester: {
            in: semesterTipe === "Ganjil" ? [1, 3, 5, 7] : [2, 4, 6, 8]
          }
        }
      }),
      prisma.ruangan.findMany(),
      prisma.slotWaktu.findMany({
        orderBy: [
          { hari: 'asc' },
          { jamMulai: 'asc' }
        ]
      }),
      prisma.preferensiWaktuDosen.findMany({
        where: { 
          status: "UNAVAILABLE",
          dosen: isProdiRole ? { idProdi: authReq.user.idProdi } : undefined
        },
      }),
    ]);

    // Build matkul-dosen pairs (from seed data, each MK has a pre-assigned dosen)
    // In real scenario, this would come from a separate assignment table
    const jadwalDetails = await prisma.jadwalDetail.findMany({
      where: { idJadwalMaster: jadwalMasterId },
    });

    // For now, we need to get dosen assignments from the seed pattern
    // We'll fetch all MK and match with their typical dosen assignments
    const matkulDosenPairs = mataKuliah.map((mk) => {
      return {
        idMatkul: mk.id,
        idDosen: 1,
        idProdi: mk.idProdi,
        semester: mk.semester,
        jumlahMhs: mk.jumlahMhs,
        sks: mk.sks,
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
    const defaultDosenId = dosenList.length > 0 ? dosenList[0].id : 1;

    // Group dosen by prodi for better distribution
    const dosenByProdi: { [prodiId: number]: number[] } = {};
    for (const d of dosenList) {
      if (d.idProdi) {
        if (!dosenByProdi[d.idProdi]) dosenByProdi[d.idProdi] = [];
        dosenByProdi[d.idProdi].push(d.id);
      }
    }

    // Distribute lecturers from the same prodi
    const prodiDosenIndex: { [prodiId: number]: number } = {};
    for (const pair of matkulDosenPairs) {
      const prodiId = pair.idProdi;
      const availableDosen = dosenByProdi[prodiId] || [];
      
      if (availableDosen.length > 0) {
        // Use Round-Robin to distribute courses among lecturers in the same prodi
        if (prodiDosenIndex[prodiId] === undefined) prodiDosenIndex[prodiId] = 0;
        pair.idDosen = availableDosen[prodiDosenIndex[prodiId] % availableDosen.length];
        prodiDosenIndex[prodiId]++;
      } else {
        pair.idDosen = defaultDosenId;
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
        allSlotWaktu: slotWaktuList.map(s => ({ id: s.id, hari: s.hari, jamMulai: s.jamMulai, jamSelesai: s.jamSelesai })),
        ruanganKapasitasMap,
        preferensiMap,
        config: {
          populationSize: Math.max(150, requestedSchedules * 3),
          maxGenerations: maxGenLimit,
          mutationRate: 0.05,
          crossoverRate: 0.85,
          elitismCount: 5,
          tournamentSize: 5,
          jumlahJadwal: requestedSchedules,
        },
      },
      execArgv: ["--import", "tsx"],
    });

    worker.on("message", async (msg: any) => {
      if (msg.type === "progress") {
        // Emit progress via Socket.io
        if (ioInstance) {
          ioInstance.emit("ga_progress", {
            jadwalMasterId: jadwalMasterId,
            ...msg.data,
          });
        }
      }

      if (msg.type === "completed") {
        try {
          const { results } = msg.data;
          
          for (let i = 0; i < results.length; i++) {
            const { kromosom, fitness, conflicts } = results[i];
            const masterId = masters[i]?.id;
            if (!masterId) break;

            const allSlotIds = slotWaktuList.map(s => s.id);
            const detailData: any[] = [];
            
            for (const gen of kromosom) {
              const startIndex = allSlotIds.indexOf(gen.idSlotWaktu);
              // Create an entry for each SKS slot
              for (let s = 0; s < gen.sks; s++) {
                const currentSlotId = allSlotIds[startIndex + s];
                if (!currentSlotId) continue;
                
                detailData.push({
                  idJadwalMaster: masterId,
                  idMatkul: gen.idMatkul,
                  idDosen: gen.idDosen,
                  idRuangan: gen.idRuangan,
                  idSlotWaktu: currentSlotId,
                });
              }
            }

            // Use createMany for bulk insert!
            await prisma.jadwalDetail.createMany({ data: detailData });

            const status = conflicts.length === 0 ? StatusJadwal.FINAL : StatusJadwal.DRAFT;
            await prisma.jadwalMaster.update({
              where: { id: masterId },
              data: { status, fitnessScore: fitness, conflictCount: conflicts.length },
            });
          }

          if (ioInstance) {
            ioInstance.emit("ga_completed", {
              jadwalMasterId: jadwalMasterId,
              fitness: results[0].fitness,
              conflictCount: results[0].conflicts.length,
              status: results[0].conflicts.length === 0 ? StatusJadwal.FINAL : StatusJadwal.DRAFT,
            });
          }
        } catch (error: any) {
          console.error("Error saving results:", error);
          import('fs').then(fs => fs.writeFileSync('error.log', error.stack || String(error)));
          if (ioInstance) {
            ioInstance.emit("ga_error", {
              jadwalMasterId: jadwalMasterId,
              error: `Gagal menyimpan hasil: ${error.message || String(error)}`,
            });
          }
        }
      }
    });

    worker.on("error", async (error) => {
      console.error("Worker error:", error);
      for (const master of masters) {
        await prisma.jadwalMaster.update({
          where: { id: master.id },
          data: { status: StatusJadwal.DRAFT },
        });
      }
      if (ioInstance) {
        ioInstance.emit("ga_error", {
          jadwalMasterId: jadwalMasterId,
          error: error.message,
        });
      }
    });

    res.status(202).json({
      message: "Proses generasi jadwal dimulai",
      jadwalMasterId: jadwalMasterId,
    });
  } catch (error: any) {
    console.error("Generate schedule error:", error);
    res.status(500).json({ error: error.message || "Internal server error", stack: error.stack });
  }
}

export async function getResult(req: Request, res: Response) {
  try {
    const authReq = req as any;
    const isProdiRole = authReq.user.role === "PRODI";

    const jadwal = await prisma.jadwalMaster.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        jadwalDetail: {
          where: isProdiRole ? { mataKuliah: { idProdi: authReq.user.idProdi } } : undefined,
          include: {
            mataKuliah: {
              include: { prodi: { include: { fakultas: true } } }
            },
            dosen: true,
            ruangan: {
              include: { gedung: true }
            },
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
    const { idRuangan, idSlotWaktu, detailIds } = req.body;
    const detailId = Number(req.params.detailId);

    // Fetch the detail to know which course and master schedule it belongs to
    const targetDetail = await prisma.jadwalDetail.findUnique({
      where: { id: detailId },
      include: { mataKuliah: true }
    });

    if (!targetDetail) {
      res.status(404).json({ error: "Detail jadwal tidak ditemukan" });
      return;
    }

    // Find all details for this session in this master schedule
    let courseDetails;
    if (detailIds && Array.isArray(detailIds) && detailIds.length > 0) {
      courseDetails = await prisma.jadwalDetail.findMany({
        where: { id: { in: detailIds } },
        orderBy: { idSlotWaktu: 'asc' }
      });
    } else {
      courseDetails = await prisma.jadwalDetail.findMany({
        where: {
          idJadwalMaster: targetDetail.idJadwalMaster,
          idMatkul: targetDetail.idMatkul,
          idDosen: targetDetail.idDosen,
        },
        orderBy: { idSlotWaktu: 'asc' }
      });
    }

    // Find starting slot index in ordered list
    const allSlots = await prisma.slotWaktu.findMany({
      orderBy: [{ hari: 'asc' }, { jamMulai: 'asc' }]
    });
    const allSlotIds = allSlots.map(s => s.id);
    const newStartIdx = allSlotIds.indexOf(idSlotWaktu);

    if (newStartIdx === -1) {
       res.status(400).json({ error: "Slot waktu tidak valid" });
       return;
    }

    // Update all slots in the block
    const updates = courseDetails.map((detail, index) => {
      const nextSlotId = allSlotIds[newStartIdx + index];
      if (!nextSlotId) return null;
      return prisma.jadwalDetail.update({
        where: { id: detail.id },
        data: { idRuangan, idSlotWaktu: nextSlotId }
      });
    }).filter(u => u !== null);

    await prisma.$transaction(updates as any);

    const updatedMaster = await prisma.jadwalMaster.findUnique({
      where: { id: targetDetail.idJadwalMaster },
      include: { 
        jadwalDetail: {
          where: { id: detailId },
          include: { mataKuliah: true, dosen: true, ruangan: true, slotWaktu: true }
        }
      }
    });

    // Recalculate conflict count but NEVER downgrade FINAL status
    const masterId = targetDetail.idJadwalMaster;
    const currentMaster = await prisma.jadwalMaster.findUnique({ where: { id: masterId } });
    const allDetails = await prisma.jadwalDetail.findMany({
      where: { idJadwalMaster: masterId },
      include: { mataKuliah: true }
    });

    // Optimized conflict calculation using map
    const slotMap = new Map<number, any[]>();
    allDetails.forEach(d => {
      if (!slotMap.has(d.idSlotWaktu)) slotMap.set(d.idSlotWaktu, []);
      slotMap.get(d.idSlotWaktu)!.push(d);
    });

    let conflictCount = 0;
    for (const details of slotMap.values()) {
      if (details.length < 2) continue;
      for (let i = 0; i < details.length; i++) {
        for (let j = i + 1; j < details.length; j++) {
          const d1 = details[i];
          const d2 = details[j];

          const isRoomClash = d1.idRuangan === d2.idRuangan;
          const isDosenClash = d1.idDosen === d2.idDosen;
          const isSemesterClash = d1.mataKuliah?.idProdi === d2.mataKuliah?.idProdi && 
                                d1.mataKuliah?.semester === d2.mataKuliah?.semester;

          if (isRoomClash || isDosenClash || isSemesterClash) {
            conflictCount++;
          }
        }
      }
    }

    // Status logic: FINAL is permanent (never downgraded), DRAFT can be promoted to FINAL
    let newStatus = currentMaster?.status || StatusJadwal.DRAFT;
    if (newStatus !== StatusJadwal.FINAL && conflictCount === 0) {
      newStatus = StatusJadwal.FINAL;
    }

    await prisma.jadwalMaster.update({
      where: { id: masterId },
      data: { status: newStatus, conflictCount }
    });

    res.json(updatedMaster?.jadwalDetail[0]);
  } catch (error) {
    console.error("Update slot error:", error);
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

export async function bulkDeleteSchedules(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ID jadwal tidak valid" });
      return;
    }
    await prisma.jadwalMaster.deleteMany({ where: { id: { in: ids } } });
    res.json({ message: `${ids.length} jadwal berhasil dihapus` });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
