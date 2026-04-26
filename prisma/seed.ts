import "dotenv/config";
import { PrismaClient, Hari, Role, StatusPreferensi } from "../generated/prisma/client.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Memulai proses seeding database CBGA...\n");

  // ============================================================
  // 1. USERS
  // ============================================================
  console.log("📌 Seeding Users...");
  const hashedPassword = await bcrypt.hash("password123", 10);

  const adminPjpjk = await prisma.user.upsert({
    where: { username: "admin_pjpjk" },
    update: {},
    create: {
      username: "admin_pjpjk",
      email: "admin_pjpjk@univ-pahlawan.ac.id",
      password: hashedPassword,
      role: Role.PJPJK,
    },
  });

  const prodiTi = await prisma.user.upsert({
    where: { username: "prodi_ti" },
    update: {},
    create: {
      username: "prodi_ti",
      email: "prodi_ti@univ-pahlawan.ac.id",
      password: hashedPassword,
      role: Role.PRODI,
    },
  });

  const prodiSi = await prisma.user.upsert({
    where: { username: "prodi_si" },
    update: {},
    create: {
      username: "prodi_si",
      email: "prodi_si@univ-pahlawan.ac.id",
      password: hashedPassword,
      role: Role.PRODI,
    },
  });

  console.log("   ✅ 3 users created\n");

  // ============================================================
  // 2. SLOT WAKTU (5 hari x 4 sesi = 20 slot)
  // ============================================================
  console.log("📌 Seeding Slot Waktu...");

  const slotData: { hari: Hari; jamMulai: string; jamSelesai: string }[] = [];
  const hariKerja: Hari[] = [Hari.Senin, Hari.Selasa, Hari.Rabu, Hari.Kamis, Hari.Jumat];

  const sesiNormal = [
    { mulai: "08:00", selesai: "09:40" },
    { mulai: "09:40", selesai: "11:20" },
    { mulai: "13:00", selesai: "14:40" },
    { mulai: "14:40", selesai: "16:20" },
  ];

  const sesiJumat = [
    { mulai: "08:00", selesai: "09:40" },
    { mulai: "09:40", selesai: "11:20" },
    { mulai: "14:00", selesai: "15:40" },
    { mulai: "15:40", selesai: "17:20" },
  ];

  for (const hari of hariKerja) {
    const sesiList = hari === Hari.Jumat ? sesiJumat : sesiNormal;
    for (const sesi of sesiList) {
      slotData.push({ hari, jamMulai: sesi.mulai, jamSelesai: sesi.selesai });
    }
  }

  const slots: { id: number; hari: Hari; jamMulai: string; jamSelesai: string }[] = [];
  for (const slot of slotData) {
    const created = await prisma.slotWaktu.upsert({
      where: {
        hari_jamMulai_jamSelesai: {
          hari: slot.hari,
          jamMulai: slot.jamMulai,
          jamSelesai: slot.jamSelesai,
        },
      },
      update: {},
      create: slot,
    });
    slots.push(created);
  }

  console.log(`   ✅ ${slots.length} slot waktu created\n`);

  // ============================================================
  // 3. RUANGAN
  // ============================================================
  console.log("📌 Seeding Ruangan...");

  // Delete existing to avoid duplicates on re-run
  await prisma.jadwalDetail.deleteMany({});
  await prisma.ruangan.deleteMany({});

  const ruanganData = [
    { namaRuangan: "R. 101", namaGedung: "Gedung C", kapasitas: 35 },
    { namaRuangan: "R. 102", namaGedung: "Gedung C", kapasitas: 35 },
    { namaRuangan: "R. 103", namaGedung: "Gedung C", kapasitas: 45 },
    { namaRuangan: "R. 201", namaGedung: "Gedung B", kapasitas: 50 },
    { namaRuangan: "R. 202", namaGedung: "Gedung B", kapasitas: 50 },
    { namaRuangan: "Lab Komputer A", namaGedung: "Gedung C", kapasitas: 25 },
    { namaRuangan: "Lab Komputer B", namaGedung: "Gedung C", kapasitas: 25 },
    { namaRuangan: "Aula Mini", namaGedung: "Gedung Rektorat", kapasitas: 80 },
  ];

  const ruanganList: { id: number }[] = [];
  for (const ruangan of ruanganData) {
    const created = await prisma.ruangan.create({ data: ruangan });
    ruanganList.push(created);
  }

  console.log(`   ✅ ${ruanganList.length} ruangan created\n`);

  // ============================================================
  // 4. DOSEN
  // ============================================================
  console.log("📌 Seeding Dosen...");

  const dosenData = [
    { nidn: "111111", namaDosen: "Dr. Ahmad, M.Kom" },
    { nidn: "222222", namaDosen: "Budi Santoso, M.T" },
    { nidn: "333333", namaDosen: "Citra Lestari, M.Cs" },
    { nidn: "444444", namaDosen: "Dian Ayu, M.Kom" },
    { nidn: "555555", namaDosen: "Eko Prabowo, M.T" },
    { nidn: "666666", namaDosen: "Fahmi Reza, M.Kom" },
    { nidn: "777777", namaDosen: "Gita Savitri, M.Pd" },
  ];

  const dosenList: { id: number; namaDosen: string }[] = [];
  for (const dosen of dosenData) {
    const created = await prisma.dosen.upsert({
      where: { nidn: dosen.nidn },
      update: {},
      create: dosen,
    });
    dosenList.push(created);
  }

  console.log(`   ✅ ${dosenList.length} dosen created\n`);

  // Helper: find dosen by partial name
  const findDosen = (keyword: string) => {
    const d = dosenList.find((d) => d.namaDosen.toLowerCase().includes(keyword.toLowerCase()));
    if (!d) throw new Error(`Dosen "${keyword}" tidak ditemukan`);
    return d;
  };

  // ============================================================
  // 5. MATA KULIAH
  // ============================================================
  console.log("📌 Seeding Mata Kuliah...");

  const matkulData = [
    { kodeMk: "TIF101", namaMk: "Algoritma & Pemrograman", sks: 2, semester: 1, jumlahMhs: 45, prodiId: prodiTi.id },
    { kodeMk: "TIF102", namaMk: "Logika Informatika", sks: 2, semester: 1, jumlahMhs: 45, prodiId: prodiTi.id },
    { kodeMk: "TIF103", namaMk: "Pengantar TI", sks: 2, semester: 1, jumlahMhs: 45, prodiId: prodiTi.id },
    { kodeMk: "TIF104", namaMk: "Bahasa Inggris I", sks: 2, semester: 1, jumlahMhs: 45, prodiId: prodiTi.id },
    { kodeMk: "TIF301", namaMk: "Struktur Data", sks: 2, semester: 3, jumlahMhs: 35, prodiId: prodiTi.id },
    { kodeMk: "TIF302", namaMk: "Pemrograman Web", sks: 2, semester: 3, jumlahMhs: 35, prodiId: prodiTi.id },
    { kodeMk: "TIF303", namaMk: "Basis Data", sks: 2, semester: 3, jumlahMhs: 35, prodiId: prodiTi.id },
    { kodeMk: "TIF304", namaMk: "Jaringan Komputer Dasar", sks: 2, semester: 3, jumlahMhs: 35, prodiId: prodiTi.id },
    { kodeMk: "TIF501", namaMk: "Kecerdasan Buatan", sks: 2, semester: 5, jumlahMhs: 25, prodiId: prodiTi.id },
    { kodeMk: "TIF502", namaMk: "Rekayasa Perangkat Lunak", sks: 2, semester: 5, jumlahMhs: 25, prodiId: prodiTi.id },
    { kodeMk: "TIF503", namaMk: "Pemrograman Mobile", sks: 2, semester: 5, jumlahMhs: 25, prodiId: prodiTi.id },
    { kodeMk: "TIF701", namaMk: "Etika Profesi IT", sks: 2, semester: 7, jumlahMhs: 20, prodiId: prodiTi.id },
    { kodeMk: "TIF702", namaMk: "Metodologi Penelitian", sks: 2, semester: 7, jumlahMhs: 20, prodiId: prodiTi.id },
    { kodeMk: "TIF703", namaMk: "Kewirausahaan", sks: 2, semester: 7, jumlahMhs: 20, prodiId: prodiTi.id },
  ];

  for (const mk of matkulData) {
    await prisma.mataKuliah.upsert({
      where: { kodeMk: mk.kodeMk },
      update: {},
      create: {
        kodeMk: mk.kodeMk,
        namaMk: mk.namaMk,
        sks: mk.sks,
        semester: mk.semester,
        jumlahMhs: mk.jumlahMhs,
        idUserProdi: mk.prodiId,
      },
    });
  }

  console.log(`   ✅ ${matkulData.length} mata kuliah created\n`);

  // ============================================================
  // 6. PREFERENSI WAKTU DOSEN
  // ============================================================
  console.log("📌 Seeding Preferensi Waktu Dosen...");

  const findSlotsByHari = (hari: Hari) => slots.filter((s) => s.hari === hari);
  const findSlotByHariAndSesi = (hari: Hari, sesiIndex: number) => {
    const hariSlots = findSlotsByHari(hari);
    const slot = hariSlots[sesiIndex];
    if (!slot) throw new Error(`Slot sesi ${sesiIndex} hari ${hari} tidak ditemukan`);
    return slot;
  };

  const preferensiData: { idDosen: number; idSlotWaktu: number; status: StatusPreferensi }[] = [];

  // Dr. Ahmad — Senin Pagi (Sesi 1 & 2) → UNAVAILABLE
  const ahmad = findDosen("Ahmad");
  preferensiData.push(
    { idDosen: ahmad.id, idSlotWaktu: findSlotByHariAndSesi(Hari.Senin, 0).id, status: StatusPreferensi.UNAVAILABLE },
    { idDosen: ahmad.id, idSlotWaktu: findSlotByHariAndSesi(Hari.Senin, 1).id, status: StatusPreferensi.UNAVAILABLE }
  );

  // Gita Savitri — Jumat Semua Sesi → UNAVAILABLE
  const gita = findDosen("Gita");
  const jumatSlots = findSlotsByHari(Hari.Jumat);
  for (const slot of jumatSlots) {
    preferensiData.push({ idDosen: gita.id, idSlotWaktu: slot.id, status: StatusPreferensi.UNAVAILABLE });
  }

  // Dian Ayu — Selasa Siang (Sesi 3 & 4) → UNAVAILABLE
  const dian = findDosen("Dian");
  preferensiData.push(
    { idDosen: dian.id, idSlotWaktu: findSlotByHariAndSesi(Hari.Selasa, 2).id, status: StatusPreferensi.UNAVAILABLE },
    { idDosen: dian.id, idSlotWaktu: findSlotByHariAndSesi(Hari.Selasa, 3).id, status: StatusPreferensi.UNAVAILABLE }
  );

  // Eko Prabowo — Kamis Pagi Sesi 1 → UNAVAILABLE
  const eko = findDosen("Eko");
  preferensiData.push(
    { idDosen: eko.id, idSlotWaktu: findSlotByHariAndSesi(Hari.Kamis, 0).id, status: StatusPreferensi.UNAVAILABLE }
  );

  for (const pref of preferensiData) {
    await prisma.preferensiWaktuDosen.upsert({
      where: {
        idDosen_idSlotWaktu: {
          idDosen: pref.idDosen,
          idSlotWaktu: pref.idSlotWaktu,
        },
      },
      update: {},
      create: pref,
    });
  }

  console.log(`   ✅ ${preferensiData.length} preferensi waktu dosen created\n`);

  // ============================================================
  // DONE
  // ============================================================
  console.log("🎉 Seeding selesai! Database siap digunakan.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Users:       3`);
  console.log(`   Slot Waktu:  ${slots.length}`);
  console.log(`   Ruangan:     ${ruanganList.length}`);
  console.log(`   Dosen:       ${dosenList.length}`);
  console.log(`   Mata Kuliah: ${matkulData.length}`);
  console.log(`   Preferensi:  ${preferensiData.length}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
