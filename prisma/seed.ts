import "dotenv/config";
import pkg from "../generated/prisma/index.js";
const { PrismaClient, Hari, Role, StatusPreferensi } = pkg;
import bcrypt from "bcryptjs";
import { fakerID_ID as faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Memulai proses seeding database CBGA (University Scale)...\n");
  console.log("🧹 Membersihkan data lama...");
  await prisma.jadwalDetail.deleteMany({});
  await prisma.preferensiWaktuDosen.deleteMany({});
  await prisma.slotWaktu.deleteMany({});
  await prisma.ruangan.deleteMany({});
  await prisma.gedung.deleteMany({});
  await prisma.dosen.deleteMany({});
  await prisma.mataKuliah.deleteMany({});

  // ============================================================
  // 1. FAKULTAS
  // ============================================================
  console.log("📌 Seeding Fakultas...");
  const fkt = await prisma.fakultas.upsert({
    where: { namaFakultas: "Universitas Pahlawan" }, // Contoh default fakultas
    update: {},
    create: { namaFakultas: "Universitas Pahlawan" },
  });
  console.log("   ✅ Fakultas created");

  // ============================================================
  // 2. PRODI
  // ============================================================
  console.log("📌 Seeding 19 Prodi...");
  const daftarProdi = [
    { nama: "Teknik Informatika", kode: "TIF" },
    { nama: "Sistem Informasi", kode: "SIF" },
    { nama: "Teknik Sipil", kode: "TSP" },
    { nama: "Teknik Mesin", kode: "TMS" },
    { nama: "Teknik Elektro", kode: "TEL" },
    { nama: "Teknik Industri", kode: "TIN" },
    { nama: "Hukum", kode: "HKM" },
    { nama: "Manajemen", kode: "MNJ" },
    { nama: "Akuntansi", kode: "AKT" },
    { nama: "Kedokteran", kode: "KED" },
    { nama: "Keperawatan", kode: "KEP" },
    { nama: "Kebidanan", kode: "KBD" },
    { nama: "Kesehatan Masyarakat", kode: "KES" },
    { nama: "Farmasi", kode: "FAR" },
    { nama: "Gizi", kode: "GIZ" },
    { nama: "Pendidikan Guru Sekolah Dasar", kode: "PGSD" },
    { nama: "Pendidikan Bahasa Inggris", kode: "PBI" },
    { nama: "Ilmu Komunikasi", kode: "IKM" },
    { nama: "Psikologi", kode: "PSI" },
  ];

  const createdProdis = [];
  for (const p of daftarProdi) {
    const prodi = await prisma.prodi.upsert({
      where: { kodeProdi: p.kode },
      update: {},
      create: {
        namaProdi: p.nama,
        kodeProdi: p.kode,
        idFakultas: fkt.id,
      },
    });
    createdProdis.push(prodi);
  }
  console.log(`   ✅ ${createdProdis.length} Prodi created`);

  // ============================================================
  // 3. USERS
  // ============================================================
  console.log("📌 Seeding Users...");
  const hashedPassword = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { username: "admin_pjpjk" },
    update: {},
    create: {
      username: "admin_pjpjk",
      email: "admin_pjpjk@univ-pahlawan.ac.id",
      password: hashedPassword,
      role: Role.PJPJK,
    },
  });

  for (const prodi of createdProdis) {
    const username = `prodi_${prodi.kodeProdi.toLowerCase()}`;
    await prisma.user.upsert({
      where: { username: username },
      update: {},
      create: {
        username: username,
        email: `${username}@univ-pahlawan.ac.id`,
        password: hashedPassword,
        role: Role.PRODI,
        idProdi: prodi.id,
      },
    });
  }
  console.log("   ✅ Users admin & prodi created");

  // ============================================================
  // 4. SLOT WAKTU
  // ============================================================
  console.log("📌 Seeding Slot Waktu...");
  const hariKerja: Hari[] = [Hari.Senin, Hari.Selasa, Hari.Rabu, Hari.Kamis, Hari.Jumat, Hari.Sabtu];
  const sesiNormal = [
    { mulai: "07:30", selesai: "08:20" }, // Sesi 1
    { mulai: "08:20", selesai: "09:10" }, // Sesi 2
    { mulai: "09:10", selesai: "10:00" }, // Sesi 3
    { mulai: "10:00", selesai: "10:50" }, // Sesi 4
    { mulai: "10:50", selesai: "11:40" }, // Sesi 5
    { mulai: "11:40", selesai: "12:30" }, // Sesi 6
    // Istirahat 12:30 - 13:30
    { mulai: "13:30", selesai: "14:20" }, // Sesi 7
    { mulai: "14:20", selesai: "15:10" }, // Sesi 8
    { mulai: "15:10", selesai: "16:00" }, // Sesi 9
    { mulai: "16:00", selesai: "16:50" }, // Sesi 10
    { mulai: "16:50", selesai: "17:40" }, // Sesi 11
  ];

  const slots: any[] = [];
  for (const hari of hariKerja) {
    for (const sesi of sesiNormal) {
      if (hari === Hari.Jumat && sesi.mulai === "11:40") {
        continue; // Kosongkan sesi 6 khusus hari Jumat (Jumatan)
      }
      const s = await prisma.slotWaktu.upsert({
        where: { hari_jamMulai_jamSelesai: { hari, jamMulai: sesi.mulai, jamSelesai: sesi.selesai } },
        update: {},
        create: { hari, jamMulai: sesi.mulai, jamSelesai: sesi.selesai },
      });
      slots.push(s);
    }
  }
  console.log(`   ✅ ${slots.length} slot waktu created`);

  // ============================================================
  // 5. GEDUNG & RUANGAN
  // ============================================================
  console.log("📌 Seeding Gedung & Ruangan...");
  await prisma.jadwalDetail.deleteMany({});
  await prisma.ruangan.deleteMany({});
  await prisma.gedung.deleteMany({});

  const gedungC = await prisma.gedung.create({ data: { namaGedung: "Gedung C" } });
  const gedungE = await prisma.gedung.create({ data: { namaGedung: "Gedung E" } });
  const gedungR = await prisma.gedung.create({ data: { namaGedung: "Gedung Rektorat" } });

  const ruanganData = [];

  // Gedung C: 3 lantai, 6 ruangan per lantai = 18
  for (let lantai = 1; lantai <= 3; lantai++) {
    for (let ruang = 1; ruang <= 4; ruang++) {
      const ruangNum = ruang < 10 ? `0${ruang}` : `${ruang}`;
      ruanganData.push({ namaRuangan: `R. C${lantai}${ruangNum}`, idGedung: gedungC.id, kapasitas: faker.helpers.arrayElement([30, 40, 50]) });
    }
  }

  // Gedung E: 2 lantai, 10 ruangan per lantai = 20
  for (let lantai = 1; lantai <= 2; lantai++) {
    for (let ruang = 1; ruang <= 9; ruang++) {
      const ruangNum = ruang < 10 ? `0${ruang}` : `${ruang}`;
      ruanganData.push({ namaRuangan: `R. E${lantai}${ruangNum}`, idGedung: gedungE.id, kapasitas: faker.helpers.arrayElement([30, 40, 50]) });
    }
  }

  // Gedung Rektorat: 2 ruangan = 2
  // Total = 12 + 18 + 2 = 32
  ruanganData.push({ namaRuangan: "Aula Rektorat", idGedung: gedungR.id, kapasitas: 100 });
  ruanganData.push({ namaRuangan: "Ruang Sidang Utama", idGedung: gedungR.id, kapasitas: 50 });

  await prisma.ruangan.createMany({ data: ruanganData });
  console.log(`   ✅ ${ruanganData.length} Ruangan di 3 Gedung created`);

  // ============================================================
  // 6. DOSEN
  // ============================================================
  console.log("📌 Seeding Dosen...");
  await prisma.preferensiWaktuDosen.deleteMany({});
  await prisma.dosen.deleteMany({});
  
  const dosenDataToInsert = [];
  let nidnCounter = 100000;
  for (const prodi of createdProdis) {
    // 20 dosen per prodi (puluhan dosen)
    for (let i = 0; i < 20; i++) {
      dosenDataToInsert.push({
        nidn: (nidnCounter++).toString(),
        namaDosen: `${faker.person.firstName()} ${faker.person.lastName()}, ${faker.helpers.arrayElement(['M.Kom.', 'M.T.', 'M.Si.', 'Ph.D.', 'M.Pd.', 'M.M.', 'M.Kes.'])}`,
        idProdi: prodi.id
      });
    }
  }
  await prisma.dosen.createMany({ data: dosenDataToInsert });
  console.log(`   ✅ ${dosenDataToInsert.length} Dosen created`);

  // ============================================================
  // 6.5. PREFERENSI WAKTU DOSEN (Termasuk Sabtu)
  // ============================================================
  console.log("📌 Seeding Preferensi Waktu Dosen...");
  const allDosen = await prisma.dosen.findMany();
  const allSlots = await prisma.slotWaktu.findMany();
  
  const sabtuSlots = allSlots.filter(s => s.hari === Hari.Sabtu);
  const otherSlots = allSlots.filter(s => s.hari !== Hari.Sabtu);
  
  const preferensiData = [];
  
  for (const d of allDosen) {
    // 70% dosen tidak bersedia mengajar di hari Sabtu
    if (Math.random() < 0.70) {
      for (const slot of sabtuSlots) {
        preferensiData.push({
          idDosen: d.id,
          idSlotWaktu: slot.id,
          status: StatusPreferensi.UNAVAILABLE
        });
      }
    } else {
      // Sisanya mungkin tidak bisa di 1 atau 2 sesi pada hari Sabtu
      const randomSabtu = faker.helpers.arrayElements(sabtuSlots, faker.number.int({ min: 1, max: 2 }));
      for (const slot of randomSabtu) {
        preferensiData.push({
          idDosen: d.id,
          idSlotWaktu: slot.id,
          status: StatusPreferensi.UNAVAILABLE
        });
      }
    }
    
    // Constraint tambahan: 2-4 slot di hari biasa mereka juga tidak bisa mengajar
    const randomOther = faker.helpers.arrayElements(otherSlots, faker.number.int({ min: 2, max: 4 }));
    for (const slot of randomOther) {
      preferensiData.push({
        idDosen: d.id,
        idSlotWaktu: slot.id,
        status: StatusPreferensi.UNAVAILABLE
      });
    }
  }
  
  await prisma.preferensiWaktuDosen.createMany({ data: preferensiData });
  console.log(`   ✅ ${preferensiData.length} Preferensi Waktu Dosen (UNAVAILABLE) created.`);

  // ============================================================
  // 7. MATA KULIAH
  // ============================================================
  console.log("📌 Seeding Mata Kuliah...");
  await prisma.mataKuliah.deleteMany({});
  const matkulDataToInsert = [];

  for (const prodi of createdProdis) {
    // 30 matkul per prodi (puluhan matkul)
    for (let i = 1; i <= 30; i++) {
      const semester = faker.number.int({ min: 1, max: 8 });
      const mkPrefix = ['Pengantar', 'Sistem', 'Dasar-dasar', 'Teori', 'Praktikum', 'Aplikasi', 'Manajemen', 'Analisis', 'Metodologi', 'Seminar'];
      const mkPrefixStr = faker.helpers.arrayElement(mkPrefix);
      matkulDataToInsert.push({
        kodeMk: `${prodi.kodeProdi}${100 + i}`,
        namaMk: `${mkPrefixStr} ${faker.commerce.department()} ${i}`,
        sks: faker.helpers.arrayElement([2, 3, 4]),
        semester: semester,
        jumlahMhs: faker.number.int({ min: 15, max: 45 }),
        idProdi: prodi.id
      });
    }
  }
  await prisma.mataKuliah.createMany({ data: matkulDataToInsert });
  console.log(`   ✅ ${matkulDataToInsert.length} Mata Kuliah created`);

  console.log("\n🎉 Seeding selesai! Sistem siap digunakan dalam skala universitas.");
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
