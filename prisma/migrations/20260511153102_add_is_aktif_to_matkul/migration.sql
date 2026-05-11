-- AlterTable
ALTER TABLE "jadwal_master" ADD COLUMN     "conflict_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "mata_kuliah" ADD COLUMN     "is_aktif" BOOLEAN NOT NULL DEFAULT true;
