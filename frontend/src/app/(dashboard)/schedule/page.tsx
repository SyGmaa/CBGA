"use client";
import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAppStore } from "@/store/useAppStore";
import type { JadwalMaster, JadwalDetail, GAProgress, SlotWaktu, Ruangan, PreferensiWaktuDosen } from "@/types";
import ExcelJS from "exceljs";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const SLOT_WIDTH = 160; // px
const ROW_HEIGHT = 80; // px

const PRODI_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.1)]' },
];
const getProdiColor = (idProdi: number = 0) => PRODI_COLORS[idProdi % PRODI_COLORS.length];

export default function SchedulePage() {
  const qc = useQueryClient();
  const { gaProgress, setGAProgress } = useAppStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<(JadwalDetail & { sksTotal?: number; slotIds?: number[]; detailIds?: number[] }) | null>(null);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genForm, setGenForm] = useState({ tahunAkademik: "2025/2026", semesterTipe: "Ganjil", jumlahJadwal: 1, maxGenerasi: 500 });
  const [showManage, setShowManage] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<number[]>([]);
  
  // New States for UX Improvements
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterConflict, setFilterConflict] = useState(false);
  const [filterProdi, setFilterProdi] = useState("Semua");
  const [filterDosen, setFilterDosen] = useState("Semua");
  const [filterRoom, setFilterRoom] = useState("Semua");
  const [selectedCourse, setSelectedCourse] = useState<(JadwalDetail & { sksTotal?: number; slotIds?: number[]; detailIds?: number[] }) | null>(null);
  const [lastMove, setLastMove] = useState<{
    detailId: number;
    prevSlotId: number;
    prevRoomId: number;
    detailIds?: number[];
    label: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoFit, setIsAutoFit] = useState(true);

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
    onMutate: async (newMove) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ["schedule-result", selectedId] });

      // Snapshot the previous value
      const previousSchedule = qc.getQueryData(["schedule-result", selectedId]);

      // Optimistically update to the new value
      if (previousSchedule && selectedId) {
        qc.setQueryData(["schedule-result", selectedId], (old: any) => {
          if (!old) return old;

          const startSlot = slots.find(s => s.id === newMove.data.idSlotWaktu);
          if (!startSlot) return old;

          const daySlots = slots
            .filter(s => s.hari === startSlot.hari)
            .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
          
          const startIdx = daySlots.findIndex(s => s.id === startSlot.id);
          const detailIds = newMove.data.detailIds || [];

          // Create a new array of details with the updated ones
          const newDetails = old.jadwalDetail.map((d: any) => {
            const idxInSession = detailIds.indexOf(d.id);
            if (idxInSession !== -1) {
              const nextSlot = daySlots[startIdx + idxInSession];
              return { 
                ...d, 
                idRuangan: newMove.data.idRuangan, 
                idSlotWaktu: nextSlot?.id || d.idSlotWaktu,
                slotWaktu: nextSlot || d.slotWaktu,
                ruangan: rooms.find(r => r.id === newMove.data.idRuangan) || d.ruangan
              };
            }
            return d;
          });

          return { ...old, jadwalDetail: newDetails };
        });
      }

      return { previousSchedule };
    },
    onError: (error: any, newMove, context) => {
      // Roll back to the previous state if the mutation fails
      if (context?.previousSchedule) {
        qc.setQueryData(["schedule-result", selectedId], context.previousSchedule);
      }
      alert(error.message || "Gagal menyimpan perubahan. Mengembalikan ke posisi semula.");
    },
    onSettled: () => {
      // Always refetch after error or success to ensure synchronization
      qc.invalidateQueries({ queryKey: ["schedule-result", selectedId] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  const generateMut = useMutation({
    mutationFn: (d: any) => api.generateSchedule(d),
    onMutate: () => { setIsGenerating(true); setShowGenerate(false); },
    onSuccess: (data: any) => { setSelectedId(data.jadwalMasterId); },
    onError: (error: any) => { setIsGenerating(false); alert(error.message || "Gagal menghubungi server/database."); },
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

  // Build lookup maps for faster conflict checking
  const detailsBySlot = useMemo(() => {
    const map = new Map<number, JadwalDetail[]>();
    if (!result?.jadwalDetail) return map;
    
    result.jadwalDetail.forEach(d => {
      if (!map.has(d.idSlotWaktu)) map.set(d.idSlotWaktu, []);
      map.get(d.idSlotWaktu)!.push(d);
    });
    return map;
  }, [result?.jadwalDetail]);

  const detailsByDosen = useMemo(() => {
    const map = new Map<number, JadwalDetail[]>();
    if (!result?.jadwalDetail) return map;

    result.jadwalDetail.forEach(d => {
      if (!map.has(d.idDosen)) map.set(d.idDosen, []);
      map.get(d.idDosen)!.push(d);
    });
    return map;
  }, [result?.jadwalDetail]);

  const detailsBySemester = useMemo(() => {
    const map = new Map<string, JadwalDetail[]>();
    if (!result?.jadwalDetail) return map;

    result.jadwalDetail.forEach(d => {
      const key = `${d.mataKuliah?.idProdi}-${d.mataKuliah?.semester}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return map;
  }, [result?.jadwalDetail]);

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

  const prodiOptions = useMemo(() => {
    return ["Semua", ...Array.from(new Set(sessions.map(s => s.mataKuliah?.prodi?.namaProdi).filter(Boolean))).sort()];
  }, [sessions]);

  const dosenOptions = useMemo(() => {
    return ["Semua", ...Array.from(new Set(sessions.map(s => s.dosen?.namaDosen).filter(Boolean))).sort()];
  }, [sessions]);

  const roomOptions = useMemo(() => {
    return ["Semua", ...Array.from(new Set(rooms.map(r => r.namaRuangan).filter(Boolean))).sort()];
  }, [rooms]);

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
      if (filterRoom !== "Semua" && (s.ruangan?.namaRuangan || `Ruangan ${s.idRuangan}`) !== filterRoom) return false;
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
  }, [sessions, searchQuery, filterConflict, filterProdi, filterDosen, filterRoom, conflictMap, rooms]);

  const getSlotIndex = (jamMulai: string) => {
    return timeLabels.findIndex(t => t.start === jamMulai);
  };

  const checkAvailability = useCallback((item: JadwalDetail & { detailIds?: number[] }, slotId: number, roomId: number) => {
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

    const targetSlotRange = daySlots.slice(startIdx, startIdx + sks);
    const targetSlotIds = targetSlotRange.map(s => s.id);

    // Check Break Crossing: ensure no time gap between consecutive target slots
    for (let k = 0; k < targetSlotRange.length - 1; k++) {
      if (targetSlotRange[k].jamSelesai !== targetSlotRange[k + 1].jamMulai) {
        return false; 
      }
    }
    
    const ignoredDetailIds = new Set(item.detailIds || [item.id]);

    for (const sId of targetSlotIds) {
      const others = detailsBySlot.get(sId);
      if (!others) continue;

      for (const other of others) {
        if (ignoredDetailIds.has(other.id)) continue;

        const isRoomClash = roomId === other.idRuangan;
        const isDosenClash = item.idDosen === other.idDosen;
        const isSemesterClash = item.mataKuliah?.idProdi === other.mataKuliah?.idProdi && 
                              item.mataKuliah?.semester === other.mataKuliah?.semester;
        
        if (isRoomClash || isDosenClash || isSemesterClash) return false;
      }
    }

    return true;
  }, [result?.jadwalDetail, slots, rooms, detailsBySlot]);

  const moveSuggestions = useMemo(() => {
    if (!selectedCourse || !slots.length || !rooms.length) return [];
    
    const suggestions: { slotId: number; roomId: number; hari: string; jamMulai: string; jamSelesai: string; roomName: string }[] = [];
    
    // Scan through all days, rooms, and slots to find conflict-free options
    for (const hari of HARI) {
      // Find slots for this day
      const daySlots = slots.filter(s => s.hari === hari).sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
      
      for (const room of rooms) {
        for (const slot of daySlots) {
          // Skip current position
          if (slot.id === selectedCourse.idSlotWaktu && room.id === selectedCourse.idRuangan) continue;

          if (checkAvailability(selectedCourse, slot.id, room.id)) {
            // Find the end slot to show the full time range
            const sks = selectedCourse.sksTotal || selectedCourse.mataKuliah?.sks || 1;
            const startIdx = daySlots.findIndex(s => s.id === slot.id);
            const endSlot = daySlots[startIdx + sks - 1];

            suggestions.push({
              slotId: slot.id,
              roomId: room.id,
              hari: hari,
              jamMulai: slot.jamMulai,
              jamSelesai: endSlot?.jamSelesai || slot.jamSelesai,
              roomName: room.namaRuangan
            });

            if (suggestions.length >= 8) break; // Limit to 8 suggestions for UI clarity
          }
        }
        if (suggestions.length >= 8) break;
      }
      if (suggestions.length >= 8) break;
    }
    return suggestions;
  }, [selectedCourse, rooms, slots, checkAvailability]);

  const handleDragStart = useCallback((course: any) => {
    setDraggedItem(course);
  }, []);

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

  const handleFitScreen = useCallback(() => {
    if (containerRef.current && timeLabels.length > 0) {
      const containerWidth = containerRef.current.clientWidth;
      if (containerWidth < 100) return; // Don't calculate if container is too small or hidden
      
      const dayLabelWidth = 160;
      const availableWidth = containerWidth - dayLabelWidth - 24; // Precision buffer
      const targetZoom = availableWidth / (timeLabels.length * SLOT_WIDTH);
      setZoomLevel(Math.max(0.4, Math.min(1.2, targetZoom)));
    }
  }, [timeLabels.length]);

  // Handle Resize and Sidebar shifts automatically
  useEffect(() => {
    if (!containerRef.current || !isAutoFit) return;
    
    const observer = new ResizeObserver(() => {
      // Use requestAnimationFrame to ensure layout has settled
      requestAnimationFrame(handleFitScreen);
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [handleFitScreen, isAutoFit]);

  // Auto-fit screen when schedule is loaded
  useEffect(() => {
    if (selectedId && result && timeLabels.length > 0) {
      setIsAutoFit(true);
      handleFitScreen();
      
      // Ensure we catch the final width after any layout shifts or sidebar transitions
      const timers = [
        setTimeout(handleFitScreen, 100),
        setTimeout(handleFitScreen, 400) // Slightly after the 300ms sidebar transition
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [selectedId, !!result, timeLabels.length, handleFitScreen]);

  const handleExportExcel = async () => {
    if (!result || !result.jadwalDetail || sessions.length === 0) {
      alert("Tidak ada data jadwal untuk diekspor.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CBGA Scheduler';
      
      const colors = ["E3F2FD", "F3E5F5", "E8F5E9", "FFF3E0", "F1F8E9", "FFFDE7", "E0F2F1", "FCE4EC", "F5F5F5"];
      const sheetNames = new Set<string>();

      const getUniqueSafeName = (name: string) => {
        let safe = String(name).replace(/[\\/?*\[\]:]/g, "").substring(0, 31);
        if (!safe) safe = "Sheet";
        let finalName = safe;
        let counter = 1;
        while (sheetNames.has(finalName.toLowerCase())) {
          const suffix = ` (${counter})`;
          finalName = safe.substring(0, 31 - suffix.length) + suffix;
          counter++;
        }
        sheetNames.add(finalName.toLowerCase());
        return finalName;
      };

      const appendGridTable = (worksheet: ExcelJS.Worksheet, startRowIdx: number, dataSessions: typeof sessions, rowType: 'ROOM' | 'SEMESTER', title?: string) => {
        let currentRowIdx = startRowIdx;

        // 1. Add Title Row if provided
        if (title) {
          const titleRow = worksheet.getRow(currentRowIdx);
          titleRow.height = 30;
          const titleCell = titleRow.getCell(1);
          titleCell.value = title;
          titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A237E' } };
          titleCell.alignment = { vertical: 'middle' };
          worksheet.mergeCells(currentRowIdx, 1, currentRowIdx, 5);
          currentRowIdx++;
        }

        // 2. Setup Columns (Only if first table or we want to re-header)
        // We always re-header for clarity between semesters
        const headerRow = worksheet.getRow(currentRowIdx);
        headerRow.height = 25;
        
        const colHeaders = ['Hari', rowType === 'ROOM' ? 'Ruangan' : 'Semester'];
        timeLabels.forEach(t => colHeaders.push(`${t.start} - ${t.end}`));
        
        colHeaders.forEach((h, i) => {
          const cell = headerRow.getCell(i + 1);
          cell.value = h;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F51B5' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        currentRowIdx++;

        // 3. Data Population
        HARI.forEach(day => {
          const daySessions = dataSessions.filter(s => s.slotWaktu?.hari === day);
          if (daySessions.length === 0) return;

          const rowHeaders = Array.from(new Set(daySessions.map(s => 
            rowType === 'ROOM' 
              ? (s.ruangan?.namaRuangan || `Ruangan ${s.idRuangan}`) 
              : `Semester ${s.mataKuliah?.semester}`
          ))).sort();

          rowHeaders.forEach((header) => {
            const row = worksheet.getRow(currentRowIdx);
            row.height = 70;
            
            const cellHari = row.getCell(1);
            const cellHeader = row.getCell(2);
            cellHari.value = day;
            cellHeader.value = header;
            
            [cellHari, cellHeader].forEach(c => {
              c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
              c.font = { bold: true };
              c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
              c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            const sessionsInRow = daySessions.filter(s => 
              (rowType === 'ROOM' 
                ? (s.ruangan?.namaRuangan || `Ruangan ${s.idRuangan}`) 
                : `Semester ${s.mataKuliah?.semester}`) === header
            );

            sessionsInRow.forEach(session => {
              const startIdx = getSlotIndex(session.slotWaktu?.jamMulai || "");
              if (startIdx === -1) return;
              
              const colIdx = startIdx + 3;
              const sks = session.sksTotal || session.mataKuliah?.sks || 1;
              const cell = row.getCell(colIdx);
              
              cell.value = `${session.mataKuliah?.namaMk}\n(${session.mataKuliah?.kodeMk})\n${session.dosen?.namaDosen}\n${rowType === 'ROOM' ? (session.mataKuliah?.prodi?.namaProdi) : (session.ruangan?.namaRuangan)}`;
              cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
              cell.font = { size: 9, bold: true };
              
              const prodiId = session.mataKuliah?.idProdi || 0;
              const bgColor = colors[prodiId % colors.length];
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor } };

              const hasConflict = conflictMap.has(session.id);
              cell.border = {
                top: { style: hasConflict ? 'thick' : 'thin', color: { argb: hasConflict ? 'FFFF0000' : 'FF000000' } },
                left: { style: hasConflict ? 'thick' : 'thin', color: { argb: hasConflict ? 'FFFF0000' : 'FF000000' } },
                bottom: { style: hasConflict ? 'thick' : 'thin', color: { argb: hasConflict ? 'FFFF0000' : 'FF000000' } },
                right: { style: hasConflict ? 'thick' : 'thin', color: { argb: hasConflict ? 'FFFF0000' : 'FF000000' } },
              };
              if (hasConflict) cell.font = { ...cell.font, color: { argb: 'FFB71C1C' } };

              if (sks > 1) {
                try { worksheet.mergeCells(currentRowIdx, colIdx, currentRowIdx, colIdx + sks - 1); } catch(e) {}
              }
            });
            currentRowIdx++;
          });
          const spacerRow = worksheet.getRow(currentRowIdx);
          spacerRow.height = 10;
          currentRowIdx++;
        });

        return currentRowIdx + 2; // Return next row with gap
      };

      // 3. Create Sheets
      // Sheet 1: Semua Jadwal
      const wsAll = workbook.addWorksheet(getUniqueSafeName("Semua Jadwal (Grid)"));
      // Setup column widths once
      wsAll.columns = [
        { width: 15 }, { width: 20 }, ...timeLabels.map(() => ({ width: 25 }))
      ];
      appendGridTable(wsAll, 1, sessions, 'ROOM');
      wsAll.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

      // Sheet per Prodi, Tables inside per Semester
      const prodiNames = Array.from(new Set(sessions.map(s => s.mataKuliah?.prodi?.namaProdi).filter(Boolean)));
      
      prodiNames.forEach(prodiName => {
        const wsProdi = workbook.addWorksheet(getUniqueSafeName(String(prodiName)));
        wsProdi.columns = [
          { width: 15 }, { width: 20 }, ...timeLabels.map(() => ({ width: 25 }))
        ];
        
        const prodiSessions = sessions.filter(s => s.mataKuliah?.prodi?.namaProdi === prodiName);
        const semesters = Array.from(new Set(prodiSessions.map(s => s.mataKuliah?.semester).filter(Boolean))).sort((a, b) => Number(a) - Number(b));
        
        let nextRowIdx = 1;
        semesters.forEach(sem => {
          const semesterSessions = prodiSessions.filter(s => s.mataKuliah?.semester === sem);
          nextRowIdx = appendGridTable(wsProdi, nextRowIdx, semesterSessions, 'ROOM', `Semester ${sem}`);
        });
        
        wsProdi.views = [{ state: 'frozen', xSplit: 2, ySplit: 0 }]; // Only freeze side headers for prodi sheets
      });

      // 4. Export
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeFileName = `Jadwal_Visual_${result.tahunAkademik}_${result.semesterTipe}`.replace(/[\\/:*?"<>|]/g, '-');
      anchor.download = `${safeFileName}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

    } catch (error: any) {
      console.error("Export error:", error);
      alert("Gagal mengekspor data ke Excel: " + (error.message || "Terjadi kesalahan sistem."));
    }
  };

  return (
    <>
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
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 min-w-0 flex-1">
              <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
                <span className="material-symbols-outlined text-[20px]">filter_list</span>
                <span className="text-xs font-bold uppercase tracking-wider">Kontrol:</span>
              </div>

              <div className="flex items-center gap-2 min-w-0 max-w-full sm:max-w-md flex-1">
                <div className="relative flex-1 min-w-[220px]">
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
                <button 
                  onClick={() => setShowManage(true)}
                  className="p-2.5 border border-outline-variant rounded-lg text-error hover:bg-error-container/20 transition-all shadow-sm flex items-center justify-center group shrink-0"
                  title="Kelola Jadwal (Hapus)"
                >
                  <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">delete</span>
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer bg-surface-container-lowest border border-outline-variant px-3 py-2.5 rounded-lg shadow-sm hover:bg-surface-variant/20 transition-all shrink-0">
                <input 
                  type="checkbox" 
                  checked={showAllRooms} 
                  onChange={e => setShowAllRooms(e.target.checked)} 
                  className="rounded text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer" 
                />
                Tampilkan Semua Ruangan
              </label>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={handleExportExcel} 
                disabled={!result || isResultLoading}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-green-600 text-white font-bold text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export Excel
              </button>

              <button 
                onClick={() => setShowGenerate(true)} 
                className="flex-1 sm:flex-none px-6 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                Generate Jadwal
              </button>
            </div>
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

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Ruangan:</span>
              <select 
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="px-2 py-1.5 border border-outline-variant rounded-lg text-xs bg-surface-container-lowest focus:ring-1 outline-none min-w-[120px]"
              >
                {roomOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Prodi:</span>
              <select 
                value={filterProdi}
                onChange={(e) => setFilterProdi(e.target.value)}
                className="px-2 py-1.5 border border-outline-variant rounded-lg text-xs bg-surface-container-lowest focus:ring-1 outline-none min-w-[120px]"
              >
                {prodiOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Dosen:</span>
              <select 
                value={filterDosen}
                onChange={(e) => setFilterDosen(e.target.value)}
                className="px-2 py-1.5 border border-outline-variant rounded-lg text-xs bg-surface-container-lowest focus:ring-1 outline-none min-w-[120px]"
              >
                {dosenOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            
            <div className="relative flex items-center gap-2 text-xs">
              <span className="font-semibold text-on-surface-variant">Zoom:</span>
              <button 
                onClick={() => { setIsAutoFit(false); setZoomLevel(z => Math.max(0.4, z - 0.1)); }} 
                className="p-1 rounded hover:bg-surface-variant"
              >
                <span className="material-symbols-outlined text-sm">zoom_out</span>
              </button>
              <span className={`w-10 text-center font-mono ${isAutoFit ? 'text-primary font-bold' : ''}`}>
                {isAutoFit ? 'FIT' : `${Math.round(zoomLevel * 100)}%`}
              </span>
              <button 
                onClick={() => { setIsAutoFit(false); setZoomLevel(z => Math.min(1.5, z + 0.1)); }} 
                className="p-1 rounded hover:bg-surface-variant"
              >
                <span className="material-symbols-outlined text-sm">zoom_in</span>
              </button>
              <button 
                onClick={() => { setIsAutoFit(true); handleFitScreen(); }} 
                className={`p-1 rounded transition-colors ${isAutoFit ? 'bg-primary text-on-primary' : 'hover:bg-surface-variant text-on-surface-variant'}`}
                title="Toggle Auto-Fit to Width"
              >
                <span className="material-symbols-outlined text-sm">fit_screen</span>
              </button>
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
        <div ref={containerRef} className="overflow-auto custom-scrollbar flex-1 w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Ensure this div is wide enough to force horizontal scroll */}
          <div className="inline-block min-w-full" style={{ width: (timeLabels.length * (SLOT_WIDTH * zoomLevel)) + 160 }}>
            
            {/* Header: Time Slots */}
            <div className="flex flex-col sticky top-0 bg-surface-container-low z-30 shadow-sm">
              <div className="flex px-4 py-2 bg-surface-bright border-b border-outline-variant/50 text-xs items-center gap-4">
                <span className="font-bold text-on-surface-variant">Legend:</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-400"></span> Konflik</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></span> Normal</span>
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
                const baseRoomIds = showAllRooms 
                  ? rooms.map(r => r.id) 
                  : (activeRoomIds.length > 0 ? activeRoomIds : rooms.slice(0, 3).map(r => r.id));
                
                const displayRoomIds = filterRoom !== "Semua" 
                  ? rooms.filter(r => r.namaRuangan === filterRoom).map(r => r.id)
                  : baseRoomIds;

                return (
                  <div key={hari} className="flex border-b border-outline-variant last:border-0">
                    {/* Day Label (Sticky) */}
                    <div className="w-[160px] flex-shrink-0 bg-surface-container-low/50 border-r border-outline-variant flex items-center justify-center sticky left-0 z-20 shadow-sm">
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
                                const actualSlot = slots.find(s => s.hari === hari && s.jamMulai === time.start);
                                return (
                                  <GridCell
                                    key={`${hari}-${roomId}-${idx}`}
                                    hari={hari}
                                    roomId={roomId}
                                    actualSlot={actualSlot}
                                    draggedItem={draggedItem}
                                    checkAvailability={checkAvailability}
                                    zoomLevel={zoomLevel}
                                    handleDrop={handleDrop}
                                    SLOT_WIDTH={SLOT_WIDTH}
                                  />
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
    </div>

    {/* Detail Modal */}
    {selectedCourse && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in sm:p-6" onClick={() => setSelectedCourse(null)}>
        {/* Backdrop with blur */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"></div>
        
        {/* Modal Container */}
        <div 
          className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col transform transition-all animate-slide-up border border-slate-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Header Section (Color coded based on conflict/prodi) */}
          <div className={`px-6 py-8 relative overflow-hidden ${conflictMap.has(selectedCourse.id) ? 'bg-red-50' : 'bg-primary/5'}`}>
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
            
            <button 
              onClick={() => setSelectedCourse(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/50 hover:bg-white text-slate-500 hover:text-slate-700 rounded-full transition-all shadow-sm backdrop-blur-md"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>

            <div className="relative z-10 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 bg-primary text-white rounded-md text-xs font-bold tracking-wider shadow-sm">
                  {selectedCourse.mataKuliah?.kodeMk}
                </span>
                <span className="px-2.5 py-1 bg-white text-slate-700 border border-slate-200 rounded-md text-xs font-bold shadow-sm">
                  {selectedCourse.sksTotal || selectedCourse.mataKuliah?.sks} SKS
                </span>
                <span className="px-2.5 py-1 bg-white text-slate-700 border border-slate-200 rounded-md text-xs font-bold shadow-sm">
                  Sem {selectedCourse.mataKuliah?.semester}
                </span>
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-bold shadow-sm">
                  {selectedCourse.mataKuliah?.prodi?.namaProdi}
                </span>
              </div>
              
              <h3 className="text-2xl font-extrabold text-slate-900 leading-tight">
                {selectedCourse.mataKuliah?.namaMk}
              </h3>
            </div>
          </div>

          {/* Content Section - Scrollable */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Information Cards */}
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-colors hover:border-primary/30">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dosen Pengampu</p>
                    <p className="font-bold text-slate-900">{selectedCourse.dosen?.namaDosen}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-colors hover:border-primary/30">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <span className="material-symbols-outlined">meeting_room</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ruangan</p>
                    <p className="font-bold text-slate-900 flex items-center gap-2">
                      {rooms.find(r => r.id === selectedCourse.idRuangan)?.namaRuangan}
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-[10px] text-slate-600 font-medium">Kap: {rooms.find(r => r.id === selectedCourse.idRuangan)?.kapasitas}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-colors hover:border-primary/30">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <span className="material-symbols-outlined">schedule</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Waktu</p>
                    <p className="font-bold text-slate-900">{selectedCourse.slotWaktu?.hari}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{selectedCourse.slotWaktu?.jamMulai} - {selectedCourse.slotWaktu?.jamSelesai}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-colors hover:border-primary/30">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <span className="material-symbols-outlined">groups</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Jumlah Mahasiswa</p>
                    <p className="font-bold text-slate-900">{selectedCourse.mataKuliah?.jumlahMhs || 0} Orang</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Conflict Status & Suggestions */}
            <div className="mt-6 space-y-6">
              {conflictMap.has(selectedCourse.id) ? (
                <>
                  <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-red-700 font-bold mb-3">
                      <span className="material-symbols-outlined">error</span>
                      <h3>Konflik Terdeteksi</h3>
                    </div>
                    <ul className="space-y-2">
                      {conflictMap.get(selectedCourse.id)?.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-red-800">
                          <span className="material-symbols-outlined text-[16px] mt-0.5 opacity-70">arrow_right</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Move Suggestions Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-bold px-1">
                      <span className="material-symbols-outlined text-primary">auto_awesome</span>
                      <h3>Saran Perpindahan Jadwal</h3>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold ml-auto">Bebas Konflik</span>
                    </div>
                    
                    {moveSuggestions.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {moveSuggestions.map((sug, idx) => (
                          <div 
                            key={idx} 
                            className="group flex flex-col p-3 bg-white border border-slate-200 rounded-xl hover:border-primary hover:shadow-md transition-all cursor-default relative overflow-hidden"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sug.hari}</span>
                              <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded">{sug.roomName}</span>
                            </div>
                            <div className="text-sm font-bold text-slate-900 mb-3">
                              {sug.jamMulai} - {sug.jamSelesai}
                            </div>
                            <button 
                              onClick={() => {
                                updateSlotMut.mutate({ 
                                  detailId: selectedCourse.id, 
                                  data: { idSlotWaktu: sug.slotId, idRuangan: sug.roomId, detailIds: selectedCourse.detailIds } 
                                });
                                setSelectedCourse(null);
                              }}
                              className="w-full py-2 bg-slate-50 hover:bg-primary hover:text-white text-primary border border-primary/20 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                              Pindahkan Ke Sini
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
                        <span className="material-symbols-outlined text-3xl mb-2 opacity-30">search_off</span>
                        <p className="text-xs font-medium text-center px-4">Tidak ditemukan slot kosong yang tersedia.<br/>Coba pindahkan jadwal lain terlebih dahulu.</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center gap-2 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span className="font-bold">Jadwal Sesuai (Tidak ada konflik)</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer Action */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button 
              onClick={() => setSelectedCourse(null)}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition-colors shadow-md"
            >
              Tutup Modal
            </button>
          </div>
        </div>
      </div>
    )}

    {/* GA Progress Modal */}
    {(isGenerating || gaProgress) && (
      <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center mb-4 text-primary">
            <span className="material-symbols-outlined text-[32px] spin">settings</span>
          </div>
          <h2 className="font-headline-md text-[20px] text-on-surface mb-2">
            {gaProgress ? "Menyusun Jadwal Optimal..." : "Mempersiapkan Algoritma..."}
          </h2>
          <p className="text-on-surface-variant font-label-sm text-sm mb-6">
            {gaProgress ? "Mengevaluasi mutasi pada populasi..." : "Menginisialisasi data dan memulai komputasi..."}
          </p>
          
          <div className="w-full bg-surface-variant rounded-full h-3 mb-2 overflow-hidden mt-6 relative">
            {gaProgress ? (
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" 
                style={{ width: `${(gaProgress.generasi / gaProgress.maxGenerasi) * 100}%` }}
              ></div>
            ) : (
              <div className="bg-primary h-3 rounded-full animate-pulse w-[15%]"></div>
            )}
          </div>
          
          <div className="w-full flex justify-between text-[10px] text-on-surface-variant font-black uppercase tracking-widest px-1">
            <span>Progress</span>
            <span>{gaProgress ? Math.round((gaProgress.generasi / gaProgress.maxGenerasi) * 100) : 0}%</span>
          </div>

          <div className="w-full grid grid-cols-2 gap-4 mt-6">
            <div className="bg-surface-bright p-4 rounded-2xl border border-outline-variant shadow-sm text-left">
              <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                <span className="material-symbols-outlined text-[16px]">cycle</span>
                <span className="text-[10px] font-black uppercase tracking-wider">Generasi</span>
              </div>
              <div className="text-xl font-black text-on-surface tabular-nums">
                {gaProgress ? (
                  <>{gaProgress.generasi}<span className="text-on-surface-variant/40 text-sm font-bold">/{gaProgress.maxGenerasi}</span></>
                ) : "0/0"}
              </div>
            </div>
            
            <div className={`p-4 rounded-2xl border shadow-sm text-left transition-all duration-300 ${gaProgress && gaProgress.conflictCount === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`flex items-center gap-2 mb-1 ${gaProgress && gaProgress.conflictCount === 0 ? 'text-green-700' : 'text-red-700'}`}>
                <span className="material-symbols-outlined text-[16px]">{gaProgress && gaProgress.conflictCount === 0 ? 'check_circle' : 'warning'}</span>
                <span className="text-[10px] font-black uppercase tracking-wider">Konflik</span>
              </div>
              <div className={`text-xl font-black tabular-nums ${gaProgress && gaProgress.conflictCount === 0 ? 'text-green-700' : 'text-red-700'}`}>
                {gaProgress ? gaProgress.conflictCount : "0"}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-outline italic mt-8 bg-surface-variant/20 px-4 py-2 rounded-full border border-outline-variant/30">
            {gaProgress ? (
              gaProgress.conflictCount === 0 
                ? "✨ Solusi optimal ditemukan! Memfinalisasi data..." 
                : "Sedang mengoptimalkan jadwal..."
            ) : "Mempersiapkan mesin kecerdasan buatan..."}
          </p>
        </div>
      </div>
    )}

    {/* Generate Schedule Modal */}
    {showGenerate && !gaProgress && (
      <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowGenerate(false)}>
        <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant w-full max-w-sm max-h-[90vh] overflow-y-auto custom-scrollbar p-6" onClick={e => e.stopPropagation()}>
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
              <p className="text-[10px] text-on-surface-variant mt-1.5 px-1 leading-relaxed">
                <span className="font-bold">Info:</span> Hanya mata kuliah dengan semester {genForm.semesterTipe === "Ganjil" ? "1, 3, 5, 7" : "2, 4, 6, 8"} yang berstatus <span className="text-success font-bold">Aktif</span> yang akan digenerate.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-2">Jumlah Alternatif Jadwal (Max 1000)</label>
              <input 
                type="number"
                min="1"
                max="1000"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-bright text-on-surface focus:outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20 text-sm" 
                value={genForm.jumlahJadwal} 
                onChange={e => setGenForm({...genForm, jumlahJadwal: parseInt(e.target.value) || 1})} 
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

    {/* Manage/Delete Schedules Modal */}
    {showManage && (
      <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowManage(false)}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-error">manage_accounts</span>
              Kelola Jadwal
            </h2>
            <button onClick={() => setShowManage(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          
          <div className="p-6">
            <div className="max-h-[350px] overflow-y-auto mb-6 pr-2 custom-scrollbar">
              {schedules.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-20">event_busy</span>
                  <p className="text-sm font-medium">Tidak ada jadwal tersimpan.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {schedules.map(s => (
                    <li 
                      key={s.id} 
                      onClick={() => {
                        if (selectedForDelete.includes(s.id)) setSelectedForDelete(prev => prev.filter(id => id !== s.id));
                        else setSelectedForDelete(prev => [...prev, s.id]);
                      }}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedForDelete.includes(s.id) 
                          ? 'bg-error-container/10 border-error/20 ring-1 ring-error/5' 
                          : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        selectedForDelete.includes(s.id) ? 'bg-error border-error text-on-error' : 'border-slate-300 bg-white'
                      }`}>
                        {selectedForDelete.includes(s.id) && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{s.tahunAkademik} {s.semesterTipe}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            s.status === 'FINAL' ? 'bg-green-100 text-green-700' : s.status === 'GENERATING' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {s.status}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            {s.conflictCount ?? 0} Konflik
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Terpilih</div>
                  <span className="px-2 py-0.5 bg-error-container text-on-error-container rounded-md text-[10px] font-black">
                    {selectedForDelete.length}
                  </span>
                </div>
                <div className="flex gap-2">
                  {schedules.length > 0 && (
                    <button 
                      onClick={() => {
                        if (selectedForDelete.length === schedules.length) setSelectedForDelete([]);
                        else setSelectedForDelete(schedules.map(s => s.id));
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${
                        selectedForDelete.length === schedules.length
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-primary border-primary/20 hover:bg-primary/5 hover:border-primary/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {selectedForDelete.length === schedules.length ? 'deselect' : 'select_all'}
                      </span>
                      {selectedForDelete.length === schedules.length ? 'Batal Pilih' : 'Pilih Semua'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowManage(false)}
                  className="flex-1 py-3 px-4 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedForDelete.length} jadwal?`)) {
                      bulkDeleteMut.mutate(selectedForDelete);
                    }
                  }}
                  disabled={selectedForDelete.length === 0 || bulkDeleteMut.isPending}
                  className="flex-[1.5] py-3 px-4 bg-error text-on-error font-bold text-sm rounded-xl hover:bg-error/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-error/20"
                >
                  {bulkDeleteMut.isPending ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                      Menghapus...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                      Hapus Terpilih
                    </>
                  )}
                </button>
              </div>
            </div>
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
    </>
  );
}

// Subcomponent for grid cell to optimize rendering
const GridCell = memo(function GridCell({ hari, roomId, actualSlot, draggedItem, checkAvailability, zoomLevel, handleDrop, SLOT_WIDTH }: any) {
  const isValidSlot = !!actualSlot;
  const isDropValid = useMemo(() => {
    return draggedItem && actualSlot && checkAvailability(draggedItem, actualSlot.id, roomId);
  }, [draggedItem, actualSlot, roomId, checkAvailability]);

  return (
    <div 
      style={{ width: SLOT_WIDTH * zoomLevel }} 
      onDragOver={(e) => {
        if (!isValidSlot) return; 
        if (isDropValid) e.preventDefault();
      }}
      onDrop={(e) => {
        if (isValidSlot && isDropValid) handleDrop(e, hari, actualSlot.id, roomId);
      }}
      className={`flex-shrink-0 border-r border-outline-variant/5 transition-colors relative
        ${!isValidSlot ? "bg-surface-variant/10" : ""}
        ${isDropValid ? "bg-green-100/40 ring-1 ring-green-400/50 inset" : draggedItem && isValidSlot ? "bg-red-50/20 cursor-not-allowed" : "hover:bg-surface-variant/5"}
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
});

// Subcomponent to optimize rendering and prevent global updates on hover
const CourseBlock = memo(function CourseBlock({ course, zoomLevel, SLOT_WIDTH, startIdx, sks, isConflicting, conflictReasons, prodiColor, roomName, layer, isDragged, onDragStart, onDragEnd, onSelect }: any) {
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
      className={`absolute rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-[transform,shadow,opacity] duration-200
        ${isHovered ? "scale-[1.01] z-50 shadow-md" : "overflow-hidden shadow-sm"}
        ${isDragged ? "opacity-30 grayscale" : "opacity-100"}
        ${isConflicting 
          ? "bg-red-50 border-red-400 text-red-900 shadow-red-100" 
          : `${prodiColor.bg} ${prodiColor.border} ${prodiColor.text}`}
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
});
