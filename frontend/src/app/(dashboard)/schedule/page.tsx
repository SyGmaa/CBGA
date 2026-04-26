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
    <>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Penjadwalan Semester Ganjil 2025/2026</h2>
          <p className="text-on-surface-variant text-label-sm font-label-sm mt-1">Kelola dan optimasi jadwal perkuliahan.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-outline text-on-surface font-label-sm text-label-sm rounded-lg hover:bg-surface-variant transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export PDF
          </button>
          <button onClick={() => setShowGenerate(true)} className="px-4 py-2 bg-primary text-on-primary font-label-sm text-label-sm rounded-lg hover:bg-primary-container transition-colors flex items-center gap-2 shadow-sm duration-500">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Generate Jadwal Otomatis
          </button>
          <button className="px-4 py-2 bg-secondary text-on-secondary font-label-sm text-label-sm rounded-lg hover:bg-secondary-fixed-dim transition-colors flex items-center gap-2 shadow-sm duration-500">
            <span className="material-symbols-outlined text-[18px]">save</span>
            Simpan Perubahan
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-4 p-4 bg-surface-container-lowest rounded-xl shadow-[0px_1px_3px_rgba(0,0,0,0.05)] border border-outline-variant items-center flex-wrap animate-fade-in mt-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant">filter_list</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Filter:</span>
        </div>
        
        {/* Simplified filters for UI demo */}
        <div className="relative min-w-[200px]">
          <select className="w-full appearance-none bg-surface-container-lowest border border-outline-variant rounded-lg pl-3 pr-10 py-2 text-on-surface font-body-base text-body-base focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20 focus:outline-none">
            <option>Pilih Hari - Semua</option>
            {HARI.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
        </div>

        {/* Saved Schedules Dropdown (repurposing filter for schedule selection) */}
        <div className="relative min-w-[250px]">
          <select 
            value={selectedId || ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            className="w-full appearance-none bg-surface-container-lowest border border-outline-variant rounded-lg pl-3 pr-10 py-2 text-on-surface font-body-base text-body-base focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20 focus:outline-none"
          >
            <option value="" disabled>Pilih Jadwal Tersimpan</option>
            {schedules.map(s => (
              <option key={s.id} value={s.id}>
                {s.tahunAkademik} {s.semesterTipe} - {s.status}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
        </div>
      </div>

      {/* Grid and Panel Layout */}
      <div className="flex flex-col gap-6 mt-6">
        {/* Top: Matrix/Grid (Full Width) */}
        <div className="w-full h-[calc(100vh-280px)] min-h-[600px] bg-surface-container-lowest rounded-xl shadow-[0px_1px_3px_rgba(0,0,0,0.05)] border border-outline-variant overflow-hidden flex flex-col">
          <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-label-sm text-label-sm text-on-surface font-semibold">Grid Jadwal</h3>
            <div className="flex gap-4 items-center">
              {result && (
                <span className="text-xs text-on-surface-variant">Fitness: {result.fitnessScore?.toFixed(4)}</span>
              )}
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-fixed/20 text-primary font-mono-data text-mono-data"><span className="w-2 h-2 rounded-full bg-primary"></span> Terjadwal</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-error-container/50 text-error font-mono-data text-mono-data"><span className="w-2 h-2 rounded-full bg-error pulse"></span> Konflik</span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-surface-bright">
            {result?.jadwalDetail && result.jadwalDetail.length > 0 ? (
              <table className="w-full min-w-[1000px] border-collapse ghost-border">
                <thead>
                  <tr>
                    <th className="ghost-border border-b border-r bg-surface-variant font-label-sm text-label-sm text-on-surface-variant py-3 px-2 w-[120px]">Jam \ Hari</th>
                    {HARI.map(h => <th key={h} className="ghost-border border-b border-r bg-surface-variant font-label-sm text-label-sm text-on-surface-variant py-3 px-2">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {uniqueSlotTimes.map(timeSlot => (
                    <tr key={timeSlot.id}>
                      <td className="ghost-border border-b border-r bg-surface-container font-label-sm text-label-sm text-on-surface font-medium text-center py-2 px-1">
                        {timeSlot.jamMulai}<br/>-<br/>{timeSlot.jamSelesai}
                      </td>
                      {HARI.map(hari => {
                        const hariSlot = slotsByHari(hari).find(s => s.jamMulai === timeSlot.jamMulai);
                        const items = hariSlot && gridData[hari] ? gridData[hari]![hariSlot.id] || [] : [];
                        const isConflict = items.length > 1;

                        return (
                          <td key={hari} className={`ghost-border border-b border-r p-2 align-top h-[110px] relative ${isConflict ? "bg-red-50/50" : ""}`}>
                            <div className="flex flex-col gap-2 h-full">
                              {items.map(d => (
                                <div key={d.id} className={`rounded p-3 border shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md transition-shadow
                                  ${isConflict ? 'bg-red-50 border-red-500' : 'bg-blue-50 border-blue-200'}`}>
                                  {isConflict && (
                                    <div className="absolute top-1 right-1 text-red-500 pulse">
                                      <span className="material-symbols-outlined text-[16px]">warning</span>
                                    </div>
                                  )}
                                  <p className={`font-label-sm text-label-sm font-bold line-clamp-1 pr-4 ${isConflict ? 'text-red-900' : 'text-blue-900'}`}>{d.mataKuliah?.namaMk}</p>
                                  <p className={`font-mono-data text-mono-data mt-1 ${isConflict ? 'text-red-700' : 'text-blue-700'}`}>{d.dosen?.namaDosen}</p>
                                  <div className="mt-4">
                                    <span className={`absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold flex gap-1 ${isConflict ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isConflict ? 'bg-red-200' : 'bg-blue-200'}`}>{d.ruangan?.namaRuangan}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isConflict ? 'bg-red-200' : 'bg-blue-200'}`}>{d.mataKuliah?.sks} SKS</span>
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex items-center justify-center flex-col text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2">event_busy</span>
                <p>Pilih jadwal atau generate jadwal baru.</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Unscheduled Panel */}
        <div className="w-full bg-surface-container-lowest rounded-xl shadow-[0px_1px_3px_rgba(0,0,0,0.05)] border border-outline-variant flex flex-col mb-10">
          <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-label-sm text-label-sm text-on-surface font-semibold">Mata Kuliah Belum Terjadwal</h3>
            <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full text-[12px] font-bold">0</span>
          </div>
          <div className="p-6 bg-surface-bright flex justify-center text-on-surface-variant text-sm text-center">
            <p>Semua mata kuliah telah terjadwal secara optimal.</p>
          </div>
        </div>
      </div>

      {/* GA Progress Modal */}
      {gaProgress && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-xl shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_10px_10px_-5px_rgba(0,0,0,0.04)] border border-outline-variant w-full max-w-md p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-[32px] spin">settings</span>
            </div>
            <h2 className="font-headline-md text-[20px] text-on-surface mb-2">Menyusun Jadwal Optimal...</h2>
            <p className="text-on-surface-variant font-label-sm text-label-sm mb-6">Mengevaluasi mutasi pada populasi...</p>
            
            <div className="w-full bg-surface-variant rounded-full h-3 mb-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-primary to-secondary h-3 rounded-full transition-all duration-300" 
                style={{ width: `${(gaProgress.generasi / gaProgress.maxGenerasi) * 100}%` }}
              ></div>
            </div>
            <div className="w-full flex justify-between text-xs text-on-surface-variant font-mono-data mb-6">
              <span>Generasi ke-{gaProgress.generasi} dari {gaProgress.maxGenerasi}</span>
              <span>{Math.round((gaProgress.generasi / gaProgress.maxGenerasi) * 100)}%</span>
            </div>
            <p className="text-[11px] text-outline italic">Mohon tunggu, komputasi algoritma membutuhkan waktu beberapa saat.</p>
          </div>
        </div>
      )}

      {/* Simple Input Modal for "Generate" */}
      {showGenerate && !gaProgress && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowGenerate(false)}>
          <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-headline-md text-lg text-on-surface mb-4">Pengaturan Generasi</h2>
            <form onSubmit={e => { e.preventDefault(); generateMut.mutate(genForm); }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-2">Tahun Akademik</label>
                <input 
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-bright text-on-surface focus:outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20 text-sm" 
                  value={genForm.tahunAkademik} 
                  onChange={e => setGenForm({...genForm, tahunAkademik: e.target.value})} 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-2">Semester</label>
                <select 
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-bright text-on-surface focus:outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20 text-sm" 
                  value={genForm.semesterTipe} 
                  onChange={e => setGenForm({...genForm, semesterTipe: e.target.value})}
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowGenerate(false)} className="px-4 py-2 border border-outline text-on-surface font-label-sm text-label-sm rounded-lg hover:bg-surface-variant transition-colors flex-1">Batal</button>
                <button type="submit" disabled={generateMut.isPending} className="px-4 py-2 bg-primary text-on-primary font-label-sm text-label-sm rounded-lg hover:bg-primary-container transition-colors flex-1">{generateMut.isPending ? "Memulai..." : "Generate"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
