"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PreferensiWaktuDosen } from "@/types";

export default function PreferensiPage() {
  const { data: list = [], isLoading } = useQuery<PreferensiWaktuDosen[]>({ queryKey: ["preferensi"], queryFn: () => api.getPreferensi() as Promise<PreferensiWaktuDosen[]> });

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-2xl font-bold">Preferensi Waktu Dosen</h1><p className="text-sm text-muted mt-1">Ketersediaan dosen pada slot waktu tertentu</p></div>
      <div className="glass-card overflow-hidden">
        <table className="data-table"><thead><tr><th>No</th><th>Dosen</th><th>Hari</th><th>Jam</th><th>Status</th></tr></thead>
          <tbody>{isLoading ? <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr> : list.length === 0 ? <tr><td colSpan={5} className="text-center text-muted py-8">Belum ada data</td></tr> :
            list.map((it, i) => (
              <tr key={it.id}><td className="text-muted">{i+1}</td><td className="font-medium">{it.dosen?.namaDosen}</td><td>{it.slotWaktu?.hari}</td><td className="text-sm">{it.slotWaktu?.jamMulai} — {it.slotWaktu?.jamSelesai}</td>
                <td><span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${it.status === "UNAVAILABLE" ? "bg-danger/15 text-danger" : "bg-success/15 text-success"}`}>{it.status}</span></td></tr>
            ))}</tbody></table>
      </div>
    </div>
  );
}
