import prisma from './src/services/prisma.ts';

async function main() {
  const mk = await prisma.mataKuliah.count();
  const ruang = await prisma.ruangan.count();
  const slot = await prisma.slotWaktu.count();
  const dosen = await prisma.dosen.count();
  const fakultas = await prisma.fakultas.count();
  const prodi = await prisma.prodi.count();
  const gedung = await prisma.gedung.count();
  const user = await prisma.user.count();
  
  console.log({ 
    users: user,
    fakultas, 
    prodi, 
    gedung, 
    dosen, 
    mk, 
    ruangan: ruang, 
    slot 
  });
}

main().catch(console.error).finally(() => process.exit());

