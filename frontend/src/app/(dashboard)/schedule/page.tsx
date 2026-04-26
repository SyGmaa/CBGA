"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAppStore } from "@/store/useAppStore";
import type { JadwalMaster, JadwalDetail, GAProgress, SlotWaktu } from "@/types";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

export default function SchedulePage() {
  const qc = useQueryClient();
  const { gaProgress, setGAProgress } = useAppStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ tahunAkademik: "2025/2026", semesterTipe: "Ganjil" });

  const { data: schedules = [] } = useQuery<JadwalMaster[]>({ queryKey: ["schedules"], queryFn: () => api.getSchedules() as Promise<JadwalMaster[]> });
  const { data: result } = useQuery<JadwalMaster>({ queryKey: ["schedule-result", selectedId], queryFn: () => api.getScheduleResult(selectedId!) as Promise<JadwalMaster>, enabled: !!selectedId });
  const { data: slots = [] } = useQuery<SlotWaktu[]>({ queryKey: ["waktu"], queryFn: () => api.getSlotWaktu() as Promise<SlotWaktu[]> });

  const generateMut = useMutation({
    mutationFn: (d: any) => api.generateSchedule(d),
    onSuccess: (data: any) => { setSelectedId(data.jadwalMasterId); setShowGenerate(false); },
  });

  const updateSlotMut = useMutation({
    mutationFn: ({ detailId, data }: { detailId: number; data: any }) => api.updateScheduleSlot(detailId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-result", selectedId] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteSchedule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedules"] }); setSelectedId(null); },
  });

  // Socket.io for real-time progress
  useEffect(() => {
    const socket = connectSocket();
    socket.on("ga_progress", (data: GAProgress) => setGAProgress(data));
    socket.on("ga_completed", () => {
      setGAProgress(null);
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["schedule-result", selectedId] });
    });
    socket.on("ga_error", (data: any) => { setGAProgress(null); alert("Error: " + data.error); });
    return () => { socket.off("ga_progress"); socket.off("ga_completed"); socket.off("ga_error"); disconnectSocket(); };
  }, [selectedId]);

  // Group schedule details by hari/slot for grid view
  const getGridData = useCallback(() => {
    if (!result?.jadwalDetail) return {};
    const grid: Record<string, Record<number, JadwalDetail[]>> = {};
    for (const h of HARI) { grid[h] = {}; for (const s of slots) { if (s.hari === h) grid[h]![s.id] = []; } }
    for (const d of result.jadwalDetail) {
      const h = d.slotWaktu?.hari || "";
      if (grid[h] && d.idSlotWaktu in (grid[h] || {})) { grid[h]![d.idSlotWaktu]!.push(d); }
    }
    return grid;
  }, [result, slots]);

  const gridData = getGridData();
  const slotsByHari = (hari: string) => slots.filter(s => s.hari === hari).sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
  const uniqueSlotTimes = slots.filter(s => s.hari === "Senin").sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold">Jadwal Kuliah</h1><p className="text-sm text-muted mt-1">Generate & kelola jadwal dengan CBGA</p></div>
        <button onClick={() => setShowGenerate(true)} className="btn-primary animate-pulse-glow">🧬 Generate Jadwal</button>
      </div>

      {/* GA Progress */}
      {gaProgress && (
        <div className="glass-card p-5 border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">🧬 {gaProgress.status}</span>
            <span className="text-xs text-muted">Generasi {gaProgress.generasi}/{gaProgress.maxGenerasi}</span>
          </div>
          <div className="w-full h-3 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-300" style={{ width: `${(gaProgress.generasi / gaProgress.maxGenerasi) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted">
            <span>Fitness: {gaProgress.bestFitness.toFixed(4)}</span>
            <span>Penalty: {gaProgress.bestPenalty}</span>
          </div>
        </div>
      )}

      {/* Schedule List */}
      <div className="flex gap-2 flex-wrap">
        {schedules.map(s => (
          <button key={s.id} onClick={() => setSelectedId(s.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedId === s.id ? "bg-primary text-white" : "btn-secondary"}`}>
            {s.tahunAkademik} {s.semesterTipe}
            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${s.status === "FINAL" ? "bg-success/20 text-success" : s.status === "GENERATING" ? "bg-warning/20 text-warning" : "bg-muted/20 text-muted"}`}>{s.status}</span>
          </button>
        ))}
      </div>

      {/* Schedule Grid */}
      {result?.jadwalDetail && result.jadwalDetail.length > 0 && (
        <div className="glass-card p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Jadwal: {result.tahunAkademik} — {result.semesterTipe}</h2>
            <div className="flex gap-2 items-center">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${result.status === "FINAL" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{result.status}</span>
              <span className="text-xs text-muted">Fitness: {result.fitnessScore?.toFixed(4)}</span>
              <button onClick={() => { if(confirm("Hapus jadwal?")) deleteMut.mutate(result.id); }} className="btn-danger text-xs py-1.5 px-3">Hapus</button>
            </div>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr><th className="p-2 border border-border bg-surface text-muted">Jam</th>
                {HARI.map(h => <th key={h} className="p-2 border border-border bg-surface text-muted min-w-[180px]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {uniqueSlotTimes.map(timeSlot => (
                <tr key={timeSlot.id}>
                  <td className="p-2 border border-border bg-surface/50 text-muted text-center font-medium whitespace-nowrap">{timeSlot.jamMulai}<br/>{timeSlot.jamSelesai}</td>
                  {HARI.map(hari => {
                    const hariSlot = slotsByHari(hari).find(s => s.jamMulai === timeSlot.jamMulai);
                    const items = hariSlot && gridData[hari] ? gridData[hari]![hariSlot.id] || [] : [];
                    return (
                      <td key={hari} className={`p-1.5 border border-border align-top ${items.length > 1 ? "conflict-cell" : ""}`}>
                        {items.map(d => (
                          <div key={d.id} className="schedule-cell occupied mb-1 text-[11px]">
                            <p className="font-bold text-primary-light">{d.mataKuliah?.kodeMk}</p>
                            <p className="truncate">{d.mataKuliah?.namaMk}</p>
                            <p className="text-muted">{d.dosen?.namaDosen}</p>
                            <p className="text-muted">{d.ruangan?.namaRuangan}</p>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && <div className="modal-overlay" onClick={() => setShowGenerate(false)}><div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">🧬 Generate Jadwal Baru</h2>
        <form onSubmit={e => { e.preventDefault(); generateMut.mutate(genForm); }} className="space-y-4">
          <div><label className="block text-xs font-semibold text-muted uppercase mb-2">Tahun Akademik</label><input className="input-field" value={genForm.tahunAkademik} onChange={e => setGenForm({...genForm, tahunAkademik: e.target.value})} required /></div>
          <div><label className="block text-xs font-semibold text-muted uppercase mb-2">Semester</label>
            <select className="input-field" value={genForm.semesterTipe} onChange={e => setGenForm({...genForm, semesterTipe: e.target.value})}>
              <option value="Ganjil">Ganjil</option><option value="Genap">Genap</option>
            </select></div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowGenerate(false)} className="btn-secondary flex-1">Batal</button>
            <button type="submit" disabled={generateMut.isPending} className="btn-primary flex-1">{generateMut.isPending ? "Memproses..." : "Generate"}</button></div>
        </form></div></div>}
    </div>
  );
}
