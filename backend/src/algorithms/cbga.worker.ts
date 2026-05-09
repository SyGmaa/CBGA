// ============================================================
// CBGA WORKER THREAD
// Runs the Genetic Algorithm in a separate thread
// Communicates progress via parentPort messages
// ============================================================

import { parentPort, workerData } from "worker_threads";
import {
  calculateFitness,
  type Kromosom,
  type PreferensiMap,
  type FitnessResult,
} from "./fitness.ts";
import {
  tournamentSelection,
  hybridCrossover,
  mutate,
  repairKromosom,
  generateRandomKromosom,
} from "./operators.ts";

// ============================================================
// Worker Data Interface
// ============================================================
interface WorkerInput {
  matkulDosenPairs: {
    idMatkul: number;
    idDosen: number;
    idProdi: number;
    semester: number;
    jumlahMhs: number;
    sks: number;
  }[];
  allRuanganIds: number[];
  allSlotWaktu: { id: number; hari: string; jamMulai: string; jamSelesai: string }[];
  ruanganKapasitasMap: [number, number][]; // serialized Map
  preferensiMap: { [dosenId: number]: number[] }; // serialized
  config: {
    populationSize: number;
    maxGenerations: number;
    mutationRate: number;
    crossoverRate: number;
    elitismCount: number;
    tournamentSize: number;
    jumlahJadwal: number;
  };
}

// ============================================================
// Deserialize data from main thread
// ============================================================
const input: WorkerInput = workerData;

const ruanganKapasitasMap = new Map<number, number>(input.ruanganKapasitasMap);
const preferensiMap: PreferensiMap = {};
for (const [dosenId, slotIds] of Object.entries(input.preferensiMap)) {
  preferensiMap[Number(dosenId)] = new Set(slotIds);
}

const {
  matkulDosenPairs,
  allRuanganIds,
  allSlotWaktu,
  config,
} = input;

// Create slot mapping for fitness calculation
import { type SlotInfo } from "./fitness.ts";
const slotInfoMap = new Map<number, SlotInfo>();
const allSlotIdsOrdered: number[] = [];

allSlotWaktu.forEach((s, index) => {
  slotInfoMap.set(s.id, { id: s.id, hari: s.hari, urutan: index, jamMulai: s.jamMulai, jamSelesai: s.jamSelesai });
  allSlotIdsOrdered.push(s.id);
});

// ============================================================
// Adaptive Parameters
// ============================================================
let currentMutationRate = config.mutationRate;
const MIN_MUTATION_RATE = config.mutationRate;
const MAX_MUTATION_RATE = 0.25;
const STAGNATION_THRESHOLD = 50; // generations without improvement
const IMMIGRATION_RATIO = 0.2; // replace 20% of worst on stagnation

let stagnationCounter = 0;
let lastBestFitness = 0;

// ============================================================
// Initialize Population (Smart Initialization)
// ============================================================
let population: { kromosom: Kromosom; fitness: number; penalty: number; conflictCount: number }[] = [];

for (let i = 0; i < config.populationSize; i++) {
  const kromosom = generateRandomKromosom(
    matkulDosenPairs,
    allRuanganIds,
    allSlotIdsOrdered,
    ruanganKapasitasMap,
    slotInfoMap,
    preferensiMap
  );
  const result = calculateFitness(kromosom, preferensiMap, slotInfoMap, allSlotIdsOrdered);
  population.push({
    kromosom,
    fitness: result.fitness,
    penalty: result.penalty,
    conflictCount: result.conflicts.length,
  });
}

// Sort by fitness (descending)
population.sort((a, b) => b.fitness - a.fitness);

let bestEver = population[0]!;
lastBestFitness = bestEver.fitness;

// ============================================================
// Evolution Loop
// ============================================================
for (let gen = 0; gen < config.maxGenerations; gen++) {
  const newPopulation: typeof population = [];

  // Elitism: keep top N
  for (let i = 0; i < config.elitismCount && i < population.length; i++) {
    newPopulation.push(population[i]!);
  }

  // Fill rest with crossover + mutation + repair
  while (newPopulation.length < config.populationSize) {
    const parent1 = tournamentSelection(population, config.tournamentSize);
    const parent2 = tournamentSelection(population, config.tournamentSize);

    let child1: Kromosom;
    let child2: Kromosom;

    if (Math.random() < config.crossoverRate) {
      [child1, child2] = hybridCrossover(parent1, parent2);
    } else {
      child1 = parent1.map((g) => ({ ...g }));
      child2 = parent2.map((g) => ({ ...g }));
    }

    // Conflict-directed mutation with adaptive rate
    child1 = mutate(child1, allRuanganIds, allSlotIdsOrdered, ruanganKapasitasMap, currentMutationRate, slotInfoMap, preferensiMap);
    child2 = mutate(child2, allRuanganIds, allSlotIdsOrdered, ruanganKapasitasMap, currentMutationRate, slotInfoMap, preferensiMap);

    // Repair operator — fix hard constraints via local search
    child1 = repairKromosom(child1, allRuanganIds, allSlotIdsOrdered, ruanganKapasitasMap, slotInfoMap, preferensiMap);
    child2 = repairKromosom(child2, allRuanganIds, allSlotIdsOrdered, ruanganKapasitasMap, slotInfoMap, preferensiMap);

    const result1 = calculateFitness(child1, preferensiMap, slotInfoMap, allSlotIdsOrdered);
    const result2 = calculateFitness(child2, preferensiMap, slotInfoMap, allSlotIdsOrdered);

    newPopulation.push({
      kromosom: child1,
      fitness: result1.fitness,
      penalty: result1.penalty,
      conflictCount: result1.conflicts.length,
    });

    if (newPopulation.length < config.populationSize) {
      newPopulation.push({
        kromosom: child2,
        fitness: result2.fitness,
        penalty: result2.penalty,
        conflictCount: result2.conflicts.length,
      });
    }
  }

  population = newPopulation;
  population.sort((a, b) => b.fitness - a.fitness);

  const currentBest = population[0]!;
  if (currentBest.fitness > bestEver.fitness) {
    bestEver = currentBest;
  }

  // ============================================================
  // Adaptive Mutation Rate & Stagnation Handling
  // ============================================================
  if (bestEver.fitness > lastBestFitness) {
    // Improvement found — decrease mutation rate
    lastBestFitness = bestEver.fitness;
    stagnationCounter = 0;
    currentMutationRate = Math.max(MIN_MUTATION_RATE, currentMutationRate * 0.9);
  } else {
    stagnationCounter++;
    // Gradually increase mutation rate during stagnation
    currentMutationRate = Math.min(MAX_MUTATION_RATE, currentMutationRate * 1.05);
  }

  // Immigration: replace worst 20% with fresh smart-initialized chromosomes
  if (stagnationCounter > 0 && stagnationCounter % STAGNATION_THRESHOLD === 0) {
    const immigrantCount = Math.floor(config.populationSize * IMMIGRATION_RATIO);
    for (let i = 0; i < immigrantCount; i++) {
      const replaceIdx = config.populationSize - 1 - i;
      if (replaceIdx <= config.elitismCount) break; // Don't replace elite

      const newKromosom = generateRandomKromosom(
        matkulDosenPairs,
        allRuanganIds,
        allSlotIdsOrdered,
        ruanganKapasitasMap,
        slotInfoMap,
        preferensiMap
      );
      const repairedKromosom = repairKromosom(newKromosom, allRuanganIds, allSlotIdsOrdered, ruanganKapasitasMap, slotInfoMap, preferensiMap);
      const result = calculateFitness(repairedKromosom, preferensiMap, slotInfoMap, allSlotIdsOrdered);
      population[replaceIdx] = {
        kromosom: repairedKromosom,
        fitness: result.fitness,
        penalty: result.penalty,
        conflictCount: result.conflicts.length,
      };
    }

    population.sort((a, b) => b.fitness - a.fitness);
    const newBest = population[0]!;
    if (newBest.fitness > bestEver.fitness) {
      bestEver = newBest;
    }
  }

  // Report progress every 10 generations
  if (gen % 10 === 0 || gen === config.maxGenerations - 1) {
    parentPort?.postMessage({
      type: "progress",
      data: {
        generasi: gen + 1,
        maxGenerasi: config.maxGenerations,
        bestFitness: bestEver.fitness,
        bestPenalty: bestEver.penalty,
        conflictCount: bestEver.conflictCount,
        currentFitness: currentBest.fitness,
        mutationRate: currentMutationRate,
        stagnation: stagnationCounter,
        status: bestEver.fitness === 1 ? "Optimal ditemukan!" : "Evolusi...",
      },
    });
  }

  // Early termination if perfect solution found
  if (bestEver.fitness === 1) {
    break;
  }
}


// ============================================================
// Final Result
// ============================================================
const uniqueResults: typeof population = [];
const seen = new Set<string>();
for (const ind of population) {
  const hash = ind.kromosom.map(g => `${g.idMatkul}-${g.idDosen}-${g.idRuangan}-${g.idSlotWaktu}`).join('|');
  if (!seen.has(hash)) {
    seen.add(hash);
    uniqueResults.push(ind);
  }
  if (uniqueResults.length >= config.jumlahJadwal) break;
}

while(uniqueResults.length < config.jumlahJadwal && population.length > 0) {
    uniqueResults.push(population[0]!);
}

const topResults = uniqueResults.map(ind => {
  const res = calculateFitness(ind.kromosom, preferensiMap, slotInfoMap, allSlotIdsOrdered);
  return {
    kromosom: ind.kromosom,
    fitness: res.fitness,
    penalty: res.penalty,
    conflicts: res.conflicts,
  };
});


parentPort?.postMessage({
  type: "completed",
  data: {
    results: topResults
  },
});
