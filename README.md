# 🎓 CBGA - Course Scheduling Optimizer

> **Optimasi Penjadwalan Mata Kuliah dengan Community-Based Genetic Algorithm**

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Backend-Express.js-green?style=for-the-badge&logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-010101?style=for-the-badge&logo=socket.io)](https://socket.io/)

## 📝 Deskripsi Proyek

**CBGA (Community-Based Genetic Algorithm)** adalah platform cerdas yang dirancang untuk menyelesaikan permasalahan kompleks dalam penjadwalan perkuliahan di universitas. Proyek ini menggabungkan kekuatan algoritma genetika dengan pendekatan berbasis komunitas untuk menghasilkan jadwal yang optimal, meminimalkan konflik ruangan, waktu, serta memenuhi preferensi dosen secara efisien.

---

## ✨ Fitur Utama

- 🤖 **Optimasi Algoritma Genetika**: Menggunakan algoritma genetika tingkat lanjut untuk mencari solusi terbaik di antara jutaan kemungkinan kombinasi jadwal.
- ⚡ **Real-time Monitoring**: Visualisasi progres proses algoritma secara langsung melalui Socket.io (Fitness score, generation count, conflict updates).
- 📅 **Interactive Schedule View**: Dashboard jadwal interaktif yang memungkinkan penyesuaian manual dengan deteksi konflik instan.
- 📊 **Manajemen Data Komprehensif**: Kelola data Dosen, Mata Kuliah, Ruangan, Program Studi, dan Semester dengan mudah.
- 📤 **Ekspor Excel Profesional**: Menghasilkan laporan jadwal dalam format Excel yang rapi dan siap pakai.
- 🔒 **Sistem Autentikasi**: Keamanan data terjamin dengan JWT (JSON Web Token).

---

## 🛠️ Tech Stack

### Frontend

- **Framework**: Next.js 15 (App Router)
- **Styling**: TailwindCSS & Framer Motion (untuk animasi premium)
- **State Management**: Zustand / React Context
- **UI Components**: Shadcn UI & Lucide Icons
- **Networking**: Axios & Socket.io-client

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js with TypeScript
- **ORM**: Prisma
- **Database**: SQLite (Default) / PostgreSQL / MySQL
- **Real-time**: Socket.io
- **Process Management**: Worker Threads for GA execution

---

## 🚀 Cara Instalasi

### Prasyarat

- Node.js (v18 atau lebih baru)
- npm atau yarn
- PostgreSQL (sudah terinstal dan berjalan)

### 1. Kloning Repositori

```bash
git clone https://github.com/username/cbga.git
cd cbga
```

### 2. Setup Backend

```bash
# Instal dependensi
npm install

# Setup environment variable
cp .env.example .env
# Edit .env dan sesuaikan DATABASE_URL sesuai konfigurasi PostgreSQL Anda

# Migrasi database (membuat tabel)
npm run db:migrate

# Seeding data (opsional: mengisi data awal untuk testing)
npm run db:seed
```

### 3. Setup Frontend

```bash
cd frontend
npm install
cd ..
```

---

## 🏃 Menjalankan Aplikasi

Untuk menjalankan kedua layanan (Frontend & Backend) secara bersamaan:

```bash
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)

---

## 📁 Struktur Direktori

```text
CBGA/
├── backend/            # Express Server & GA Logic
│   ├── src/
│   │   ├── algorithms/ # Implementasi CBGA (Fitness, Operators)
│   │   ├── controllers/# API Controllers
│   │   ├── services/  # Business Logic
│   │   └── sockets/   # Socket.io handlers
│   └── server.ts       # Entry point backend
├── frontend/           # Next.js Application
│   ├── src/
│   │   ├── app/       # Next.js Pages
│   │   ├── components/# Reusable UI Components
│   │   └── store/     # State Management
├── prisma/             # Database Schema & Seeds
└── package.json        # Root scripts & dependencies
```

---

## 🧠 Cara Kerja Algoritma (CBGA)

Algoritma Genetika dalam proyek ini dirancang khusus untuk menangani batasan (_constraints_) penjadwalan universitas yang kompleks. Perbedaan utama CBGA dengan GA standar adalah pendekatannya dalam menjaga variasi populasi dan kemampuannya untuk "memperbaiki" diri sendiri melalui operator khusus.

### 1. Alur Proses Evolusi

Berikut adalah tahapan iteratif yang dilakukan algoritma hingga menemukan jadwal optimal:

1.  **Inisialisasi Populasi**: Sistem membuat kumpulan solusi awal (jadwal acak) dengan teknik _Smart Initialization_ untuk meminimalkan bentrok dasar.
2.  **Evaluasi Fitness**: Setiap jadwal dihitung skor kualitasnya berdasarkan jumlah bentrok (Dosen, Ruang, Semester).
3.  **Seleksi Turnamen**: Memilih jadwal-jadwal terbaik dari populasi untuk dijadikan "induk" generasi berikutnya.
4.  **Hybrid Crossover**: Menggabungkan dua jadwal induk untuk menghasilkan jadwal anak yang mewarisi sifat-sifat terbaik.
5.  **Conflict-Directed Mutation**: Melakukan perubahan acak pada gen yang masih memiliki bentrok untuk mencari kemungkinan slot yang lebih baik.
6.  **Repair Operator**: Melakukan perbaikan lokal secara otomatis pada jadwal yang hampir optimal untuk menghilangkan bentrok tersisa.
7.  **Immigration (Stagnation Handling)**: Jika tidak ada peningkatan selama beberapa generasi, sistem akan memasukkan individu baru (DNA segar) untuk menghindari kebuntuan.
8.  **Terminasi**: Proses berhenti jika skor fitness mencapai 1.0 (sempurna) atau mencapai batas maksimal generasi.

### 2. Fungsi Fitness (Evaluasi Solusi)

Fungsi fitness mengukur seberapa optimal suatu jadwal dengan menghitung total **Penalty** dari pelanggaran batasan:

| Tipe Batasan       | Kepentingan | Penalti | Deskripsi                                                                 |
| :----------------- | :---------- | :------ | :------------------------------------------------------------------------ |
| **Dosen Clash**    | Hard        | 100     | Satu dosen mengajar di dua kelas berbeda pada waktu yang sama.            |
| **Ruangan Clash**  | Hard        | 100     | Dua mata kuliah menggunakan ruangan yang sama di waktu yang sama.         |
| **Semester Clash** | Hard        | 100     | Mahasiswa di semester yang sama memiliki dua jadwal bersamaan.            |
| **Day Overflow**   | Hard        | 100     | Jadwal melebihi batas jam operasional harian atau melewati jam istirahat. |
| **Kapasitas**      | Medium      | 50      | Jumlah mahasiswa melebihi kapasitas kursi ruangan.                        |
| **Preferensi**     | Soft        | 10      | Jadwal jatuh pada waktu di mana dosen meminta libur.                      |

> **Rumus**: `Fitness = 1 / (1 + Total Penalty)`

### 3. Arsitektur Komunikasi Real-time

Sistem menggunakan arsitektur _non-blocking_ dengan alur komunikasi sebagai berikut:

- **User Action**: Pengguna menekan tombol "Mulai" di Dashboard (Frontend).
- **Initialization**: API (Backend) memvalidasi data dan memulai **GA Worker Thread**.
- **Real-time Processing**:
  - Worker melakukan perhitungan evolusi DNA.
  - Setiap generasi, Worker mengirimkan data progres ke API.
  - API menyiarkan (_broadcast_) data tersebut ke Frontend via **Socket.io**.
- **Live Visualization**: Frontend menampilkan grafik progres dan statistik konflik secara _real-time_.
- **Completion**: Setelah selesai, Worker mengirimkan 10 variasi jadwal terbaik untuk disimpan dan ditampilkan.

---

## 📄 Lisensi

Distributed under the ISC License. Lihat `LICENSE` untuk informasi lebih lanjut.

---

Created with ❤️
