"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardStats } from "@/types";

const statCards = [
  {
    key: "totalMatkul",
    label: "Mata Kuliah",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    gradient: "from-blue-500/20 to-indigo-500/20",
    iconColor: "text-blue-400",
  },
  {
    key: "totalDosen",
    label: "Dosen",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
  },
  {
    key: "totalRuangan",
    label: "Ruangan",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-400",
  },
  {
    key: "totalSlotWaktu",
    label: "Slot Waktu",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400",
  },
  {
    key: "totalJadwal",
    label: "Jadwal",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    gradient: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-400",
  },
];

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getStats() as Promise<DashboardStats>,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          Ringkasan data sistem penjadwalan
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card, i) => (
          <div
            key={card.key}
            className="glass-card p-5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center ${card.iconColor} mb-3`}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold">
              {isLoading ? (
                <span className="inline-block w-10 h-7 bg-surface rounded animate-pulse" />
              ) : (
                (stats as any)?.[card.key] ?? 0
              )}
            </p>
            <p className="text-xs text-muted mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Latest Schedule */}
      {stats?.latestJadwal && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Jadwal Terakhir</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted mb-1">Tahun Akademik</p>
              <p className="font-medium">{stats.latestJadwal.tahunAkademik}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Semester</p>
              <p className="font-medium">{stats.latestJadwal.semesterTipe}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Status</p>
              <span
                className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  stats.latestJadwal.status === "FINAL"
                    ? "bg-success/15 text-success"
                    : stats.latestJadwal.status === "GENERATING"
                    ? "bg-warning/15 text-warning"
                    : "bg-muted/15 text-muted"
                }`}
              >
                {stats.latestJadwal.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Fitness Score</p>
              <p className="font-medium">
                {stats.latestJadwal.fitnessScore?.toFixed(4) ?? "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Tentang CBGA
          </h3>
          <p className="text-sm text-muted leading-relaxed">
            Community-Based Genetic Algorithm (CBGA) menggunakan pendekatan
            evolusioner untuk mengoptimalkan penjadwalan mata kuliah. Populasi
            dibagi berdasarkan Prodi untuk mencegah premature convergence.
          </p>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Constraint
          </h3>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
              Dosen tidak boleh bentrok di slot yang sama
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
              Ruangan tidak boleh dipakai bersamaan
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
              Mahasiswa semester sama tidak boleh bentrok
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
              Kapasitas ruangan harus mencukupi
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              Preferensi waktu dosen diperhatikan
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
