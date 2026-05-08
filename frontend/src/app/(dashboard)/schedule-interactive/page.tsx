"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAppStore } from "@/store/useAppStore";
import type { JadwalMaster, JadwalDetail, GAProgress, SlotWaktu, Ruangan, PreferensiWaktuDosen } from "@/types";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const SLOT_WIDTH = 160; // px
const ROW_HEIGHT = 80; // px

const PRODI_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.1)]' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-900', shadow: 'shadow-[0_0_10px_rgba(139,92,246,0.1)]' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', shadow: 'shadow-[0_0_10px_rgba(16,185,129,0.1)]' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', shadow: 'shadow-[0_0_10px_rgba(245,158,11,0.1)]' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', shadow: 'shadow-[0_0_10px_rgba(244,63,94,0.1)]' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', shadow: 'shadow-[0_0_10px_rgba(6,182,212,0.1)]' },
];
const getProdiColor = (idProdi: number = 0) => PRODI_COLORS[idProdi % PRODI_COLORS.length];

export default function InteractiveSchedulePage() {
  const qc = useQueryClient();
  const { gaProgress, setGAProgress } = useAppStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<(JadwalDetail & { sksTotal?: number; slotIds?: number[]; detailIds?: number[] }) | null>(null);
  const [validDropZones, setValidDropZones] = useState<Set<string>>(new Set());
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genForm, setGenForm] = useState({ tahunAkademik: "2025/2026", semesterTipe: "Ganjil", jumlahJadwal: 10, maxGenerasi: 500 });
  
  // New States for UX Improvements
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterConflict, setFilterConflict] = useState(false);
  const [filterProdi, setFilterProdi] = useState("Semua");
  const [filterDosen, setFilterDosen] = useState("Semua");
  const [selectedCourse, setSelectedCourse] = useState<(JadwalDetail & { sksTotal?: number; slotIds?: number[]; detailIds?: number[] }) | null>(null);
  const [lastMove, setLastMove] = useState<{
    detailId: number;
    prevSlotId: number;
    prevRoomId: number;
    detailIds?: number[];
    label: string;
  } | null>(null);

  const { data: schedules = [] } = useQuery<JadwalMaster[]>({ 
    queryKey: ["schedules"], 
    queryFn: () => api.getSchedules() as Promise<JadwalMaster[]> 
  });
  
  const { data: result, isLoading: isResultLoading } = useQuery<JadwalMaster>({ 
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

  const { data: preferensiList = [] } = useQuery<PreferensiWaktuDosen[]>({
    queryKey: ["preferensi"],
    queryFn: () => api.getPreferensi() as Promise<PreferensiWaktuDosen[]>
  });

  // Build preferensi lookup: dosenId -> Set of unavailable slotWaktu IDs
  const preferensiMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const p of preferensiList) {
      if (p.status === "UNAVAILABLE") {
        if (!map.has(p.idDosen)) map.set(p.idDosen, new Set());
        map.get(p.idDosen)!.add(p.idSlotWaktu);
      }
    }
    return map;
  }, [preferensiList]);

  const updateSlotMut = useMutation({
    mutationFn: ({ detailId, data }: { detailId: number; data: any }) => api.updateScheduleSlot(detailId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule-result", selectedId] }); qc.invalidateQueries({ queryKey: ["schedules"] }); },
    onError: (error: any) => alert(error.message || "Gagal menyimpan perubahan."),
  });

  const generateMut = useMutation({
    mutationFn: (d: any) => api.generateSchedule(d),
    onMutate: () => { setIsGenerating(true); setShowGenerate(false); },
    onSuccess: (data: any) => { setSelectedId(data.jadwalMasterId); },
    onError: (error: any) => { setIsGenerating(false); alert(error.message || "Gagal menghubungi server/database."); },
  });

  // Socket.io for real-time progress
  useEffect(() => {
    const socket = connectSocket();
    socket.on("ga_progress", (data: GAProgress) => setGAProgress(data));
    socket.on("ga_completed", () => {
      setGAProgress(null);
      setIsGenerating(false);
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["schedule-result", selectedId] });
    });
    socket.on("ga_error", (data: any) => { 
      setGAProgress(null); 
      setIsGenerating(false); 
      alert("Error: " + data.error); 
    });
    return () => { 
      socket.off("ga_progress"); 
      socket.off("ga_completed"); 
      socket.off("ga_error");
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
          
          // Check consecutive in slot order
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

  // 2. Conflict Map: Based on Sessions — matches backend fitness.ts logic
  const conflictMap = useMemo(() => {
    const map = new Map<number, string[]>();
    if (sessions.length === 0) return map;

    // Helper: add conflict reasons to ALL detail IDs in a session
    const addConflict = (sessionId: number, reason: string) => {
      const existing = map.get(sessionId) || [];
      if (!existing.includes(reason)) existing.push(reason);
      map.set(sessionId, existing);
    };

    for (let i = 0; i < sessions.length; i++) {
      const s1 = sessions[i];

      // 2a. Break Crossing Detection
      if (s1.slotIds.length > 1) {
        const daySlots = slots
          .filter(s => s.hari === s1.slotWaktu?.hari)
          .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
        
        for (let k = 0; k < s1.slotIds.length - 1; k++) {
          const currentSlot = daySlots.find(s => s.id === s1.slotIds[k]);
          const nextSlot = daySlots.find(s => s.id === s1.slotIds[k + 1]);
          if (currentSlot && nextSlot && currentSlot.jamSelesai !== nextSlot.jamMulai) {
            addConflict(s1.id, `Melewati Jam Istirahat (${currentSlot.jamSelesai} → ${nextSlot.jamMulai})`);
            break;
          }
        }
      }

      // 2b. Kapasitas Detection
      const room = rooms.find(r => r.id === s1.idRuangan);
      if (room && s1.mataKuliah && room.kapasitas < (s1.mataKuliah.jumlahMhs || 0)) {
        addConflict(s1.id, `Kapasitas Ruangan tidak cukup (${room.kapasitas} < ${s1.mataKuliah.jumlahMhs} mhs)`);
      }

      // 2b2. Day Overflow Detection
      if (s1.slotIds.length > 1) {
        const firstSlot = slots.find(s => s.id === s1.slotIds[0]);
        const lastSlot = slots.find(s => s.id === s1.slotIds[s1.slotIds.length - 1]);
        if (firstSlot && lastSlot && firstSlot.hari !== lastSlot.hari) {
          addConflict(s1.id, `Durasi melewati hari (${firstSlot.hari} → ${lastSlot.hari})`);
        }
      }

      // 2b3. Preferensi Dosen Detection
      const unavailable = preferensiMap.get(s1.idDosen);
      if (unavailable) {
        for (const slotId of s1.slotIds) {
          if (unavailable.has(slotId)) {
            const slotInfo = slots.find(s => s.id === slotId);
            addConflict(s1.id, `Preferensi Dosen: ${s1.dosen?.namaDosen} tidak tersedia di ${slotInfo?.hari} ${slotInfo?.jamMulai}`);
            break;
          }
        }
      }

      // 2c. Standard Clash Detection — compare with ALL other sessions
      for (let j = i + 1; j < sessions.length; j++) {
        const s2 = sessions[j];

        // Check if any slot IDs overlap (slot IDs are globally unique, so this works across days too)
        const hasOverlap = s1.slotIds.some(id => s2.slotIds.includes(id));
        if (!hasOverlap) continue;

        const reasons1: string[] = [];
        const reasons2: string[] = [];

        if (s1.idRuangan === s2.idRuangan) {
          reasons1.push(`Bentrok Ruangan: ${s2.mataKuliah?.namaMk} menggunakan ruangan yang sama`);
          reasons2.push(`Bentrok Ruangan: ${s1.mataKuliah?.namaMk} menggunakan ruangan yang sama`);
        }
        if (s1.idDosen === s2.idDosen) {
          reasons1.push(`Bentrok Dosen: ${s1.dosen?.namaDosen} mengajar ${s2.mataKuliah?.namaMk} di waktu yang sama`);
          reasons2.push(`Bentrok Dosen: ${s2.dosen?.namaDosen} mengajar ${s1.mataKuliah?.namaMk} di waktu yang sama`);
        }
        if (s1.mataKuliah?.idProdi === s2.mataKuliah?.idProdi && s1.mataKuliah?.semester === s2.mataKuliah?.semester) {
          reasons1.push(`Bentrok Semester: Semester ${s1.mataKuliah?.semester} Prodi ${s1.mataKuliah?.prodi?.namaProdi} memiliki kuliah lain`);
          reasons2.push(`Bentrok Semester: Semester ${s2.mataKuliah?.semester} Prodi ${s2.mataKuliah?.prodi?.namaProdi} memiliki kuliah lain`);
        }

        if (reasons1.length > 0) {
          reasons1.forEach(r => addConflict(s1.id, r));
          reasons2.forEach(r => addConflict(s2.id, r));
        }
      }
    }
    return map;
  }, [sessions, slots, rooms, preferensiMap]);

  // Live conflict count: total unique sessions with conflicts (computed from current data)
  const liveConflictCount = useMemo(() => {
    return conflictMap.size;
  }, [conflictMap]);

  // 3. Organized data for UI: Day -> Room -> Sessions
  const organizedData = useMemo(() => {
    const data: Record<string, Record<number, any[]>> = {};
    
    // Apply filters
    const filteredSessions = sessions.filter(s => {
      if (filterConflict && !conflictMap.has(s.id)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.mataKuliah?.namaMk?.toLowerCase().includes(q) && !s.dosen?.namaDosen?.toLowerCase().includes(q)) return false;
      }
      if (filterProdi !== "Semua" && s.mataKuliah?.prodi?.namaProdi !== filterProdi) return false;
      if (filterDosen !== "Semua" && s.dosen?.namaDosen !== filterDosen) return false;
      return true;
    });

    HARI.forEach(hari => {
      data[hari] = {};
      const daySessions = filteredSessions.filter(s => s.slotWaktu?.hari === hari);
      
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
  }, [sessions, searchQuery, filterConflict, filterProdi, filterDosen, conflictMap]);

  const getSlotIndex = (jamMulai: string) => {
    return timeLabels.findIndex(t => t.start === jamMulai);
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

    const sks = (item as any).sksTotal || item.mataKuliah?.sks || 1;
    const daySlots = slots
      .filter(s => s.hari === targetSlot.hari)
      .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
    
    const startIdx = daySlots.findIndex(s => s.id === slotId);
    if (startIdx === -1 || (startIdx + sks) > daySlots.length) return false;

    const targetSlotIds = daySlots.slice(startIdx, startIdx + sks).map(s => s.id);

    // Check Break Crossing: ensure no time gap between consecutive target slots
    const targetSlotRange = daySlots.slice(startIdx, startIdx + sks);
    for (let k = 0; k < targetSlotRange.length - 1; k++) {
      if (targetSlotRange[k].jamSelesai !== targetSlotRange[k + 1].jamMulai) {
        return false; // Would cross a break period
      }
    }
    
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

  const handleDragStart = useCallback((course: any) => {
    setDraggedItem(course);
    
    // Pre-calculate valid drop zones ONCE per drag to avoid millions of loop checks
    const newValidZones = new Set<string>();
    HARI.forEach(hari => {
      rooms.forEach(room => {
        slots.forEach(slot => {
          if (slot.hari === hari && checkAvailability(course, slot.id, room.id)) {
            newValidZones.add(`${hari}-${room.id}-${slot.id}`);
          }
        });
      });
    });
    setValidDropZones(newValidZones);
  }, [rooms, slots, checkAvailability]);

  const handleDrop = (e: React.DragEvent, hari: string, slotId: number, roomId: number) => {
    e.preventDefault();
    if (!draggedItem) return;
    
    setLastMove({
      detailId: draggedItem.id,
      prevSlotId: draggedItem.idSlotWaktu,
      prevRoomId: draggedItem.idRuangan,
      detailIds: draggedItem.detailIds,
      label: draggedItem.mataKuliah?.namaMk || "Sesi"
    });
    
    updateSlotMut.mutate({ 
      detailId: draggedItem.id, 
      data: { idSlotWaktu: slotId, idRuangan: roomId, detailIds: draggedItem.detailIds } 
    });
    setDraggedItem(null);
    
    setTimeout(() => setLastMove(null), 5000); // Clear undo toast after 5s
  };

  const handleUndo = () => {
    if (!lastMove) return;
    updateSlotMut.mutate({
      detailId: lastMove.detailId,
      data: { idSlotWaktu: lastMove.prevSlotId, idRuangan: lastMove.prevRoomId, detailIds: lastMove.detailIds }
    });
    setLastMove(null);
  };

  return (
    <div className="min-h-screen bg-surface-bright p-6 animate-fade-in">
      {/* Header & Controls Section */}
      <div className="mb-8 space-y-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-on-surface">Interactive Timeline Schedule</h2>
            {result && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                result.status === 'FINAL' 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : result.status === 'GENERATING' 
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                  : 'bg-gray-100 text-gray-800 border border-gray-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${result.status === 'FINAL' ? 'bg-green-500' : result.status === 'GENERATING' ? 'bg-yellow-500' : 'bg-gray-500'}`}></span>
                {result.status}
              </span>
            )}
            {result && liveConflictCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                {liveConflictCount} konflik terdeteksi
              </span>
            )}
          </div>
          <p className="text-on-surface-variant text-sm mt-1">Visualisasi jadwal dengan drag & drop dan durasi SKS yang jelas.</p>
        </div>

        <div className="flex flex-col gap-4 p-4 bg-white border border-outline-variant rounded-xl shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
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
                    {s.tahunAkademik} {s.semesterTipe} - {s.status}{s.id === selectedId && liveConflictCount > 0 ? ` ⚠ ${liveConflictCount} konflik terdeteksi` : s.conflictCount ? ` (Konflik: ${s.conflictCount})` : ''}
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
            
            <button onClick={() => setShowGenerate(true)} className="px-6 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Generate Jadwal
            </button>
          </div>

          {/* Filters & Zoom */}
          <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/30 pt-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input 
                placeholder="Cari matkul/dosen..."
                className="pl-9 pr-3 py-1.5 border border-outline-variant rounded-lg w-[200px] text-sm focus:ring-1"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <button 
              onClick={() => setFilterConflict(!filterConflict)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filterConflict ? 'bg-red-100 text-red-700 border-red-300' : 'bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-variant/20'}`}
            >
              ⚠ Hanya Konflik
            </button>
            
            <div className="relative flex items-center gap-2 text-xs">
              <span className="font-semibold text-on-surface-variant">Zoom:</span>
              <button onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.1))} className="p-1 rounded hover:bg-surface-variant"><span className="material-symbols-outlined text-sm">zoom_out</span></button>
              <span className="w-8 text-center font-mono">{Math.round(zoomLevel * 100)}%</span>
              <button onClick={() => setZoomLevel(z => Math.min(1.5, z + 0.1))} className="p-1 rounded hover:bg-surface-variant"><span className="material-symbols-outlined text-sm">zoom_in</span></button>
              <button onClick={() => setZoomLevel(1)} className="p-1 rounded hover:bg-surface-variant"><span className="material-symbols-outlined text-sm">fit_screen</span></button>
            </div>
            
            <div className="flex-1"></div>
            
            {/* Stats */}
            {sessions.length > 0 && (
              <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> {sessions.length} Sesi</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> {liveConflictCount} Konflik</div>
                <div className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">analytics</span> Fit: {result?.fitnessScore?.toFixed(4) || "0.000"}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warning banner when FINAL schedule has live conflicts */}
      {result && result.status === 'FINAL' && liveConflictCount > 0 && (
        <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-900 mb-4">
          <span className="material-symbols-outlined text-amber-600 text-[20px]">info</span>
          <p className="text-xs font-medium">
            Jadwal ini berstatus <strong>FINAL</strong>, namun terdeteksi <strong>{liveConflictCount} konflik baru</strong> akibat perubahan data (preferensi dosen, dll). Status tetap FINAL, namun konflik perlu ditinjau.
          </p>
        </div>
      )}

      {/* Main Grid Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant overflow-hidden flex flex-col w-full h-[calc(100vh-320px)] min-h-[500px]">
        
        {/* Scrollable Area (Horizontal & Vertical) */}
        {isResultLoading ? (
          <div className="flex-1 p-6 grid gap-4 bg-surface-bright overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-[160px] h-[80px] bg-surface-variant/30 rounded-lg animate-pulse" />
                <div className="flex-1 flex gap-2">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} className="flex-1 h-[80px] bg-surface-variant/20 rounded-lg animate-pulse" style={{ animationDelay: `${j * 100}ms` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="overflow-auto custom-scrollbar flex-1 w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Ensure this div is wide enough to force horizontal scroll */}
          <div className="inline-block min-w-full transition-all duration-300" style={{ width: (timeLabels.length * (SLOT_WIDTH * zoomLevel)) + 160 }}>
            
            {/* Header: Time Slots */}
            <div className="flex flex-col sticky top-0 bg-surface-container-low z-30 shadow-sm">
              <div className="flex px-4 py-2 bg-surface-bright border-b border-outline-variant/50 text-xs items-center gap-4">
                <span className="font-bold text-on-surface-variant">Legend:</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-400"></span> Konflik</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></span> TI</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200"></span> SI</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200"></span> BD</span>
              </div>
              <div className="flex border-b border-outline-variant">
                <div className="w-[160px] flex-shrink-0 p-4 border-r border-outline-variant flex items-center justify-center font-bold text-xs uppercase tracking-wider text-on-surface-variant bg-surface-container-low sticky left-0 z-40">
                  Hari \ Waktu
                </div>
                <div className="flex flex-1">
                  {timeLabels.map((time, idx) => (
                    <div key={idx} style={{ width: SLOT_WIDTH * zoomLevel }} className="flex-shrink-0 p-3 flex flex-col items-center justify-center border-r border-outline-variant/30 overflow-hidden">
                      <span className="text-sm font-bold text-on-surface">{time.start}</span>
                      <span className="text-[10px] text-on-surface-variant">{time.end}</span>
                    </div>
                  ))}
                </div>
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
                                const isDropValid = draggedItem && actualSlot && validDropZones.has(`${hari}-${roomId}-${actualSlot.id}`);

                                return (
                                  <div 
                                    key={idx} 
                                    style={{ width: SLOT_WIDTH * zoomLevel }} 
                                    onDragOver={(e) => {
                                      if (!isValidSlot) return; 
                                      if (isDropValid) e.preventDefault();
                                    }}
                                    onDrop={(e) => {
                                      if (isValidSlot && isDropValid) handleDrop(e, hari, actualSlot.id, roomId);
                                    }}
                                    className={`flex-shrink-0 border-r border-outline-variant/5 transition-colors relative
                                      ${!isValidSlot ? "bg-surface-variant/20" : ""}
                                      ${isDropValid ? "bg-green-100/40 ring-2 ring-green-400/60 inset animate-pulse" : draggedItem && isValidSlot ? "bg-red-50/30 ring-1 ring-red-200/40 inset cursor-not-allowed" : "hover:bg-surface-variant/5"}
                                    `}
                                  >
                                    {isDropValid && (
                                      <div className="absolute inset-1 border-2 border-dashed border-green-400 rounded-lg opacity-60 flex items-center justify-center text-green-600 text-xs font-bold pointer-events-none z-10">
                                        <span className="material-symbols-outlined text-sm mr-1">add_circle</span> Drop
                                      </div>
                                    )}
                                    {!isValidSlot && (
                                      <div className="w-full h-full flex items-center justify-center opacity-20 pointer-events-none">
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
                              const sks = course.sksTotal || course.mataKuliah?.sks || 1;
                              const left = startIdx * (SLOT_WIDTH * zoomLevel);
                              const width = sks * (SLOT_WIDTH * zoomLevel) - 8;
                              const isConflicting = conflictMap.has(course.id);
                              
                              // Stagger overlapping courses
                              const layer = course._layer || 0;
                              const prodiColor = getProdiColor(course.mataKuliah?.idProdi);

                              return (
                                <CourseBlock
                                  key={course.id}
                                  course={course}
                                  zoomLevel={zoomLevel}
                                  SLOT_WIDTH={SLOT_WIDTH}
                                  startIdx={startIdx}
                                  sks={sks}
                                  isConflicting={isConflicting}
                                  conflictReasons={conflictMap.get(course.id)}
                                  prodiColor={prodiColor}
                                  roomName={rooms.find(r => r.id === course.idRuangan)?.namaRuangan || course.ruangan?.namaRuangan}
                                  layer={layer}
                                  isDragged={draggedItem?.id === course.id}
                                  onDragStart={handleDragStart}
                                  onDragEnd={() => setDraggedItem(null)}
                                  onSelect={setSelectedCourse}
                                />
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
        )}

        {/* Empty State */}
        {!selectedId && (
          <div className="h-[400px] flex flex-col items-center justify-center text-on-surface-variant bg-surface-bright">
            <span className="material-symbols-outlined text-5xl mb-4 opacity-20">event_note</span>
            <p className="font-bold">Silakan pilih jadwal untuk mulai</p>
            <p className="text-sm">Gunakan dropdown di atas untuk memilih hasil komputasi algoritma.</p>
          </div>
        )}
      </div>

      {/* Undo Toast */}
      {lastMove && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4 animate-fade-in border border-outline-variant/20">
          <span className="material-symbols-outlined text-green-400">check_circle</span>
          <span className="text-sm font-medium">"{lastMove.label}" berhasil dipindahkan</span>
          <div className="w-px h-4 bg-outline-variant/30"></div>
          <button onClick={handleUndo} className="text-primary-container font-bold text-sm hover:underline tracking-wider">
            UNDO
          </button>
        </div>
      )}

      {/* Detail Panel */}
      {selectedCourse && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t-2 border-primary shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[90] p-6 animate-slide-up">
          <div className="max-w-7xl mx-auto relative">
            <button 
              onClick={() => setSelectedCourse(null)}
              className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-surface-variant text-on-surface-variant rounded-full hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <div className="text-xs font-bold text-primary mb-1">{selectedCourse.mataKuliah?.kodeMk}</div>
                <h3 className="text-lg font-bold leading-tight mb-2">{selectedCourse.mataKuliah?.namaMk}</h3>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-surface-variant rounded text-xs font-bold">{selectedCourse.sksTotal || selectedCourse.mataKuliah?.sks} SKS</span>
                  <span className="px-2 py-1 bg-surface-variant rounded text-xs">Sem {selectedCourse.mataKuliah?.semester}</span>
                  <span className="px-2 py-1 bg-surface-variant rounded text-xs">{selectedCourse.mataKuliah?.prodi?.namaProdi}</span>
                </div>
              </div>
              <div className="md:col-span-1 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">person</span>
                  <div>
                    <div className="text-xs text-on-surface-variant">Dosen Pengampu</div>
                    <div className="font-semibold">{selectedCourse.dosen?.namaDosen}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">meeting_room</span>
                  <div>
                    <div className="text-xs text-on-surface-variant">Ruangan</div>
                    <div className="font-semibold">{rooms.find(r => r.id === selectedCourse.idRuangan)?.namaRuangan} <span className="text-xs text-outline font-normal">(Kap: {rooms.find(r => r.id === selectedCourse.idRuangan)?.kapasitas})</span></div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-1 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">schedule</span>
                  <div>
                    <div className="text-xs text-on-surface-variant">Waktu</div>
                    <div className="font-semibold">{selectedCourse.slotWaktu?.hari}, {selectedCourse.slotWaktu?.jamMulai} - {selectedCourse.slotWaktu?.jamSelesai}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">groups</span>
                  <div>
                    <div className="text-xs text-on-surface-variant">Jumlah Mhs</div>
                    <div className="font-semibold">{selectedCourse.mataKuliah?.jumlahMhs || 0} Mahasiswa</div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-1">
                {conflictMap.has(selectedCourse.id) ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">warning</span> KONFLIK TERDETEKSI
                    </div>
                    <ul className="text-xs text-red-800 space-y-1 ml-4 list-disc">
                      {conflictMap.get(selectedCourse.id)?.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-800">
                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                    <span className="text-sm font-semibold">Tidak ada konflik</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GA Progress Modal */}
      {(isGenerating || gaProgress) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant w-full max-w-md p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-[32px] spin">settings</span>
            </div>
            <h2 className="font-headline-md text-[20px] text-on-surface mb-2">
              {gaProgress ? "Menyusun Jadwal Optimal..." : "Mempersiapkan Algoritma..."}
            </h2>
            <p className="text-on-surface-variant font-label-sm text-sm mb-6">
              {gaProgress ? "Mengevaluasi mutasi pada populasi..." : "Menginisialisasi data dan memulai komputasi..."}
            </p>
            
            <div className="w-full bg-surface-variant rounded-full h-3 mb-2 overflow-hidden mt-4">
              {gaProgress ? (
                <div 
                  className="bg-primary h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${(gaProgress.generasi / gaProgress.maxGenerasi) * 100}%` }}
                ></div>
              ) : (
                <div className="bg-primary h-3 rounded-full animate-pulse w-[15%]"></div>
              )}
            </div>
            <div className="w-full flex justify-between text-xs text-on-surface-variant font-mono mt-1">
              {gaProgress ? (
                <>
                  <span>Generasi {gaProgress.generasi}/{gaProgress.maxGenerasi}</span>
                  <span>{Math.round((gaProgress.generasi / gaProgress.maxGenerasi) * 100)}%</span>
                </>
              ) : (
                <>
                  <span>Memuat data...</span>
                  <span>0%</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-outline italic mt-4">Mohon tunggu, komputasi algoritma membutuhkan waktu beberapa saat.</p>
          </div>
        </div>
      )}

      {/* Generate Schedule Modal */}
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
                <button type="button" onClick={() => setShowGenerate(false)} className="px-4 py-2 border border-outline text-on-surface font-label-sm text-sm font-semibold rounded-lg hover:bg-surface-variant transition-colors flex-1">Batal</button>
                <button type="submit" disabled={generateMut.isPending} className="px-4 py-2 bg-primary text-on-primary font-label-sm text-sm font-semibold rounded-lg hover:bg-primary-container transition-colors flex-1">{generateMut.isPending ? "Memulai..." : "Generate"}</button>
              </div>
            </form>
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

// Subcomponent to optimize rendering and prevent global updates on hover
function CourseBlock({ course, zoomLevel, SLOT_WIDTH, startIdx, sks, isConflicting, conflictReasons, prodiColor, roomName, layer, isDragged, onDragStart, onDragEnd, onSelect }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const left = startIdx * (SLOT_WIDTH * zoomLevel);
  const width = sks * (SLOT_WIDTH * zoomLevel) - 8;
  const topOffset = 8 + (layer * 12); 
  const zIndex = isHovered ? 50 : (20 + layer);

  return (
    <div
      draggable
      tabIndex={0}
      role="button"
      aria-label={`${course.mataKuliah?.namaMk} - ${course.dosen?.namaDosen} - ${sks} SKS`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(course);
        if (e.key === 'Escape') onSelect(null);
      }}
      onClick={() => onSelect(course)}
      onDragStart={() => onDragStart(course)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      style={{ left: left + 4, width, top: topOffset, bottom: 8, zIndex }}
      className={`absolute rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-all duration-200
        ${isHovered ? "scale-[1.02] z-50 shadow-lg" : "overflow-hidden"}
        ${isDragged ? "opacity-30 grayscale" : "opacity-100"}
        ${isConflicting 
          ? "bg-red-50 border-red-400 text-red-900 shadow-[0_0_10px_rgba(239,68,68,0.2)] ring-1 ring-red-400/50" 
          : `${prodiColor.bg} ${prodiColor.border} ${prodiColor.text} ${prodiColor.shadow}`}
      `}
    >
      <div className="flex flex-col h-full justify-between pointer-events-none">
        <div className="overflow-hidden relative">
          {isConflicting && (
            <span className="material-symbols-outlined text-red-500 text-[14px] absolute right-0 top-0 animate-pulse">warning</span>
          )}
          <h4 className={`text-[11px] font-bold truncate ${isConflicting ? "pr-4" : ""}`}>{course.mataKuliah?.namaMk}</h4>
          <p className="text-[10px] opacity-70 truncate">{course.dosen?.namaDosen}</p>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isConflicting ? "bg-red-200 text-red-800" : "bg-black/10"}`}>
            {sks} SKS
          </span>
          <span className="text-[9px] font-mono opacity-50">{course.slotWaktu?.jamMulai}</span>
        </div>
      </div>

      {isHovered && (
        <div 
          className={`absolute left-1/2 -translate-x-1/2 w-72 bg-surface-container-highest border border-outline-variant p-4 rounded-xl shadow-xl z-[100] text-on-surface transition-opacity cursor-default
            ${topOffset < 150 ? 'top-full mt-2' : 'bottom-full mb-2'}
          `}
          onClick={e => e.stopPropagation()}
        >
          <div className={`text-[10px] font-bold uppercase mb-1 ${isConflicting ? "text-red-500" : "text-secondary"}`}>
            {course.mataKuliah?.kodeMk} {isConflicting && "• KONFLIK"}
          </div>
          <div className="text-sm font-bold leading-tight mb-2">{course.mataKuliah?.namaMk}</div>
          
          <div className="space-y-1 text-xs text-on-surface-variant mb-3">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">person</span> {course.dosen?.namaDosen}</div>
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">meeting_room</span> {roomName}</div>
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">schedule</span> {course.slotWaktu?.jamMulai} - {course.slotWaktu?.jamSelesai}</div>
          </div>

          {isConflicting && conflictReasons && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <div className="text-[10px] font-bold text-red-600 uppercase mb-1">Penyebab Bentrok:</div>
              <ul className="text-[10px] text-red-700 space-y-1">
                {conflictReasons.map((reason: string, idx: number) => (
                  <li key={idx} className="flex gap-1"><span>•</span> {reason}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className={`absolute left-1/2 -translate-x-1/2 border-8 border-transparent 
            ${topOffset < 150 ? 'bottom-full border-b-surface-container-highest' : 'top-full border-t-surface-container-highest'}
          `}></div>
        </div>
      )}
    </div>
  );
}
