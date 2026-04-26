import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import prisma from './src/services/prisma.ts';

async function main() {
  const mkList = await prisma.mataKuliah.findMany();
  const ruanganList = await prisma.ruangan.findMany();
  const slotWaktuList = await prisma.slotWaktu.findMany();
  const dosenList = await prisma.dosen.findMany();
  const preferensiList = await prisma.preferensiWaktuDosen.findMany({ where: { status: "UNAVAILABLE" } });

  const masters = await prisma.$transaction([
    prisma.jadwalMaster.create({ data: { tahunAkademik: 'Test', semesterTipe: 'Ganjil', status: 'GENERATING' } })
  ]);
  const jadwalMasterId = masters[0].id;

  const matkulDosenPairs = mkList.map((mk) => ({
    idMatkul: mk.id,
    idDosen: dosenList.length > 0 ? dosenList[0].id : 1,
    semester: mk.semester,
    jumlahMhs: mk.jumlahMhs,
  }));

  const ruanganKapasitasMap = Array.from(new Map(ruanganList.map((r) => [r.id, r.kapasitas])).entries());
  const preferensiMap: any = {};
  preferensiList.forEach((p) => {
    if (!preferensiMap[p.idDosen]) preferensiMap[p.idDosen] = [];
    preferensiMap[p.idDosen].push(p.idSlotWaktu);
  });

  const workerPath = path.resolve(process.cwd(), "src/algorithms/cbga.worker.ts");

  const worker = new Worker(workerPath, {
    workerData: {
      matkulDosenPairs,
      allRuanganIds: ruanganList.map((r) => r.id),
      allSlotWaktuIds: slotWaktuList.map((s) => s.id),
      ruanganKapasitasMap,
      preferensiMap,
      config: {
        populationSize: 50,
        maxGenerations: 5,
        mutationRate: 0.03,
        crossoverRate: 0.8,
        elitismCount: 2,
        tournamentSize: 3,
        jumlahJadwal: 1,
      },
    },
    execArgv: ["--import", "tsx"],
  });

  worker.on("message", async (msg: any) => {
    if (msg.type === "completed") {
      try {
        const { results } = msg.data;
        for (let i = 0; i < results.length; i++) {
          const { kromosom, fitness, conflicts } = results[i];
          const masterId = masters[i]?.id;
          if (!masterId) break;

          const detailData = kromosom.map((gen: any) => ({
            idJadwalMaster: masterId,
            idMatkul: gen.idMatkul,
            idDosen: gen.idDosen,
            idRuangan: gen.idRuangan,
            idSlotWaktu: gen.idSlotWaktu,
          }));

          console.log("Detail Data Sample:", detailData[0]);
          await prisma.jadwalDetail.createMany({ data: detailData });
          console.log("Successfully inserted details!");
          process.exit(0);
        }
      } catch (error) {
        console.error("EXACT ERROR:", error);
        process.exit(1);
      }
    }
  });

  worker.on("error", (error) => {
    console.error("WORKER FATAL ERROR:", error);
    process.exit(1);
  });
}

main().catch(console.error);
