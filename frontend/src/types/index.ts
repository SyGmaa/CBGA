// ============================================================
// Shared TypeScript Types for CBGA Frontend
// ============================================================

export type Role = "PRODI" | "PJPJK";
export type Hari = "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu";
export type StatusPreferensi = "AVAILABLE" | "UNAVAILABLE";
export type SemesterTipe = "Ganjil" | "Genap";
export type StatusJadwal = "DRAFT" | "GENERATING" | "FINAL";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  idProdi?: number;
  prodi?: Prodi;
}

export interface Fakultas {
  id: number;
  namaFakultas: string;
}

export interface Prodi {
  id: number;
  namaProdi: string;
  kodeProdi: string;
  idFakultas: number;
  fakultas?: Fakultas;
}

export interface SlotWaktu {
  id: number;
  hari: Hari;
  jamMulai: string;
  jamSelesai: string;
}

export interface Gedung {
  id: number;
  namaGedung: string;
}

export interface Ruangan {
  id: number;
  namaRuangan: string;
  idGedung: number;
  gedung?: Gedung;
  kapasitas: number;
}

export interface MataKuliah {
  id: number;
  kodeMk: string;
  namaMk: string;
  sks: number;
  semester: number;
  jumlahMhs: number;
  idProdi: number;
  prodi?: Prodi;
}

export interface Dosen {
  id: number;
  nidn: string;
  namaDosen: string;
  idProdi?: number;
  prodi?: Prodi;
  preferensiWaktu?: PreferensiWaktuDosen[];
}

export interface PreferensiWaktuDosen {
  id: number;
  idDosen: number;
  idSlotWaktu: number;
  status: StatusPreferensi;
  dosen?: Dosen;
  slotWaktu?: SlotWaktu;
}

export interface JadwalMaster {
  id: number;
  tahunAkademik: string;
  semesterTipe: SemesterTipe;
  status: StatusJadwal;
  fitnessScore: number | null;
  conflictCount?: number;
  createdAt: string;
  jadwalDetail?: JadwalDetail[];
  _count?: { jadwalDetail: number };
}

export interface JadwalDetail {
  id: number;
  idJadwalMaster: number;
  idMatkul: number;
  idDosen: number;
  idRuangan: number;
  idSlotWaktu: number;
  mataKuliah?: MataKuliah;
  dosen?: Dosen;
  ruangan?: Ruangan;
  slotWaktu?: SlotWaktu;
}

export interface DashboardStats {
  totalMatkul: number;
  totalDosen: number;
  totalRuangan: number;
  totalSlotWaktu: number;
  totalJadwal: number;
  latestJadwal: JadwalMaster | null;
  prodiActivities: { username: string; updatedAt: string }[];
}

export interface GAProgress {
  jadwalMasterId: number;
  generasi: number;
  maxGenerasi: number;
  bestFitness: number;
  bestPenalty: number;
  currentFitness: number;
  status: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
