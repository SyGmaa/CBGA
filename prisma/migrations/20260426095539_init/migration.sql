-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PRODI', 'PJPJK');

-- CreateEnum
CREATE TYPE "Hari" AS ENUM ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu');

-- CreateEnum
CREATE TYPE "StatusPreferensi" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "SemesterTipe" AS ENUM ('Ganjil', 'Genap');

-- CreateEnum
CREATE TYPE "StatusJadwal" AS ENUM ('DRAFT', 'GENERATING', 'FINAL');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_waktu" (
    "id" SERIAL NOT NULL,
    "hari" "Hari" NOT NULL,
    "jam_mulai" TEXT NOT NULL,
    "jam_selesai" TEXT NOT NULL,

    CONSTRAINT "slot_waktu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruangan" (
    "id" SERIAL NOT NULL,
    "nama_ruangan" TEXT NOT NULL,
    "nama_gedung" TEXT NOT NULL,
    "kapasitas" INTEGER NOT NULL,

    CONSTRAINT "ruangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mata_kuliah" (
    "id" SERIAL NOT NULL,
    "kode_mk" TEXT NOT NULL,
    "nama_mk" TEXT NOT NULL,
    "sks" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "jumlah_mhs" INTEGER NOT NULL,
    "id_user_prodi" INTEGER NOT NULL,

    CONSTRAINT "mata_kuliah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dosen" (
    "id" SERIAL NOT NULL,
    "nidn" TEXT NOT NULL,
    "nama_dosen" TEXT NOT NULL,

    CONSTRAINT "dosen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferensi_waktu_dosen" (
    "id" SERIAL NOT NULL,
    "id_dosen" INTEGER NOT NULL,
    "id_slot_waktu" INTEGER NOT NULL,
    "status" "StatusPreferensi" NOT NULL,

    CONSTRAINT "preferensi_waktu_dosen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal_master" (
    "id" SERIAL NOT NULL,
    "tahun_akademik" TEXT NOT NULL,
    "semester_tipe" "SemesterTipe" NOT NULL,
    "status" "StatusJadwal" NOT NULL DEFAULT 'DRAFT',
    "fitness_score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jadwal_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal_detail" (
    "id" SERIAL NOT NULL,
    "id_jadwal_master" INTEGER NOT NULL,
    "id_matkul" INTEGER NOT NULL,
    "id_dosen" INTEGER NOT NULL,
    "id_ruangan" INTEGER NOT NULL,
    "id_slot_waktu" INTEGER NOT NULL,

    CONSTRAINT "jadwal_detail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "slot_waktu_hari_jam_mulai_jam_selesai_key" ON "slot_waktu"("hari", "jam_mulai", "jam_selesai");

-- CreateIndex
CREATE UNIQUE INDEX "mata_kuliah_kode_mk_key" ON "mata_kuliah"("kode_mk");

-- CreateIndex
CREATE UNIQUE INDEX "dosen_nidn_key" ON "dosen"("nidn");

-- CreateIndex
CREATE UNIQUE INDEX "preferensi_waktu_dosen_id_dosen_id_slot_waktu_key" ON "preferensi_waktu_dosen"("id_dosen", "id_slot_waktu");

-- AddForeignKey
ALTER TABLE "mata_kuliah" ADD CONSTRAINT "mata_kuliah_id_user_prodi_fkey" FOREIGN KEY ("id_user_prodi") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferensi_waktu_dosen" ADD CONSTRAINT "preferensi_waktu_dosen_id_dosen_fkey" FOREIGN KEY ("id_dosen") REFERENCES "dosen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferensi_waktu_dosen" ADD CONSTRAINT "preferensi_waktu_dosen_id_slot_waktu_fkey" FOREIGN KEY ("id_slot_waktu") REFERENCES "slot_waktu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_detail" ADD CONSTRAINT "jadwal_detail_id_jadwal_master_fkey" FOREIGN KEY ("id_jadwal_master") REFERENCES "jadwal_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_detail" ADD CONSTRAINT "jadwal_detail_id_matkul_fkey" FOREIGN KEY ("id_matkul") REFERENCES "mata_kuliah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_detail" ADD CONSTRAINT "jadwal_detail_id_dosen_fkey" FOREIGN KEY ("id_dosen") REFERENCES "dosen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_detail" ADD CONSTRAINT "jadwal_detail_id_ruangan_fkey" FOREIGN KEY ("id_ruangan") REFERENCES "ruangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_detail" ADD CONSTRAINT "jadwal_detail_id_slot_waktu_fkey" FOREIGN KEY ("id_slot_waktu") REFERENCES "slot_waktu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
