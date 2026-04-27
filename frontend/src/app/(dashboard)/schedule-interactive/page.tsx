"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAppStore } from "@/store/useAppStore";
import type { JadwalMaster, JadwalDetail, GAProgress, SlotWaktu, Ruangan } from "@/types";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const SLOT_WIDTH = 160; // px
const ROW_HEIGHT = 80; // px

export default function InteractiveSchedulePage() {
  const qc = useQueryClient();
  const { gaProgress, setGAProgress } = useAppStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<(JadwalDetail & { sksTotal?: number; slotIds?: number[]; detailIds?: number[] }) | null>(null);
  const [showAllRooms, setShowAllRooms] = useState(false);

  const { data: schedules = [] } = useQuery<JadwalMaster[]>({ 
    queryKey: ["schedules"], 
    queryFn: () => api.getSchedules() as Promise<JadwalMaster[]> 
  });
  
  const { data: result } = useQuery<JadwalMaster>({ 
    queryKey: ["schedule-result", selectedId], 
    queryFn: () => api.getScheduleResult(selectedId!) as Promise<JadwalMaster>, 
    enabled: !!selectedId 
  });
  
  const { data: slots = [] } = useQuery<SlotWaktu[]>({ 
    queryKey: ["waktu"], 
    queryFn: () => api.getSlotWaktu() as Promise<SlotWaktu[]> 
  });

  const { data: rooms = [] } = useQuery<Ruangan[]>({
    queryKey: ["ruangan"],
    queryFn: () => api.getRuangan() as Promise<Ruangan[]>
  });

  const updateSlotMut = useMutation({
    mutationFn: ({ detailId, data }: { detailId: number; data: any }) => api.updateScheduleSlot(detailId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-result", selectedId] }),
    onError: (error: any) => alert(error.message || "Gagal menyimpan perubahan."),
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
    return () => { 
      socket.off("ga_progress"); 
      socket.off("ga_completed"); 
      disconnectSocket(); 
    };
  }, [selectedId, qc, setGAProgress]);

  // Unique time slots for the header
  const timeLabels = useMemo(() => {
    const uniqueTimes = new Map<string, string>();
    slots.forEach(s => {
      uniqueTimes.set(s.jamMulai, s.jamSelesai);
    });
    return Array.from(uniqueTimes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([start, end]) => ({ start, end }));
  }, [slots]);

  // 1. Grouping JadwalDetail into "Sessions" (one session = one UI block)
  const sessions = useMemo(() => {
    if (!result?.jadwalDetail || slots.length === 0) return [];
    
    // Sort all details to find continuations easily
    const sorted = [...result.jadwalDetail].sort((a, b) => {
      if (a.slotWaktu!.hari !== b.slotWaktu!.hari) return a.slotWaktu!.hari.localeCompare(b.slotWaktu!.hari);
      return a.slotWaktu!.jamMulai.localeCompare(b.slotWaktu!.jamMulai);
    });

    const results: (JadwalDetail & { sksTotal: number; slotIds: number[]; detailIds: number[]; _layer?: number })[] = [];
    const processedIds = new Set<number>();

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (processedIds.has(current.id)) continue;

      // Start a new session
      const session = { ...current, sksTotal: 1, slotIds: [current.idSlotWaktu], detailIds: [current.id] };
      processedIds.add(current.id);

      // Look ahead for consecutive slots of the SAME matkul-dosen-ruangan
      let lastSlotId = current.idSlotWaktu;
      const daySlots = slots
        .filter(s => s.hari === current.slotWaktu?.hari)
        .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
      
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        if (processedIds.has(next.id)) continue;

        const isSameMeta = next.idMatkul === current.idMatkul && 
                          next.idDosen === current.idDosen && 
                          next.idRuangan === current.idRuangan;
        
        if (isSameMeta) {
          const lastIdx = daySlots.findIndex(s => s.id === lastSlotId);
          const nextIdx = daySlots.findIndex(s => s.id === next.idSlotWaktu);
          
          if (nextIdx === lastIdx + 1) {
            session.sksTotal += 1;
            session.slotIds.push(next.idSlotWaktu);
            session.detailIds.push(next.id);
            lastSlotId = next.idSlotWaktu;
            processedIds.add(next.id);
          }
        }
      }
      results.push(session);
    }
    return results;
  }, [result, slots]);

  // 2. Conflict Map: Based on Sessions
  const conflictMap = useMemo(() => {
    const map = new Map<number, string[]>();
    if (sessions.length === 0) return map;

    for (let i = 0; i < sessions.length; i++) {
      for (let j = 0; j < sessions.length; j++) {
        if (i === j) continue; // Skip self
        const s1 = sessions[i];
        const s2 = sessions[j];

        // Only check if they are on the same day
        if (s1.slotWaktu?.hari !== s2.slotWaktu?.hari) continue;

        // Check if any slot IDs overlap
        const hasOverlap = s1.slotIds.some(id => s2.slotIds.includes(id));

        if (hasOverlap) {
          const reasons: string[] = [];
          if (s1.idRuangan === s2.idRuangan) reasons.push(`Bentrok Ruangan: ${s2.mataKuliah?.namaMk} menggunakan ruangan yang sama`);
          if (s1.idDosen === s2.idDosen) reasons.push(`Bentrok Dosen: ${s1.dosen?.namaDosen} mengajar di waktu yang sama`);
          if (s1.mataKuliah?.idProdi === s2.mataKuliah?.idProdi && s1.mataKuliah?.semester === s2.mataKuliah?.semester) {
            reasons.push(`Bentrok Kelas: Semester ${s1.mataKuliah?.semester} Prodi ${s1.mataKuliah?.prodi?.namaProdi} memiliki kuliah lain`);
          }

          if (reasons.length > 0) {
            const existing = map.get(s1.id) || [];
            map.set(s1.id, Array.from(new Set([...existing, ...reasons])));
          }
        }
      }
    }
    return map;
  }, [sessions]);

  // 3. Organized data for UI: Day -> Room -> Sessions
  const organizedData = useMemo(() => {
    const data: Record<string, Record<number, any[]>> = {};
    HARI.forEach(hari => {
      data[hari] = {};
      const daySessions = sessions.filter(s => s.slotWaktu?.hari === hari);
      
      // Group by room
      daySessions.forEach(session => {
        const roomId = session.idRuangan;
        if (!data[hari][roomId]) data[hari][roomId] = [];
        data[hari][roomId].push(session);
      });

      // Calculate visual layers for overlapping sessions in the same room
      Object.keys(data[hari]).forEach(roomIdStr => {
        const roomId = Number(roomIdStr);
        const roomSessions = data[hari][roomId];
        
        // Sort by start time
        roomSessions.sort((a, b) => {
          return a.slotWaktu!.jamMulai.localeCompare(b.slotWaktu!.jamMulai);
        });

        roomSessions.forEach((session, i) => {
          let layer = 0;
          // Find previously processed sessions that overlap in time
          const overlapping = roomSessions.slice(0, i).filter(prev => 
            prev.slotIds.some((id: number) => session.slotIds.includes(id))
          );
          
          if (overlapping.length > 0) {
            const usedLayers = overlapping.map(o => o._layer || 0);
            while (usedLayers.includes(layer)) {
              layer++;
            }
          }
          session._layer = layer;
        });
      });
    });
    return data;
  }, [sessions]);

  const getSlotIndex = (jamMulai: string) => {
    return timeLabels.findIndex(t => t.start === jamMulai);
  };

  const handleDrop = (e: React.DragEvent, hari: string, slotId: number, roomId: number) => {
    e.preventDefault();
    if (!draggedItem) return;
    
    updateSlotMut.mutate({ 
      detailId: draggedItem.id, 
      data: { idSlotWaktu: slotId, idRuangan: roomId, detailIds: draggedItem.detailIds } 
    });
    setDraggedItem(null);
  };

  const checkAvailability = useCallback((item: JadwalDetail, slotId: number, roomId: number) => {
    if (!result?.jadwalDetail) return false;
    
    const targetSlot = slots.find(s => s.id === slotId);
    if (!targetSlot) return false;

    // Pastikan kapasitas ruangan mencukupi
    const room = rooms.find(r => r.id === roomId);
    if (room && item.mataKuliah && room.kapasitas < (item.mataKuliah.jumlahMhs || 0)) {
      return false;
    }

    const sks = item.mataKuliah?.sks || 1;
    const daySlots = slots
      .filter(s => s.hari === targetSlot.hari)
      .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
    
    const startIdx = daySlots.findIndex(s => s.id === slotId);
    if (startIdx === -1 || (startIdx + sks) > daySlots.length) return false;

    const targetSlotIds = daySlots.slice(startIdx, startIdx + sks).map(s => s.id);
    
    for (const other of result.jadwalDetail) {
      if ((item.detailIds && item.detailIds.includes(other.id)) || other.id === item.id) continue;
      
      if (targetSlotIds.includes(other.idSlotWaktu)) {
        const isRoomClash = roomId === other.idRuangan;
        const isDosenClash = item.idDosen === other.idDosen;
        const isSemesterClash = item.mataKuliah?.idProdi === other.mataKuliah?.idProdi && item.mataKuliah?.semester === other.mataKuliah?.semester;
        
        if (isRoomClash || isDosenClash || isSemesterClash) return false;
      }
    }
    return true;
  }, [result, slots, rooms]);

  return (
    <div className="min-h-screen bg-surface-bright p-6 animate-fade-in">
      {/* Header & Controls Section */}
      <div className="mb-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Interactive Timeline Schedule</h2>
          <p className="text-on-surface-variant text-sm mt-1">Visualisasi jadwal dengan drag & drop dan durasi SKS yang jelas.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 p-4 bg-white border border-outline-variant rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-on-surface-variant mr-2">
            <span className="material-symbols-outlined text-[20px]">filter_list</span>
            <span className="text-xs font-bold uppercase tracking-wider">Kontrol:</span>
          </div>

          <div className="relative min-w-[280px]">
            <select 
              value={selectedId || ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="w-full appearance-none bg-surface-container-lowest border border-outline-variant rounded-lg pl-3 pr-10 py-2.5 text-on-surface font-body-base text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
            >
              <option value="" disabled>Pilih Jadwal Master...</option>
              {schedules.map(s => (
                <option key={s.id} value={s.id}>
                  {s.tahunAkademik} {s.semesterTipe} - {s.status}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
          </div>

          <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer bg-surface-container-lowest border border-outline-variant px-3 py-2.5 rounded-lg shadow-sm hover:bg-surface-variant/20 transition-all">
            <input 
              type="checkbox" 
              checked={showAllRooms} 
              onChange={e => setShowAllRooms(e.target.checked)} 
              className="rounded text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer" 
            />
            Tampilkan Semua Ruangan
          </label>
          
          <button className="px-6 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Generate Jadwal
          </button>
        </div>
      </div>

      {/* Main Grid Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant overflow-hidden flex flex-col w-full h-[calc(100vh-320px)] min-h-[500px]">
        
        {/* Scrollable Area (Horizontal & Vertical) */}
        <div className="overflow-auto custom-scrollbar flex-1 w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Ensure this div is wide enough to force horizontal scroll */}
          <div className="inline-block min-w-full" style={{ width: (timeLabels.length * SLOT_WIDTH) + 160 }}>
            
            {/* Header: Time Slots */}
            <div className="flex border-b border-outline-variant sticky top-0 bg-surface-container-low z-30">
              <div className="w-[160px] flex-shrink-0 p-4 border-r border-outline-variant flex items-center justify-center font-bold text-xs uppercase tracking-wider text-on-surface-variant bg-surface-container-low sticky left-0 z-40">
                Hari \ Waktu
              </div>
              <div className="flex flex-1">
                {timeLabels.map((time, idx) => (
                  <div key={idx} style={{ width: SLOT_WIDTH }} className="flex-shrink-0 p-3 flex flex-col items-center justify-center border-r border-outline-variant/30">
                    <span className="text-sm font-bold text-on-surface">{time.start}</span>
                    <span className="text-[10px] text-on-surface-variant">{time.end}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rows: Days & Rooms */}
            <div className="relative">
              {HARI.map((hari) => {
                const dayRoomsData = organizedData[hari] || {};
                const activeRoomIds = Object.keys(dayRoomsData).map(Number);
                const displayRoomIds = showAllRooms 
                  ? rooms.map(r => r.id) 
                  : (activeRoomIds.length > 0 ? activeRoomIds : rooms.slice(0, 3).map(r => r.id));

                return (
                  <div key={hari} className="flex border-b border-outline-variant last:border-0">
                    {/* Day Label (Sticky) */}
                    <div className="w-[160px] flex-shrink-0 bg-surface-container-low/50 border-r border-outline-variant flex items-center justify-center sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                      <span className="font-bold text-lg text-on-surface-variant">{hari}</span>
                    </div>

                    {/* Rooms Sub-rows */}
                    <div className="flex-1 flex flex-col">
                      {displayRoomIds.map((roomId) => {
                        const room = rooms.find(r => r.id === roomId);
                        const courses = dayRoomsData[roomId] || [];

                        return (
                          <div key={roomId} className="flex border-b border-outline-variant/10 last:border-0 h-[100px] relative group">
                            {/* Room Sub-label */}
                            <div className="absolute left-0 top-0 bottom-0 w-[120px] flex items-center px-3 text-[10px] font-black text-on-surface-variant/30 border-r border-outline-variant/5 z-10 pointer-events-none uppercase">
                              {room?.namaRuangan || "Room " + roomId}
                            </div>

                            {/* Drop Zones / Background Grid */}
                            <div className="flex">
                              {timeLabels.map((time, idx) => {
                                // Find actual slot ID for this specific day and time
                                const actualSlot = slots.find(s => s.hari === hari && s.jamMulai === time.start);
                                const isValidSlot = !!actualSlot;

                                return (
                                  <div 
                                    key={idx} 
                                    style={{ width: SLOT_WIDTH }} 
                                    onDragOver={(e) => {
                                      if (!isValidSlot) return; // Prevent drop if slot doesn't exist on this day
                                      if (draggedItem && checkAvailability(draggedItem, actualSlot.id, roomId)) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onDrop={(e) => {
                                      if (isValidSlot) handleDrop(e, hari, actualSlot.id, roomId);
                                    }}
                                    className={`flex-shrink-0 border-r border-outline-variant/5 transition-colors
                                      ${!isValidSlot ? "bg-surface-variant/20" : ""}
                                      ${draggedItem && isValidSlot && checkAvailability(draggedItem, actualSlot.id, roomId) ? "bg-secondary-container/30 ring-2 ring-secondary/50 inset" : "hover:bg-surface-variant/5"}
                                    `}
                                  >
                                    {!isValidSlot && (
                                      <div className="w-full h-full flex items-center justify-center opacity-20">
                                        <span className="material-symbols-outlined">block</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Course Blocks */}
                            {courses.map((course) => {
                              const startIdx = getSlotIndex(course.slotWaktu?.jamMulai || "");
                              if (startIdx === -1) return null;
                              const sks = course.mataKuliah?.sks || 1;
                              const left = startIdx * SLOT_WIDTH;
                              const width = sks * SLOT_WIDTH - 8;
                              const isConflicting = conflictMap.has(course.id);
                              
                              // Stagger overlapping courses
                              const layer = course._layer || 0;
                              const topOffset = 8 + (layer * 12); 
                              const zIndex = hoveredItem === course.id ? 50 : (20 + layer);

                              return (
                                <div
                                  key={course.id}
                                  draggable
                                  onDragStart={() => setDraggedItem(course)}
                                  onDragEnd={() => setDraggedItem(null)}
                                  onMouseEnter={() => setHoveredItem(course.id)}
                                  onMouseLeave={() => setHoveredItem(null)}
                                  style={{ left: left + 4, width, top: topOffset, bottom: 8, zIndex }}
                                  className={`absolute rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-all duration-200
                                    ${hoveredItem === course.id ? "shadow-md scale-[1.02]" : "shadow-sm"}
                                    ${draggedItem?.id === course.id ? "opacity-30 grayscale" : "opacity-100"}
                                    ${isConflicting ? "bg-red-50 border-red-400 text-red-900 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "bg-blue-50 border-blue-200 text-blue-900"}
                                  `}
                                >
                                  <div className="flex flex-col h-full justify-between">
                                    <div className="overflow-hidden relative">
                                      {isConflicting && (
                                        <span className="material-symbols-outlined text-red-500 text-[14px] absolute right-0 top-0 animate-pulse">warning</span>
                                      )}
                                      <h4 className={`text-[11px] font-bold truncate ${isConflicting ? "pr-4" : ""}`}>{course.mataKuliah?.namaMk}</h4>
                                      <p className="text-[10px] opacity-70 truncate">{course.dosen?.namaDosen}</p>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isConflicting ? "bg-red-200 text-red-800" : "bg-blue-200/50"}`}>
                                        {sks} SKS
                                      </span>
                                      <span className="text-[9px] font-mono opacity-50">{course.slotWaktu?.jamMulai}</span>
                                    </div>
                                  </div>

                                  {/* Tooltip */}
                                  {hoveredItem === course.id && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-surface-container-highest border border-outline-variant p-4 rounded-xl shadow-xl z-[100] text-on-surface">
                                      <div className={`text-[10px] font-bold uppercase mb-1 ${isConflicting ? "text-red-500" : "text-secondary"}`}>
                                        {course.mataKuliah?.kodeMk} {isConflicting && "• KONFLIK"}
                                      </div>
                                      <div className="text-sm font-bold leading-tight mb-2">{course.mataKuliah?.namaMk}</div>
                                      
                                      <div className="space-y-1 text-xs text-on-surface-variant mb-3">
                                        <div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">person</span> {course.dosen?.namaDosen}</div>
                                        <div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">meeting_room</span> {rooms.find(r => r.id === course.idRuangan)?.namaRuangan || course.ruangan?.namaRuangan}</div>
                                        <div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">schedule</span> {course.slotWaktu?.jamMulai} - {course.slotWaktu?.jamSelesai}</div>
                                      </div>

                                      {isConflicting && (
                                        <div className="mt-2 pt-2 border-t border-red-200">
                                          <div className="text-[10px] font-bold text-red-600 uppercase mb-1">Penyebab Bentrok:</div>
                                          <ul className="text-[10px] text-red-700 space-y-1">
                                            {conflictMap.get(course.id)?.map((reason, idx) => (
                                              <li key={idx} className="flex gap-1"><span>•</span> {reason}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-surface-container-highest"></div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Empty State */}
        {!selectedId && (
          <div className="h-[400px] flex flex-col items-center justify-center text-on-surface-variant bg-surface-bright">
            <span className="material-symbols-outlined text-5xl mb-4 opacity-20">event_note</span>
            <p className="font-bold">Silakan pilih jadwal untuk mulai</p>
            <p className="text-sm">Gunakan dropdown di atas untuk memilih hasil komputasi algoritma.</p>
          </div>
        )}
      </div>

      {/* GA Progress Modal (Reusing existing style) */}
      {gaProgress && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant w-full max-w-md p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-[32px] spin">settings</span>
            </div>
            <h2 className="font-headline-md text-[20px] text-on-surface mb-2">Menyusun Jadwal Optimal...</h2>
            <div className="w-full bg-surface-variant rounded-full h-3 mb-2 overflow-hidden mt-4">
              <div className="bg-primary h-3 rounded-full transition-all duration-300" style={{ width: `${(gaProgress.generasi / gaProgress.maxGenerasi) * 100}%` }}></div>
            </div>
            <div className="w-full flex justify-between text-xs text-on-surface-variant font-mono mt-1">
              <span>Generasi {gaProgress.generasi}/{gaProgress.maxGenerasi}</span>
              <span>{Math.round((gaProgress.generasi / gaProgress.maxGenerasi) * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #bbb; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 2s linear infinite; }
      `}</style>
    </div>
  );
}
