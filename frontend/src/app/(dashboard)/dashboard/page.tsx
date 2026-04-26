"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
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
  const { user } = useAppStore();
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getStats() as Promise<DashboardStats>,
  });

  const topStats = [
    {
      label: "Total Mata Kuliah",
      value: stats?.totalMatkul ?? 0,
      icon: "menu_book",
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-900",
    },
    {
      label: "Total Dosen",
      value: stats?.totalDosen ?? 0,
      icon: "groups",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-900",
    },
    {
      label: "Total Ruangan",
      value: stats?.totalRuangan ?? 0,
      icon: "apartment",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-900",
    },
    {
      label: "Status Penjadwalan",
      value: stats?.latestJadwal?.status || "Draft",
      subValue: "/ Selesai",
      icon: "calendar_today",
      iconBg: "bg-rose-50",
      iconColor: "text-rose-900",
    },
  ];

  const activities = stats?.prodiActivities?.map(act => ({
    prodi: act.username,
    time: new Date(act.updatedAt).toLocaleString('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    status: "Selesai", // This could be dynamic based on more complex logic
    statusColor: "bg-blue-100 text-blue-700"
  })) || [];

  const fitness = stats?.latestJadwal?.fitnessScore ?? 0;
  const statusLabel = stats?.latestJadwal?.status || "Draft";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-display-lg font-display-lg text-on-surface">Dashboard Overview</h1>
        <p className="text-on-surface-variant font-label-sm text-label-sm">
          Selamat datang kembali, {user?.username || "Admin PJPJK"}
        </p>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {topStats.map((stat, i) => {
          // Dynamic value for status
          const displayValue = stat.label === "Status Penjadwalan" ? statusLabel : stat.value;
          
          return (
            <div
              key={i}
              className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex justify-between items-start"
            >
              <div>
                <p className="text-on-surface-variant font-label-sm text-label-sm mb-2">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-4xl font-black text-on-surface">{isLoading ? "..." : displayValue}</p>
                  {stat.subValue && <span className="text-on-surface-variant text-sm">{stat.subValue}</span>}
                </div>
              </div>
              <div className={`w-12 h-12 rounded-full ${stat.iconBg} flex items-center justify-center ${stat.iconColor} relative`}>
                 <div className="absolute inset-0 bg-current opacity-5 rounded-full scale-150 -translate-y-2 translate-x-2"></div>
                 <span className="material-symbols-outlined filled text-2xl relative z-10">{stat.icon}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Optimization Status */}
        <div className="lg:col-span-1 bg-white p-8 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center">
          <div className="w-full flex items-center gap-3 mb-10">
            <span className="material-symbols-outlined text-primary text-2xl">published_with_changes</span>
            <h3 className="font-bold text-on-surface">Status Optimasi Terakhir</h3>
          </div>

          <div className="relative w-48 h-48 flex items-center justify-center mb-8">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-slate-100"
              />
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray={552.92}
                strokeDashoffset={552.92 * (1 - fitness)}
                strokeLinecap="round"
                className="text-secondary-container transition-all duration-1000"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-black text-on-surface">{fitness.toFixed(4)}</span>
              <span className="text-xs font-bold text-on-surface-variant tracking-widest uppercase">Fitness</span>
            </div>
          </div>

          <p className="text-center text-on-surface-variant text-sm leading-relaxed mb-10 max-w-[240px]">
            {fitness > 0 
              ? `Algoritma genetika mencapai fitness score ${fitness.toFixed(4)} pada penjadwalan terakhir.`
              : "Belum ada data optimasi yang dijalankan pada periode ini."}
          </p>

          <button className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95">
            <span className="material-symbols-outlined text-xl">play_arrow</span>
            Jalankan Ulang
          </button>
        </div>

        {/* Right Column: Activity Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 flex justify-between items-center">
            <h3 className="font-bold text-on-surface">Aktivitas Terbaru Prodi</h3>
            <button className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
              Lihat Semua <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {activities.length > 0 ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low border-y border-slate-50">
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Nama Prodi</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Waktu Update</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Status Input Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activities.map((act, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5 font-bold text-on-surface text-sm">{act.prodi}</td>
                      <td className="px-6 py-5 text-on-surface-variant text-sm">{act.time}</td>
                      <td className="px-6 py-5">
                        <span className={`px-4 py-1 rounded-full text-xs font-bold ${act.statusColor}`}>
                          {act.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-20">history_toggle_off</span>
                <p className="text-sm">Belum ada aktivitas prodi tercatat.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
