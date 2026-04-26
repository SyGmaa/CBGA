"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SlotWaktu } from "@/types";

const HARI_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function WaktuPage() {
  const { data: list = [], isLoading } = useQuery<SlotWaktu[]>({ queryKey: ["waktu"], queryFn: () => api.getSlotWaktu() as Promise<SlotWaktu[]> });
  const grouped = HARI_ORDER.map(h => ({ hari: h, slots: list.filter(s => s.hari === h) })).filter(g => g.slots.length > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-2xl font-bold">Slot Waktu</h1><p className="text-sm text-muted mt-1">Jadwal sesi perkuliahan per hari</p></div>
      {isLoading ? <div className="glass-card p-8 text-center text-muted">Loading...</div> :
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {grouped.map(g => (
            <div key={g.hari} className="glass-card p-5">
              <h3 className="font-bold text-lg mb-3 gradient-text">{g.hari}</h3>
              <div className="space-y-2">
                {g.slots.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface/50 border border-border">
                    <span className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-xs font-bold text-primary-light">{i+1}</span>
                    <span className="text-sm font-medium">{s.jamMulai} — {s.jamSelesai}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
