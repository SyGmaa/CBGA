/*
  Warnings:

  - You are about to drop the column `id_user_prodi` on the `mata_kuliah` table. All the data in the column will be lost.
  - You are about to drop the column `nama_gedung` on the `ruangan` table. All the data in the column will be lost.
  - Added the required column `id_prodi` to the `mata_kuliah` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_gedung` to the `ruangan` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "mata_kuliah" DROP CONSTRAINT "mata_kuliah_id_user_prodi_fkey";

-- AlterTable
ALTER TABLE "dosen" ADD COLUMN     "id_prodi" INTEGER;

-- AlterTable
ALTER TABLE "mata_kuliah" DROP COLUMN "id_user_prodi",
ADD COLUMN     "id_prodi" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ruangan" DROP COLUMN "nama_gedung",
ADD COLUMN     "id_gedung" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "id_prodi" INTEGER;

-- CreateTable
CREATE TABLE "fakultas" (
    "id" SERIAL NOT NULL,
    "nama_fakultas" TEXT NOT NULL,

    CONSTRAINT "fakultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prodi" (
    "id" SERIAL NOT NULL,
    "nama_prodi" TEXT NOT NULL,
    "kode_prodi" TEXT NOT NULL,
    "id_fakultas" INTEGER NOT NULL,

    CONSTRAINT "prodi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gedung" (
    "id" SERIAL NOT NULL,
    "nama_gedung" TEXT NOT NULL,

    CONSTRAINT "gedung_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fakultas_nama_fakultas_key" ON "fakultas"("nama_fakultas");

-- CreateIndex
CREATE UNIQUE INDEX "prodi_kode_prodi_key" ON "prodi"("kode_prodi");

-- CreateIndex
CREATE UNIQUE INDEX "gedung_nama_gedung_key" ON "gedung"("nama_gedung");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_id_prodi_fkey" FOREIGN KEY ("id_prodi") REFERENCES "prodi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prodi" ADD CONSTRAINT "prodi_id_fakultas_fkey" FOREIGN KEY ("id_fakultas") REFERENCES "fakultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruangan" ADD CONSTRAINT "ruangan_id_gedung_fkey" FOREIGN KEY ("id_gedung") REFERENCES "gedung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mata_kuliah" ADD CONSTRAINT "mata_kuliah_id_prodi_fkey" FOREIGN KEY ("id_prodi") REFERENCES "prodi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dosen" ADD CONSTRAINT "dosen_id_prodi_fkey" FOREIGN KEY ("id_prodi") REFERENCES "prodi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
