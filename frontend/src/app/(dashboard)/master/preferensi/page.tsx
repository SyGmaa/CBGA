"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Dosen, SlotWaktu, PreferensiWaktuDosen } from "@/types";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function PreferensiPage() {
  const qc = useQueryClient();
  const [selectedDosenId, setSelectedDosenId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Data queries
  const { data: dosenList = [], isLoading: isLoadingDosen } = useQuery<Dosen[]>({
    queryKey: ["dosen"],
    queryFn: () => api.getDosen() as Promise<Dosen[]>
  });

  const { data: slots = [], isLoading: isLoadingSlots } = useQuery<SlotWaktu[]>({
    queryKey: ["waktu"],
    queryFn: () => api.getSlotWaktu() as Promise<SlotWaktu[]>
  });

  const { data: preferensiList = [], isLoading: isLoadingPref } = useQuery<PreferensiWaktuDosen[]>({
    queryKey: ["preferensi"],
    queryFn: () => api.getPreferensi() as Promise<PreferensiWaktuDosen[]>
  });

  // Mutations
  const createMut = useMutation({
    mutationFn: (data: any) => api.createPreferensi(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferensi"] })
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deletePreferensi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferensi"] })
  });

  // Derived data
  const filteredDosen = useMemo(() => {
    return dosenList.filter(d => 
      d.namaDosen.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.nidn.includes(searchTerm)
    );
  }, [dosenList, searchTerm]);

  const selectedDosen = useMemo(() => 
    dosenList.find(d => d.id === selectedDosenId),
    [dosenList, selectedDosenId]
  );

  // Group slots by time for the Y-axis
  const timeLabels = useMemo(() => {
    const uniqueTimes = Array.from(new Set(slots.map(s => `${s.jamMulai} - ${s.jamSelesai}`)));
    return uniqueTimes.sort();
  }, [slots]);

  // Map preferensi for fast lookup: dosenId -> slotId -> pref object
  const prefLookup = useMemo(() => {
    const map = new Map<number, Map<number, PreferensiWaktuDosen>>();
    for (const p of preferensiList) {
      if (!map.has(p.idDosen)) map.set(p.idDosen, new Map());
      map.get(p.idDosen)!.set(p.idSlotWaktu, p);
    }
    return map;
  }, [preferensiList]);

  const handleToggleSlot = (slotId: number) => {
    if (!selectedDosenId) return;

    const existing = prefLookup.get(selectedDosenId)?.get(slotId);
    if (existing) {
      deleteMut.mutate(existing.id);
    } else {
      createMut.mutate({
        idDosen: selectedDosenId,
        idSlotWaktu: slotId,
        status: "UNAVAILABLE"
      });
    }
  };

  const isLoading = isLoadingDosen || isLoadingSlots || isLoadingPref;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kelola Preferensi Dosen</h1>
          <p className="text-sm text-muted mt-1">Atur ketersediaan waktu mengajar untuk setiap dosen</p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Sidebar: Dosen List */}
        <div className="w-80 flex flex-col glass-card p-0 overflow-hidden">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[20px]">search</span>
              <input 
                type="text" 
                placeholder="Cari dosen..."
                className="w-full pl-10 pr-4 py-2 bg-surface rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {isLoadingDosen ? (
              <div className="p-8 text-center text-muted animate-pulse">Memuat data dosen...</div>
            ) : filteredDosen.length === 0 ? (
              <div className="p-8 text-center text-muted">Dosen tidak ditemukan</div>
            ) : (
              filteredDosen.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDosenId(d.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-center gap-3
                    ${selectedDosenId === d.id 
                      ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-[1.02]' 
                      : 'hover:bg-surface-container-high text-on-surface'
                    }
                  `}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                    ${selectedDosenId === d.id ? 'bg-on-primary/20' : 'bg-primary/10 text-primary'}
                  `}>
                    {d.namaDosen.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{d.namaDosen}</p>
                    <p className={`text-[10px] uppercase tracking-wider opacity-70 ${selectedDosenId === d.id ? 'text-on-primary' : 'text-muted'}`}>
                      NIDN: {d.nidn}
                    </p>
                  </div>
                  {prefLookup.get(d.id)?.size ? (
                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold
                      ${selectedDosenId === d.id ? 'bg-on-primary/20' : 'bg-danger/10 text-danger'}
                    `}>
                      {prefLookup.get(d.id)?.size}
                    </div>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main: Preference Grid */}
        <div className="flex-1 glass-card p-6 flex flex-col min-w-0">
          {!selectedDosenId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl text-muted">person_search</span>
              </div>
              <h3 className="text-xl font-bold">Pilih Dosen</h3>
              <p className="text-muted mt-2 max-w-xs">Silakan pilih dosen dari daftar di samping untuk mengatur preferensi waktu mengajarnya.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-slide-up">
              <div className="flex justify-between items-start mb-6 border-b border-outline-variant pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                    {selectedDosen?.namaDosen.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedDosen?.namaDosen}</h2>
                    <p className="text-xs text-muted">Program Studi: {selectedDosen?.prodi?.namaProdi || '-'}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-success-container border border-success"></div>
                    <span>Tersedia (Default)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-danger-container border border-danger"></div>
                    <span>Tidak Tersedia</span>
                  </div>
                </div>
              </div>

              {isLoadingSlots ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-surface z-10">
                      <tr>
                        <th className="p-3 border border-outline-variant bg-surface-container-low min-w-[120px]">Jam / Hari</th>
                        {HARI.map(h => (
                          <th key={h} className="p-3 border border-outline-variant bg-surface-container-low font-bold text-sm">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeLabels.map(timeLabel => (
                        <tr key={timeLabel}>
                          <td className="p-3 border border-outline-variant text-center font-mono text-xs bg-surface-container-lowest">
                            {timeLabel}
                          </td>
                          {HARI.map(h => {
                            const slot = slots.find(s => 
                              s.hari === h && `${s.jamMulai} - ${s.jamSelesai}` === timeLabel
                            );
                            
                            if (!slot) return <td key={h} className="p-3 border border-outline-variant bg-surface-container-lowest/30"></td>;

                            const isUnavailable = prefLookup.get(selectedDosenId)?.has(slot.id);
                            const isMutating = (createMut.isPending && createMut.variables?.idSlotWaktu === slot.id) ||
                                              (deleteMut.isPending && deleteMut.variables === prefLookup.get(selectedDosenId)?.get(slot.id)?.id);

                            return (
                              <td 
                                key={h} 
                                className="p-1 border border-outline-variant group"
                              >
                                <button
                                  disabled={isMutating}
                                  onClick={() => handleToggleSlot(slot.id)}
                                  className={`w-full h-12 rounded-lg transition-all duration-300 flex flex-col items-center justify-center gap-1 group/btn overflow-hidden relative
                                    ${isUnavailable 
                                      ? 'bg-danger-container text-on-danger-container border-danger/30' 
                                      : 'bg-success-container/10 hover:bg-success-container/30 text-on-success-container border-transparent'
                                    }
                                    ${isMutating ? 'opacity-50' : 'opacity-100'}
                                    border
                                  `}
                                >
                                  {isMutating ? (
                                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                  ) : (
                                    <>
                                      <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 group-hover/btn:scale-110
                                        ${isUnavailable ? 'text-danger' : 'text-success/40'}
                                      `}>
                                        {isUnavailable ? 'block' : 'check_circle'}
                                      </span>
                                      <span className="text-[9px] font-bold uppercase tracking-tighter">
                                        {isUnavailable ? 'Tidak Sedia' : 'Sedia'}
                                      </span>
                                    </>
                                  )}
                                  
                                  {/* Hover Effect Background */}
                                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none"></div>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
