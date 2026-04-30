// ============================================================
// CBGA FITNESS FUNCTION
// Menghitung fitness berdasarkan penalty constraints
// ============================================================

export interface Gen {
  idMatkul: number;
  idDosen: number;
  idRuangan: number;
  idSlotWaktu: number; // Starting slot
  sks: number;        // Number of slots
  // Metadata for constraint checking
  idProdi: number;
  semester: number;
  jumlahMhs: number;
  kapasitasRuangan: number;
}

export type Kromosom = Gen[];

export interface SlotInfo {
  id: number;
  hari: string;
  urutan: number; // Order in the day
  jamMulai: string; // e.g. "10:50"
  jamSelesai: string; // e.g. "11:40"
}

export interface PreferensiMap {
  [dosenId: number]: Set<number>; // set of unavailable slotWaktu IDs
}

export interface FitnessResult {
  fitness: number;
  penalty: number;
  conflicts: ConflictDetail[];
}

export interface ConflictDetail {
  type: "DOSEN_CLASH" | "RUANGAN_CLASH" | "SEMESTER_CLASH" | "KAPASITAS" | "PREFERENSI" | "DAY_OVERFLOW" | "BREAK_CROSSING";
  genIndex1: number;
  genIndex2?: number;
  message: string;
}

export function calculateFitness(
  kromosom: Kromosom,
  preferensiMap: PreferensiMap,
  slotInfoMap: Map<number, SlotInfo>,
  allSlotIdsOrdered: number[]
): FitnessResult {
  let penalty = 0;
  const conflicts: ConflictDetail[] = [];

  // Usage maps to detect clashes in O(N)
  // Key: `${type}_${resourceId}_${slotId}`
  const usageMap = new Map<string, number>(); 

  // Pre-calculate occupied slots for all genes
  const allOccupied = kromosom.map(gen => {
    const startIndex = allSlotIdsOrdered.indexOf(gen.idSlotWaktu);
    if (startIndex === -1) return [gen.idSlotWaktu];
    return allSlotIdsOrdered.slice(startIndex, startIndex + gen.sks);
  });

  for (let i = 0; i < kromosom.length; i++) {
    const gen = kromosom[i]!;
    const occupied = allOccupied[i]!;
    const startSlot = slotInfoMap.get(gen.idSlotWaktu);

    // 1. Kapasitas
    if (gen.kapasitasRuangan < gen.jumlahMhs) {
      penalty += 50;
      conflicts.push({ type: "KAPASITAS", genIndex1: i, message: `MK idx ${i}: kapasitas ruangan terlalu kecil` });
    }

    // 2. Day Overflow
    if (occupied.length < gen.sks) {
      penalty += 100;
      conflicts.push({ type: "DAY_OVERFLOW", genIndex1: i, message: `MK idx ${i}: durasi melebihi slot tersedia` });
    } else if (startSlot) {
      const lastSlot = slotInfoMap.get(occupied[occupied.length - 1]!);
      if (lastSlot && lastSlot.hari !== startSlot.hari) {
        penalty += 100;
        conflicts.push({ type: "DAY_OVERFLOW", genIndex1: i, message: `MK idx ${i}: durasi melompati hari` });
      }
    }

    // 2b. Break Crossing — jadwal tidak boleh melewati jam istirahat
    // Cek apakah slot-slot yang berurutan benar-benar kontinu (jamSelesai slot N == jamMulai slot N+1)
    if (occupied.length > 1) {
      for (let k = 0; k < occupied.length - 1; k++) {
        const currentSlotInfo = slotInfoMap.get(occupied[k]!);
        const nextSlotInfo = slotInfoMap.get(occupied[k + 1]!);
        if (currentSlotInfo && nextSlotInfo) {
          // Jika jamSelesai slot saat ini != jamMulai slot berikutnya, berarti ada break di antaranya
          if (currentSlotInfo.jamSelesai !== nextSlotInfo.jamMulai) {
            penalty += 100;
            conflicts.push({
              type: "BREAK_CROSSING",
              genIndex1: i,
              message: `MK idx ${i}: jadwal melewati jam istirahat (${currentSlotInfo.jamSelesai} -> ${nextSlotInfo.jamMulai})`
            });
            break; // Satu pelanggaran per gen sudah cukup
          }
        }
      }
    }

    // 3. Preferensi Dosen
    const unavailableSlots = preferensiMap[gen.idDosen];
    if (unavailableSlots) {
      for (const slotId of occupied) {
        if (unavailableSlots.has(slotId)) {
          penalty += 10;
          conflicts.push({ type: "PREFERENSI", genIndex1: i, message: `MK idx ${i}: dosen tidak bersedia` });
          break;
        }
      }
    }

    // 4. Resource Clashes (Room, Dosen, Semester)
    for (const slotId of occupied) {
      // Check Dosen
      const dosenKey = `d_${gen.idDosen}_${slotId}`;
      if (usageMap.has(dosenKey)) {
        penalty += 100;
        conflicts.push({ type: "DOSEN_CLASH", genIndex1: i, genIndex2: usageMap.get(dosenKey), message: `Dosen bentrok di slot ${slotId}` });
      } else {
        usageMap.set(dosenKey, i);
      }

      // Check Ruangan
      const ruangKey = `r_${gen.idRuangan}_${slotId}`;
      if (usageMap.has(ruangKey)) {
        penalty += 100;
        conflicts.push({ type: "RUANGAN_CLASH", genIndex1: i, genIndex2: usageMap.get(ruangKey), message: `Ruangan bentrok di slot ${slotId}` });
      } else {
        usageMap.set(ruangKey, i);
      }

      // Check Semester
      const semKey = `s_${gen.idProdi}_${gen.semester}_${slotId}`;
      if (usageMap.has(semKey)) {
        penalty += 100;
        conflicts.push({ type: "SEMESTER_CLASH", genIndex1: i, genIndex2: usageMap.get(semKey), message: `Semester bentrok di slot ${slotId}` });
      } else {
        usageMap.set(semKey, i);
      }
    }
  }

  const fitness = 1 / (1 + penalty);
  return { fitness, penalty, conflicts };
}


