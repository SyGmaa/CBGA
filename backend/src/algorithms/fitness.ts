// ============================================================
// CBGA FITNESS FUNCTION
// Menghitung fitness berdasarkan penalty constraints
// ============================================================

export interface Gen {
  idMatkul: number;
  idDosen: number;
  idRuangan: number;
  idSlotWaktu: number;
  // Metadata for constraint checking
  idProdi: number;
  semester: number;
  jumlahMhs: number;
  kapasitasRuangan: number;
}

export type Kromosom = Gen[];

export interface PreferensiMap {
  [dosenId: number]: Set<number>; // set of unavailable slotWaktu IDs
}

export interface FitnessResult {
  fitness: number;
  penalty: number;
  conflicts: ConflictDetail[];
}

export interface ConflictDetail {
  type: "DOSEN_CLASH" | "RUANGAN_CLASH" | "SEMESTER_CLASH" | "KAPASITAS" | "PREFERENSI";
  genIndex1: number;
  genIndex2?: number;
  message: string;
}

export function calculateFitness(
  kromosom: Kromosom,
  preferensiMap: PreferensiMap
): FitnessResult {
  let penalty = 0;
  const conflicts: ConflictDetail[] = [];

  for (let i = 0; i < kromosom.length; i++) {
    const gen1 = kromosom[i]!;

    // === Hard Constraint: Kapasitas ruangan < jumlah mahasiswa ===
    if (gen1.kapasitasRuangan < gen1.jumlahMhs) {
      penalty += 50;
      conflicts.push({
        type: "KAPASITAS",
        genIndex1: i,
        message: `MK idx ${i}: kapasitas ruangan (${gen1.kapasitasRuangan}) < mahasiswa (${gen1.jumlahMhs})`,
      });
    }

    // === Soft Constraint: Melanggar preferensi waktu dosen ===
    const unavailableSlots = preferensiMap[gen1.idDosen];
    if (unavailableSlots && unavailableSlots.has(gen1.idSlotWaktu)) {
      penalty += 10;
      conflicts.push({
        type: "PREFERENSI",
        genIndex1: i,
        message: `MK idx ${i}: dosen ${gen1.idDosen} tidak tersedia di slot ${gen1.idSlotWaktu}`,
      });
    }

    for (let j = i + 1; j < kromosom.length; j++) {
      const gen2 = kromosom[j]!;

      // Only check conflicts on same time slot
      if (gen1.idSlotWaktu !== gen2.idSlotWaktu) continue;

      // === Hard Constraint: Dosen bentrok ===
      if (gen1.idDosen === gen2.idDosen) {
        penalty += 100;
        conflicts.push({
          type: "DOSEN_CLASH",
          genIndex1: i,
          genIndex2: j,
          message: `Dosen ${gen1.idDosen} bentrok di slot ${gen1.idSlotWaktu}`,
        });
      }

      // === Hard Constraint: Ruangan bentrok ===
      if (gen1.idRuangan === gen2.idRuangan) {
        penalty += 100;
        conflicts.push({
          type: "RUANGAN_CLASH",
          genIndex1: i,
          genIndex2: j,
          message: `Ruangan ${gen1.idRuangan} bentrok di slot ${gen1.idSlotWaktu}`,
        });
      }

      // === Hard Constraint: Mahasiswa prodi & semester sama bentrok ===
      if (gen1.idProdi === gen2.idProdi && gen1.semester === gen2.semester) {
        penalty += 100;
        conflicts.push({
          type: "SEMESTER_CLASH",
          genIndex1: i,
          genIndex2: j,
          message: `Prodi ${gen1.idProdi} Semester ${gen1.semester} bentrok di slot ${gen1.idSlotWaktu}`,
        });
      }
    }
  }

  const fitness = 1 / (1 + penalty);

  return { fitness, penalty, conflicts };
}
