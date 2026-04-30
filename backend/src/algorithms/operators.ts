// ============================================================
// GA OPERATORS: Selection, Crossover, Mutation, Repair
// Upgraded for minimal-conflict schedule generation
// ============================================================

import type { Kromosom, Gen, SlotInfo, PreferensiMap } from "./fitness.ts";

// ============================================================
// Helper: get occupied slot IDs for a gene
// ============================================================
function getOccupiedSlots(gen: Gen, allSlotIdsOrdered: number[]): number[] {
  const startIndex = allSlotIdsOrdered.indexOf(gen.idSlotWaktu);
  if (startIndex === -1) return [gen.idSlotWaktu];
  return allSlotIdsOrdered.slice(startIndex, startIndex + gen.sks);
}

// ============================================================
// Helper: check if a multi-slot assignment is valid
// (same day, no break crossing, contiguous)
// ============================================================
function isValidSlotRange(
  startSlotId: number,
  sks: number,
  allSlotIdsOrdered: number[],
  slotInfoMap: Map<number, SlotInfo>
): boolean {
  const startIndex = allSlotIdsOrdered.indexOf(startSlotId);
  if (startIndex === -1) return false;
  if (startIndex + sks > allSlotIdsOrdered.length) return false;

  const slots: SlotInfo[] = [];
  for (let i = 0; i < sks; i++) {
    const info = slotInfoMap.get(allSlotIdsOrdered[startIndex + i]!);
    if (!info) return false;
    slots.push(info);
  }

  // All slots must be on the same day
  const day = slots[0]!.hari;
  if (!slots.every(s => s.hari === day)) return false;

  // Slots must be contiguous (no break crossing)
  for (let i = 0; i < slots.length - 1; i++) {
    if (slots[i]!.jamSelesai !== slots[i + 1]!.jamMulai) return false;
  }

  return true;
}

// ============================================================
// Helper: get all valid starting slots for a given SKS
// ============================================================
function getValidStartSlots(
  sks: number,
  allSlotIdsOrdered: number[],
  slotInfoMap: Map<number, SlotInfo>
): number[] {
  const valid: number[] = [];
  for (let i = 0; i < allSlotIdsOrdered.length; i++) {
    const slotId = allSlotIdsOrdered[i]!;
    if (isValidSlotRange(slotId, sks, allSlotIdsOrdered, slotInfoMap)) {
      valid.push(slotId);
    }
  }
  return valid;
}

// ============================================================
// Helper: shuffle array in place (Fisher-Yates)
// ============================================================
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ============================================================
// Tournament Selection
// ============================================================
export function tournamentSelection(
  population: { kromosom: Kromosom; fitness: number }[],
  tournamentSize: number = 3
): Kromosom {
  let best: { kromosom: Kromosom; fitness: number } | null = null;

  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    const individual = population[idx]!;
    if (!best || individual.fitness > best.fitness) {
      best = individual;
    }
  }

  return best!.kromosom.map((gen) => ({ ...gen }));
}

// ============================================================
// Single Point Crossover (kept for hybrid use)
// ============================================================
export function singlePointCrossover(
  parent1: Kromosom,
  parent2: Kromosom
): [Kromosom, Kromosom] {
  const length = Math.min(parent1.length, parent2.length);
  const crossoverPoint = Math.floor(Math.random() * (length - 1)) + 1;

  const child1: Kromosom = [
    ...parent1.slice(0, crossoverPoint).map((g) => ({ ...g })),
    ...parent2.slice(crossoverPoint).map((g) => ({ ...g })),
  ];

  const child2: Kromosom = [
    ...parent2.slice(0, crossoverPoint).map((g) => ({ ...g })),
    ...parent1.slice(crossoverPoint).map((g) => ({ ...g })),
  ];

  return [child1, child2];
}

// ============================================================
// Uniform Crossover — better diversity for scheduling
// For each gene, randomly pick from parent1 or parent2
// ============================================================
export function uniformCrossover(
  parent1: Kromosom,
  parent2: Kromosom
): [Kromosom, Kromosom] {
  const length = Math.min(parent1.length, parent2.length);
  const child1: Kromosom = [];
  const child2: Kromosom = [];

  for (let i = 0; i < length; i++) {
    if (Math.random() < 0.5) {
      child1.push({ ...parent1[i]! });
      child2.push({ ...parent2[i]! });
    } else {
      child1.push({ ...parent2[i]! });
      child2.push({ ...parent1[i]! });
    }
  }

  return [child1, child2];
}

// ============================================================
// Hybrid Crossover — 50% single-point, 50% uniform
// ============================================================
export function hybridCrossover(
  parent1: Kromosom,
  parent2: Kromosom
): [Kromosom, Kromosom] {
  if (Math.random() < 0.5) {
    return singlePointCrossover(parent1, parent2);
  }
  return uniformCrossover(parent1, parent2);
}

// ============================================================
// Conflict-Directed Mutation
// Prioritizes mutating genes that have conflicts
// When mutating, tries to pick non-conflicting assignments
// ============================================================
export function mutate(
  kromosom: Kromosom,
  allRuanganIds: number[],
  allSlotWaktuIds: number[],
  ruanganKapasitasMap: Map<number, number>,
  mutationRate: number = 0.05,
  // New optional params for smart mutation
  slotInfoMap?: Map<number, SlotInfo>,
  preferensiMap?: PreferensiMap
): Kromosom {
  // Build usage maps to detect which genes are conflicting
  const dosenSlotUsage = new Map<string, number[]>(); // key -> gene indices
  const ruangSlotUsage = new Map<string, number[]>();
  const semSlotUsage = new Map<string, number[]>();

  for (let i = 0; i < kromosom.length; i++) {
    const gen = kromosom[i]!;
    const occupied = getOccupiedSlots(gen, allSlotWaktuIds);
    for (const slotId of occupied) {
      const dk = `d_${gen.idDosen}_${slotId}`;
      if (!dosenSlotUsage.has(dk)) dosenSlotUsage.set(dk, []);
      dosenSlotUsage.get(dk)!.push(i);

      const rk = `r_${gen.idRuangan}_${slotId}`;
      if (!ruangSlotUsage.has(rk)) ruangSlotUsage.set(rk, []);
      ruangSlotUsage.get(rk)!.push(i);

      const sk = `s_${gen.idProdi}_${gen.semester}_${slotId}`;
      if (!semSlotUsage.has(sk)) semSlotUsage.set(sk, []);
      semSlotUsage.get(sk)!.push(i);
    }
  }

  // Identify conflicting gene indices
  const conflictingGenes = new Set<number>();
  for (const indices of dosenSlotUsage.values()) {
    if (indices.length > 1) indices.forEach(i => conflictingGenes.add(i));
  }
  for (const indices of ruangSlotUsage.values()) {
    if (indices.length > 1) indices.forEach(i => conflictingGenes.add(i));
  }
  for (const indices of semSlotUsage.values()) {
    if (indices.length > 1) indices.forEach(i => conflictingGenes.add(i));
  }

  // Also check kapasitas
  for (let i = 0; i < kromosom.length; i++) {
    if (kromosom[i]!.kapasitasRuangan < kromosom[i]!.jumlahMhs) {
      conflictingGenes.add(i);
    }
  }

  // Pre-compute valid start slots per SKS if slotInfoMap available
  const validStartSlotsCache = new Map<number, number[]>();
  if (slotInfoMap) {
    for (const gen of kromosom) {
      if (!validStartSlotsCache.has(gen.sks)) {
        validStartSlotsCache.set(gen.sks, getValidStartSlots(gen.sks, allSlotWaktuIds, slotInfoMap));
      }
    }
  }

  return kromosom.map((gen, idx) => {
    // Conflicting genes get much higher mutation rate
    const effectiveRate = conflictingGenes.has(idx)
      ? Math.min(mutationRate * 5, 0.8) // Up to 80% for conflicting genes
      : mutationRate;

    if (Math.random() < effectiveRate) {
      const mutatedGen = { ...gen };
      const action = Math.random();

      if (action < 0.4) {
        // Mutate ROOM — prefer rooms with adequate capacity
        const suitableRooms = allRuanganIds.filter(
          rId => (ruanganKapasitasMap.get(rId) || 0) >= gen.jumlahMhs
        );
        const candidates = suitableRooms.length > 0 ? suitableRooms : allRuanganIds;
        const newRuanganId = candidates[Math.floor(Math.random() * candidates.length)]!;
        mutatedGen.idRuangan = newRuanganId;
        mutatedGen.kapasitasRuangan = ruanganKapasitasMap.get(newRuanganId) || 0;
      } else if (action < 0.8) {
        // Mutate SLOT — prefer valid (no break crossing, no overflow) slots
        const validSlots = validStartSlotsCache.get(gen.sks);
        if (validSlots && validSlots.length > 0) {
          // Try to pick a slot that avoids dosen preferensi conflicts
          let bestSlot = validSlots[Math.floor(Math.random() * validSlots.length)]!;

          if (preferensiMap) {
            const unavailable = preferensiMap[gen.idDosen];
            if (unavailable) {
              const preferred = validSlots.filter(sId => {
                const occ = getOccupiedSlots({ ...gen, idSlotWaktu: sId }, allSlotWaktuIds);
                return !occ.some(o => unavailable.has(o));
              });
              if (preferred.length > 0) {
                bestSlot = preferred[Math.floor(Math.random() * preferred.length)]!;
              }
            }
          }

          mutatedGen.idSlotWaktu = bestSlot;
        } else {
          mutatedGen.idSlotWaktu =
            allSlotWaktuIds[Math.floor(Math.random() * allSlotWaktuIds.length)]!;
        }
      } else {
        // Mutate BOTH room and slot
        const suitableRooms = allRuanganIds.filter(
          rId => (ruanganKapasitasMap.get(rId) || 0) >= gen.jumlahMhs
        );
        const candidates = suitableRooms.length > 0 ? suitableRooms : allRuanganIds;
        const newRuanganId = candidates[Math.floor(Math.random() * candidates.length)]!;
        mutatedGen.idRuangan = newRuanganId;
        mutatedGen.kapasitasRuangan = ruanganKapasitasMap.get(newRuanganId) || 0;

        const validSlots = validStartSlotsCache.get(gen.sks);
        if (validSlots && validSlots.length > 0) {
          mutatedGen.idSlotWaktu = validSlots[Math.floor(Math.random() * validSlots.length)]!;
        } else {
          mutatedGen.idSlotWaktu =
            allSlotWaktuIds[Math.floor(Math.random() * allSlotWaktuIds.length)]!;
        }
      }

      return mutatedGen;
    }
    return { ...gen };
  });
}

// ============================================================
// Repair Operator (Local Search)
// Scans for hard-constraint violations and tries to fix them
// ============================================================
export function repairKromosom(
  kromosom: Kromosom,
  allRuanganIds: number[],
  allSlotIdsOrdered: number[],
  ruanganKapasitasMap: Map<number, number>,
  slotInfoMap: Map<number, SlotInfo>,
  preferensiMap: PreferensiMap,
  maxRepairAttempts: number = 3
): Kromosom {
  let current = kromosom.map(g => ({ ...g }));

  // Pre-compute valid start slots per SKS
  const validStartSlotsCache = new Map<number, number[]>();
  for (const gen of current) {
    if (!validStartSlotsCache.has(gen.sks)) {
      validStartSlotsCache.set(gen.sks, getValidStartSlots(gen.sks, allSlotIdsOrdered, slotInfoMap));
    }
  }

  for (let attempt = 0; attempt < maxRepairAttempts; attempt++) {
    // Build usage maps
    const dosenSlots = new Map<string, number[]>();
    const ruangSlots = new Map<string, number[]>();
    const semSlots = new Map<string, number[]>();

    for (let i = 0; i < current.length; i++) {
      const gen = current[i]!;
      const occupied = getOccupiedSlots(gen, allSlotIdsOrdered);
      for (const slotId of occupied) {
        const dk = `d_${gen.idDosen}_${slotId}`;
        if (!dosenSlots.has(dk)) dosenSlots.set(dk, []);
        dosenSlots.get(dk)!.push(i);

        const rk = `r_${gen.idRuangan}_${slotId}`;
        if (!ruangSlots.has(rk)) ruangSlots.set(rk, []);
        ruangSlots.get(rk)!.push(i);

        const sk = `s_${gen.idProdi}_${gen.semester}_${slotId}`;
        if (!semSlots.has(sk)) semSlots.set(sk, []);
        semSlots.get(sk)!.push(i);
      }
    }

    // Find conflicting gene indices
    const conflicting = new Set<number>();
    for (const indices of dosenSlots.values()) {
      if (indices.length > 1) indices.forEach(i => conflicting.add(i));
    }
    for (const indices of ruangSlots.values()) {
      if (indices.length > 1) indices.forEach(i => conflicting.add(i));
    }
    for (const indices of semSlots.values()) {
      if (indices.length > 1) indices.forEach(i => conflicting.add(i));
    }

    // Check kapasitas
    for (let i = 0; i < current.length; i++) {
      if (current[i]!.kapasitasRuangan < current[i]!.jumlahMhs) {
        conflicting.add(i);
      }
    }

    if (conflicting.size === 0) break; // No conflicts, done!

    // Try to fix each conflicting gene
    const conflictArr = shuffle([...conflicting]);
    for (const idx of conflictArr) {
      const gen = current[idx]!;

      // Fix kapasitas first
      if (gen.kapasitasRuangan < gen.jumlahMhs) {
        const suitableRooms = allRuanganIds.filter(
          rId => (ruanganKapasitasMap.get(rId) || 0) >= gen.jumlahMhs
        );
        if (suitableRooms.length > 0) {
          const newRoom = suitableRooms[Math.floor(Math.random() * suitableRooms.length)]!;
          gen.idRuangan = newRoom;
          gen.kapasitasRuangan = ruanganKapasitasMap.get(newRoom) || 0;
        }
      }

      // Try to find a non-conflicting slot+room combo
      const validSlots = validStartSlotsCache.get(gen.sks) || allSlotIdsOrdered;
      const shuffledSlots = shuffle([...validSlots]);
      const suitableRooms = allRuanganIds.filter(
        rId => (ruanganKapasitasMap.get(rId) || 0) >= gen.jumlahMhs
      );
      const rooms = suitableRooms.length > 0 ? suitableRooms : allRuanganIds;

      let fixed = false;
      // Try up to 30 random slot+room combinations
      for (let t = 0; t < Math.min(30, shuffledSlots.length); t++) {
        const candidateSlot = shuffledSlots[t]!;
        const candidateRoom = rooms[Math.floor(Math.random() * rooms.length)]!;

        // Check if this assignment would conflict
        const occupied = getOccupiedSlots({ ...gen, idSlotWaktu: candidateSlot }, allSlotIdsOrdered);
        let hasConflict = false;

        for (const slotId of occupied) {
          // Check dosen clash with other genes
          for (let j = 0; j < current.length; j++) {
            if (j === idx) continue;
            const other = current[j]!;
            const otherOcc = getOccupiedSlots(other, allSlotIdsOrdered);
            if (other.idDosen === gen.idDosen && otherOcc.includes(slotId)) {
              hasConflict = true; break;
            }
            if (other.idRuangan === candidateRoom && otherOcc.includes(slotId)) {
              hasConflict = true; break;
            }
            if (other.idProdi === gen.idProdi && other.semester === gen.semester && otherOcc.includes(slotId)) {
              hasConflict = true; break;
            }
          }
          if (hasConflict) break;
        }

        if (!hasConflict) {
          gen.idSlotWaktu = candidateSlot;
          gen.idRuangan = candidateRoom;
          gen.kapasitasRuangan = ruanganKapasitasMap.get(candidateRoom) || 0;
          fixed = true;
          break;
        }
      }

      // If not fully fixed, at least try a random valid slot
      if (!fixed && shuffledSlots.length > 0) {
        gen.idSlotWaktu = shuffledSlots[Math.floor(Math.random() * shuffledSlots.length)]!;
      }
    }
  }

  return current;
}

// ============================================================
// Smart Initialization — Constraint-Aware Greedy
// Assigns slots and rooms while actively avoiding conflicts
// ============================================================
export function generateRandomKromosom(
  matkulDosenPairs: { idMatkul: number; idDosen: number; idProdi: number; semester: number; jumlahMhs: number; sks: number }[],
  allRuanganIds: number[],
  allSlotWaktuIds: number[],
  ruanganKapasitasMap: Map<number, number>,
  slotInfoMap?: Map<number, SlotInfo>,
  preferensiMap?: PreferensiMap
): Kromosom {
  // If no slotInfoMap, fall back to basic random
  if (!slotInfoMap) {
    return matkulDosenPairs.map((pair) => {
      const idRuangan = allRuanganIds[Math.floor(Math.random() * allRuanganIds.length)]!;
      const idSlotWaktu = allSlotWaktuIds[Math.floor(Math.random() * allSlotWaktuIds.length)]!;
      return {
        idMatkul: pair.idMatkul, idDosen: pair.idDosen, idRuangan, idSlotWaktu,
        sks: pair.sks, idProdi: pair.idProdi, semester: pair.semester,
        jumlahMhs: pair.jumlahMhs, kapasitasRuangan: ruanganKapasitasMap.get(idRuangan) || 0,
      };
    });
  }

  // Pre-compute valid start slots per SKS
  const validStartSlotsCache = new Map<number, number[]>();
  for (const pair of matkulDosenPairs) {
    if (!validStartSlotsCache.has(pair.sks)) {
      validStartSlotsCache.set(pair.sks, getValidStartSlots(pair.sks, allSlotWaktuIds, slotInfoMap));
    }
  }

  // Track used resources: dosen+slot, room+slot, prodi+semester+slot
  const usedDosenSlots = new Set<string>();
  const usedRoomSlots = new Set<string>();
  const usedSemSlots = new Set<string>();

  // Shuffle pair order for diversity across different chromosomes
  const indices = shuffle([...Array(matkulDosenPairs.length).keys()]);
  const result: Gen[] = new Array(matkulDosenPairs.length);

  for (const i of indices) {
    const pair = matkulDosenPairs[i]!;

    // Filter rooms by capacity
    const suitableRooms = allRuanganIds.filter(
      rId => (ruanganKapasitasMap.get(rId) || 0) >= pair.jumlahMhs
    );
    const roomCandidates = suitableRooms.length > 0 ? suitableRooms : allRuanganIds;

    // Get valid start slots
    const validSlots = validStartSlotsCache.get(pair.sks) || allSlotWaktuIds;

    // Try to find a non-conflicting assignment
    const shuffledSlots = shuffle([...validSlots]);
    const shuffledRooms = shuffle([...roomCandidates]);

    let bestSlot = shuffledSlots[0]!;
    let bestRoom = shuffledRooms[0]!;
    let found = false;

    // Try combinations (limit attempts for performance)
    outer:
    for (let si = 0; si < Math.min(shuffledSlots.length, 20); si++) {
      const candidateSlot = shuffledSlots[si]!;
      const occupied = getOccupiedSlots(
        { idSlotWaktu: candidateSlot, sks: pair.sks } as Gen,
        allSlotWaktuIds
      );

      // Check dosen availability
      let dosenFree = true;
      for (const slotId of occupied) {
        if (usedDosenSlots.has(`d_${pair.idDosen}_${slotId}`)) {
          dosenFree = false; break;
        }
      }
      if (!dosenFree) continue;

      // Check semester clash
      let semFree = true;
      for (const slotId of occupied) {
        if (usedSemSlots.has(`s_${pair.idProdi}_${pair.semester}_${slotId}`)) {
          semFree = false; break;
        }
      }
      if (!semFree) continue;

      // Check preferensi
      if (preferensiMap) {
        const unavailable = preferensiMap[pair.idDosen];
        if (unavailable) {
          let prefConflict = false;
          for (const slotId of occupied) {
            if (unavailable.has(slotId)) { prefConflict = true; break; }
          }
          if (prefConflict) continue;
        }
      }

      // Find a free room for these slots
      for (let ri = 0; ri < Math.min(shuffledRooms.length, 10); ri++) {
        const candidateRoom = shuffledRooms[ri]!;
        let roomFree = true;
        for (const slotId of occupied) {
          if (usedRoomSlots.has(`r_${candidateRoom}_${slotId}`)) {
            roomFree = false; break;
          }
        }
        if (roomFree) {
          bestSlot = candidateSlot;
          bestRoom = candidateRoom;
          found = true;
          break outer;
        }
      }
    }

    // Register the chosen slots as used
    const finalOccupied = getOccupiedSlots(
      { idSlotWaktu: bestSlot, sks: pair.sks } as Gen,
      allSlotWaktuIds
    );
    for (const slotId of finalOccupied) {
      usedDosenSlots.add(`d_${pair.idDosen}_${slotId}`);
      usedRoomSlots.add(`r_${bestRoom}_${slotId}`);
      usedSemSlots.add(`s_${pair.idProdi}_${pair.semester}_${slotId}`);
    }

    result[i] = {
      idMatkul: pair.idMatkul,
      idDosen: pair.idDosen,
      idRuangan: bestRoom,
      idSlotWaktu: bestSlot,
      sks: pair.sks,
      idProdi: pair.idProdi,
      semester: pair.semester,
      jumlahMhs: pair.jumlahMhs,
      kapasitasRuangan: ruanganKapasitasMap.get(bestRoom) || 0,
    };
  }

  return result;
}
