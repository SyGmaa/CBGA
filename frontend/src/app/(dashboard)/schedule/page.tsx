"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAppStore } from "@/store/useAppStore";
import type { JadwalMaster, JadwalDetail, GAProgress, SlotWaktu } from "@/types";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function SchedulePage() {
  const qc = useQueryClient();
  const { gaProgress, setGAProgress } = useAppStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<JadwalDetail | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<number[]>([]);
  const [genForm, setGenForm] = useState({ tahunAkademik: "2025/2026", semesterTipe: "Ganjil", jumlahJadwal: 10, maxGenerasi: 500 });

  const { data: schedules = [] } = useQuery<JadwalMaster[]>({ queryKey: ["schedules"], queryFn: () => api.getSchedules() as Promise<JadwalMaster[]> });
  const { data: result } = useQuery<JadwalMaster>({ queryKey: ["schedule-result", selectedId], queryFn: () => api.getScheduleResult(selectedId!) as Promise<JadwalMaster>, enabled: !!selectedId });
  const { data: slots = [] } = useQuery<SlotWaktu[]>({ queryKey: ["waktu"], queryFn: () => api.getSlotWaktu() as Promise<SlotWaktu[]> });

  const generateMut = useMutation({
    mutationFn: (d: any) => api.generateSchedule(d),
    onSuccess: (data: any) => { setSelectedId(data.jadwalMasterId); setShowGenerate(false); },
    onError: (error: any) => alert(error.message || "Gagal menghubungi server/database."),
  });

  const updateSlotMut = useMutation({
    mutationFn: ({ detailId, data }: { detailId: number; data: any }) => api.updateScheduleSlot(detailId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-result", selectedId] }),
    onError: (error: any) => alert(error.message || "Gagal menyimpan perubahan."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteSchedule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedules"] }); setSelectedId(null); },
    onError: (error: any) => alert(error.message || "Gagal menghapus jadwal."),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: number[]) => api.bulkDeleteSchedules(ids),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["schedules"] }); 
      setSelectedForDelete([]);
      setSelectedId(null);
      setShowManage(false);
    },
    onError: (error: any) => alert(error.message || "Gagal menghapus jadwal massal."),
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
    for (const h of HARI) { 
      grid[h] = {}; 
      const daySlots = slots.filter(s => s.hari === h).sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
      for (const s of daySlots) grid[h]![s.id] = []; 
    }

    // Sort details to process them in order
    const sortedDetails = [...result.jadwalDetail].sort((a, b) => {
      if (a.slotWaktu!.hari !== b.slotWaktu!.hari) return a.slotWaktu!.hari.localeCompare(b.slotWaktu!.hari);
      return a.slotWaktu!.jamMulai.localeCompare(b.slotWaktu!.jamMulai);
    });

    for (const d of sortedDetails) {
      const h = d.slotWaktu?.hari || "";
      if (grid[h] && d.idSlotWaktu in (grid[h] || {})) { 
        grid[h]![d.idSlotWaktu]!.push(d); 
      }
    }
    return grid;
  }, [result, slots]);

  const gridData = getGridData();

  const checkSlotAvailability = useCallback((item: JadwalDetail, slotId: number) => {
    if (!result?.jadwalDetail || !item.mataKuliah) return false;
    
    const targetSlot = slots.find(s => s.id === slotId);
    if (!targetSlot) return false;

    const sks = item.mataKuliah.sks;
    const daySlots = slots
      .filter(s => s.hari === targetSlot.hari)
      .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
    
    const startIdx = daySlots.findIndex(s => s.id === slotId);
    
    // 1. Check Day Overflow: Must have enough slots remaining in the same day
    if (startIdx === -1 || (startIdx + sks) > daySlots.length) {
      return false;
    }

    // 2. Check Multi-slot Conflicts: Check all slots the item will occupy
    const targetSlotIds = daySlots.slice(startIdx, startIdx + sks).map(s => s.id);
    
    for (const other of result.jadwalDetail) {
      // Skip self and its other slots
      if (other.idMatkul === item.idMatkul && other.idDosen === item.idDosen) continue;
      
      // If the other item occupies any of our target slots
      if (targetSlotIds.includes(other.idSlotWaktu)) {
        const isRoomClash = item.idRuangan === other.idRuangan;
        const isDosenClash = item.idDosen === other.idDosen;
        const isSemesterClash = item.mataKuliah?.idProdi === other.mataKuliah?.idProdi && item.mataKuliah?.semester === other.mataKuliah?.semester;
        
        if (isRoomClash || isDosenClash || isSemesterClash) return false;
      }
    }

    return true;
  }, [result, slots]);

  const handleDrop = (e: React.DragEvent, slotId: number) => {
    e.preventDefault();
    if (!draggedItem) return;
    updateSlotMut.mutate({ detailId: draggedItem.id, data: { idSlotWaktu: slotId } });
    setDraggedItem(null);
  };

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
        <div className="relative min-w-[250px] flex items-center gap-2">
          <div className="relative flex-1">
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
          <button 
            onClick={() => setShowManage(true)}
            className="p-2 border border-outline-variant rounded-lg text-error hover:bg-error-container/20 transition-colors"
            title="Kelola Jadwal (Hapus)"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
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
                        
                        // Check if this slot is a continuation of a previous slot for any item
                        const isContinuation = (item: JadwalDetail) => {
                          if (!hariSlot) return false;
                          const daySlots = slotsByHari(hari);
                          const currentIdx = daySlots.findIndex(s => s.id === hariSlot.id);
                          if (currentIdx === 0) return false;
                          
                          const prevSlot = daySlots[currentIdx - 1];
                          const prevItems = gridData[hari]![prevSlot.id] || [];
                          
                          // It's a continuation if the SAME matkul-dosen-ruangan combination exists in the previous slot
                          return prevItems.some(pi => 
                            pi.idMatkul === item.idMatkul && 
                            pi.idDosen === item.idDosen && 
                            pi.idRuangan === item.idRuangan
                          );
                        };

                        const visibleItems = items.filter(item => !isContinuation(item));

                        // For visible items, calculate how many slots they span
                        const getSpan = (item: JadwalDetail) => {
                          if (!hariSlot) return 1;
                          const daySlots = slotsByHari(hari);
                          const startIdx = daySlots.findIndex(s => s.id === hariSlot.id);
                          let span = 1;
                          for (let i = startIdx + 1; i < daySlots.length; i++) {
                            const nextSlot = daySlots[i];
                            const nextItems = gridData[hari]![nextSlot.id] || [];
                            if (nextItems.some(ni => 
                              ni.idMatkul === item.idMatkul && 
                              ni.idDosen === item.idDosen && 
                              ni.idRuangan === item.idRuangan
                            )) {
                              span++;
                            } else {
                              break;
                            }
                          }
                          return span;
                        };

                        // Conflict Detection (including overlaps from multi-slot items)
                        const conflictMap = new Map<number, string[]>();
                        for (let i = 0; i < items.length; i++) {
                          for (let j = 0; j < items.length; j++) {
                            if (i === j) continue;
                            const d1 = items[i];
                            const d2 = items[j];
                            const isRoomClash = d1.idRuangan === d2.idRuangan;
                            const isDosenClash = d1.idDosen === d2.idDosen;
                            const isSemesterClash = d1.mataKuliah?.idProdi === d2.mataKuliah?.idProdi && d1.mataKuliah?.semester === d2.mataKuliah?.semester;
                            
                            if (isRoomClash || isDosenClash || isSemesterClash) {
                              if (!conflictMap.has(d1.id)) conflictMap.set(d1.id, []);
                              const reasons = conflictMap.get(d1.id)!;
                              if (isRoomClash) reasons.push(`Bentrok Ruangan: ${d2.mataKuliah?.namaMk} juga menggunakan ${d1.ruangan?.namaRuangan}`);
                              if (isDosenClash) reasons.push(`Bentrok Dosen: ${d1.dosen?.namaDosen} juga mengajar ${d2.mataKuliah?.namaMk}`);
                              if (isSemesterClash) reasons.push(`Bentrok Kelas: Semester ${d1.mataKuliah?.semester} Prodi ${d1.mataKuliah?.idProdi} juga ada kuliah ${d2.mataKuliah?.namaMk}`);
                            }
                          }
                        }

                        return (
                          <td 
                            key={hari} 
                            onDragOver={(e) => {
                              if (draggedItem && hariSlot && checkSlotAvailability(draggedItem, hariSlot.id)) {
                                e.preventDefault();
                              }
                            }}
                            onDrop={(e) => hariSlot && handleDrop(e, hariSlot.id)}
                            className={`ghost-border border-b border-r p-1 align-top h-[110px] relative transition-all duration-300 hover:!z-[999] overflow-visible
                              ${items.length > 1 ? "bg-red-50/10" : ""}
                              ${draggedItem && hariSlot && checkSlotAvailability(draggedItem, hariSlot.id) ? "bg-green-100/60 ring-2 ring-green-400 ring-inset z-10" : ""}
                            `}
                          >

                            <div className="flex flex-col gap-1 h-full overflow-visible">
                              {visibleItems.map(d => {
                                const span = getSpan(d);
                                const isItemConflicting = conflictMap.has(d.id);
                                const isBeingDragged = draggedItem?.id === d.id;

                                return (
                                  <div 
                                    key={d.id} 
                                    draggable
                                    onDragStart={() => setDraggedItem(d)}
                                    onDragEnd={() => setDraggedItem(null)}
                                    style={{ 
                                      height: `calc(${span} * 110px - 8px)`, 
                                      zIndex: span > 1 ? 20 : 10 
                                    }}
                                    className={`rounded p-3 border shadow-sm relative overflow-visible group cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-300 hover:!z-[1000]
                                      ${isItemConflicting ? 'bg-red-50 border-red-500 ring-1 ring-red-200' : 'bg-blue-50 border-blue-200'}
                                      ${isBeingDragged ? 'opacity-40 scale-95 shadow-none' : 'opacity-100 scale-100'}
                                      ${span > 1 ? 'absolute w-[calc(100%-8px)]' : 'relative'}
                                    `}
                                  >

                                    {isItemConflicting && (
                                      <div className="absolute top-1 right-1 text-red-500 animate-pulse">
                                        <span className="material-symbols-outlined text-[16px]">warning</span>
                                      </div>
                                    )}
                                    
                                    <p className={`font-label-sm text-label-sm font-bold line-clamp-2 pr-4 ${isItemConflicting ? 'text-red-900' : 'text-blue-900'}`}>{d.mataKuliah?.namaMk}</p>
                                    <p className={`font-mono-data text-mono-data mt-1 ${isItemConflicting ? 'text-red-700' : 'text-blue-700'}`}>{d.dosen?.namaDosen}</p>
                                    
                                    <div className="mt-auto pt-2 flex flex-wrap gap-1">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isItemConflicting ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>
                                        {d.ruangan?.namaRuangan}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isItemConflicting ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>
                                        {d.mataKuliah?.sks} SKS
                                      </span>
                                    </div>

                                    {/* Tooltip for conflicts - Top Positioning */}
                                    {isItemConflicting && (
                                      <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 absolute !z-[9999] bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-inverse-surface text-inverse-on-surface text-[12px] rounded-xl shadow-2xl border border-outline-variant transition-all duration-200 pointer-events-none">
                                        <div className="font-bold mb-2 flex items-center gap-2 text-error-container border-b border-outline-variant pb-1.5">
                                          <span className="material-symbols-outlined text-[16px]">report</span>
                                          Detail Konflik
                                        </div>
                                        <ul className="space-y-1.5">
                                          {Array.from(new Set(conflictMap.get(d.id))).map((reason, idx) => (
                                            <li key={idx} className="flex gap-2">
                                              <span className="text-error-container">•</span>
                                              <span>{reason}</span>
                                            </li>
                                          ))}
                                        </ul>
                                        {/* Bottom Arrow Tooltip */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[8px] border-transparent border-t-inverse-surface"></div>
                                      </div>
                                    )}


                                  </div>
                                );
                              })}
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

      {/* Manage/Delete Schedules Modal */}
      {showManage && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowManage(false)}>
          <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-headline-md text-lg text-on-surface">Kelola Jadwal</h2>
              <button onClick={() => setShowManage(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto mb-4 border border-outline-variant rounded-lg">
              {schedules.length === 0 ? (
                <div className="p-4 text-center text-on-surface-variant text-sm">Tidak ada jadwal tersimpan.</div>
              ) : (
                <ul className="divide-y divide-outline-variant">
                  {schedules.map(s => (
                    <li key={s.id} className="flex items-center gap-3 p-3 hover:bg-surface-variant/50 transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary"
                        checked={selectedForDelete.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedForDelete(prev => [...prev, s.id]);
                          else setSelectedForDelete(prev => prev.filter(id => id !== s.id));
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-on-surface">{s.tahunAkademik} - {s.semesterTipe}</p>
                        <p className="text-xs text-on-surface-variant">Status: {s.status}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-outline-variant">
              <div className="text-sm text-on-surface-variant">
                {selectedForDelete.length} dipilih
              </div>
              <div className="flex gap-2">
                {selectedForDelete.length > 0 && selectedForDelete.length < schedules.length && (
                  <button 
                    onClick={() => setSelectedForDelete(schedules.map(s => s.id))}
                    className="px-3 py-1.5 text-primary text-sm font-semibold hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    Pilih Semua
                  </button>
                )}
                {selectedForDelete.length === schedules.length && schedules.length > 0 && (
                  <button 
                    onClick={() => setSelectedForDelete([])}
                    className="px-3 py-1.5 text-primary text-sm font-semibold hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    Batal Pilih
                  </button>
                )}
                <button 
                  onClick={() => bulkDeleteMut.mutate(selectedForDelete)}
                  disabled={selectedForDelete.length === 0 || bulkDeleteMut.isPending}
                  className="px-4 py-1.5 bg-error text-on-error font-label-sm text-label-sm rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {bulkDeleteMut.isPending ? "Menghapus..." : "Hapus Terpilih"}
                </button>
              </div>
            </div>
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
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-2">Jumlah Alternatif Jadwal (Max 1000)</label>
                <input 
                  type="number"
                  min="1"
                  max="1000"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-bright text-on-surface focus:outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20 text-sm" 
                  value={genForm.jumlahJadwal} 
                  onChange={e => setGenForm({...genForm, jumlahJadwal: parseInt(e.target.value) || 10})} 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-2">Batas Generasi (Max 2000)</label>
                <input 
                  type="number"
                  min="1"
                  max="2000"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-bright text-on-surface focus:outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20 text-sm" 
                  value={genForm.maxGenerasi} 
                  onChange={e => setGenForm({...genForm, maxGenerasi: parseInt(e.target.value) || 500})} 
                  required 
                />
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
