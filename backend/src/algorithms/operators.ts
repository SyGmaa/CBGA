// ============================================================
// GA OPERATORS: Selection, Crossover, Mutation
// ============================================================

import type { Kromosom, Gen } from "./fitness.ts";

/**
 * Tournament Selection
 * Pick `tournamentSize` random individuals, return the best one
 */
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

/**
 * Single Point Crossover
 * Splits two parent chromosomes at a random point and swaps tails
 */
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

/**
 * Random Swap Mutation
 * For each gen, with probability Pm, swap its ruangan or slotWaktu
 * with another random valid value
 */
export function mutate(
  kromosom: Kromosom,
  allRuanganIds: number[],
  allSlotWaktuIds: number[],
  ruanganKapasitasMap: Map<number, number>,
  mutationRate: number = 0.03
): Kromosom {
  return kromosom.map((gen) => {
    if (Math.random() < mutationRate) {
      const mutatedGen = { ...gen };

      // 50% chance: swap ruangan, 50% chance: swap slot waktu
      if (Math.random() < 0.5) {
        const newRuanganId =
          allRuanganIds[Math.floor(Math.random() * allRuanganIds.length)]!;
        mutatedGen.idRuangan = newRuanganId;
        mutatedGen.kapasitasRuangan = ruanganKapasitasMap.get(newRuanganId) || 0;
      } else {
        mutatedGen.idSlotWaktu =
          allSlotWaktuIds[Math.floor(Math.random() * allSlotWaktuIds.length)]!;
      }

      return mutatedGen;
    }
    return { ...gen };
  });
}

/**
 * Generate initial random chromosome
 */
export function generateRandomKromosom(
  matkulDosenPairs: { idMatkul: number; idDosen: number; semester: number; jumlahMhs: number }[],
  allRuanganIds: number[],
  allSlotWaktuIds: number[],
  ruanganKapasitasMap: Map<number, number>
): Kromosom {
  return matkulDosenPairs.map((pair) => {
    const idRuangan =
      allRuanganIds[Math.floor(Math.random() * allRuanganIds.length)]!;
    const idSlotWaktu =
      allSlotWaktuIds[Math.floor(Math.random() * allSlotWaktuIds.length)]!;

    return {
      idMatkul: pair.idMatkul,
      idDosen: pair.idDosen,
      idRuangan,
      idSlotWaktu,
      semester: pair.semester,
      jumlahMhs: pair.jumlahMhs,
      kapasitasRuangan: ruanganKapasitasMap.get(idRuangan) || 0,
    };
  });
}
