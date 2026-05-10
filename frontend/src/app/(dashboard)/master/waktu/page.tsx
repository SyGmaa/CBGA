"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Modal from "@/components/Modal";
import type { SlotWaktu, Hari } from "@/types";

const HARI_ORDER: Hari[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function WaktuPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<SlotWaktu | null>(null);
  const [form, setForm] = useState<{ hari: Hari; jamMulai: string; jamSelesai: string }>({
    hari: "Senin",
    jamMulai: "07:00",
    jamSelesai: "08:40"
  });

  const { data: list = [], isLoading } = useQuery<SlotWaktu[]>({ 
    queryKey: ["waktu"], 
    queryFn: () => api.getSlotWaktu() as Promise<SlotWaktu[]> 
  });

  const grouped = useMemo(() => {
    return HARI_ORDER.map(h => ({ 
      hari: h, 
      slots: list.filter(s => s.hari === h).sort((a, b) => a.jamMulai.localeCompare(b.jamMulai))
    }));
  }, [list]);

  const stats = useMemo(() => {
    const totalSlots = list.length;
    const daysCovered = grouped.filter(g => g.slots.length > 0).length;
    const busiestDay = [...grouped].sort((a, b) => b.slots.length - a.slots.length)[0];
    return { totalSlots, daysCovered, busiestDayName: busiestDay?.hari || "-" };
  }, [list, grouped]);

  const create = useMutation({ 
    mutationFn: (d: any) => api.createSlotWaktu(d), 
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["waktu"] }); setShowModal(false); } 
  });
  
  const update = useMutation({ 
    mutationFn: ({ id, d }: { id: number; d: any }) => api.updateSlotWaktu(id, d), 
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["waktu"] }); setShowModal(false); } 
  });
  
  const del = useMutation({ 
    mutationFn: (id: number) => api.deleteSlotWaktu(id), 
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waktu"] });
      alert("Slot waktu berhasil dihapus");
    },
    onError: (error: any) => {
      alert(error.message || "Gagal menghapus slot waktu");
    }
  });

  const openCreate = () => { 
    setEditItem(null); 
    setForm({ hari: "Senin", jamMulai: "07:00", jamSelesai: "08:40" }); 
    setShowModal(true); 
  };
  
  const openEdit = (it: SlotWaktu) => { 
    setEditItem(it); 
    setForm({ hari: it.hari, jamMulai: it.jamMulai, jamSelesai: it.jamSelesai }); 
    setShowModal(true); 
  };
  
  const submit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    editItem ? update.mutate({ id: editItem.id, d: form }) : create.mutate(form); 
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-background tracking-tight">Slot Waktu</h1>
          <p className="text-sm text-on-surface-variant mt-1">Kelola daftar sesi perkuliahan untuk setiap hari kerja.</p>
        </div>
        <button 
          onClick={openCreate} 
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-container text-on-primary rounded-xl font-semibold shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tambah Slot
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[28px]">schedule</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Sesi</p>
            <p className="text-xl font-bold">{stats.totalSlots}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">calendar_today</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Hari Aktif</p>
            <p className="text-xl font-bold">{stats.daysCovered} Hari</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-tertiary-container/20 text-on-tertiary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">event_busy</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Sesi Terbanyak</p>
            <p className="text-xl font-bold">{stats.busiestDayName}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="h-6 w-24 bg-surface-variant rounded mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3].map(j => <div key={j} className="h-12 bg-surface-variant rounded-xl"></div>)}
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="glass-card py-16 text-center">
          <div className="flex flex-col items-center gap-3 opacity-40">
            <span className="material-symbols-outlined text-[64px]">timer_off</span>
            <div>
              <p className="text-base font-bold">Belum ada data slot waktu</p>
              <p className="text-sm">Klik tombol "Tambah Slot" untuk memulai.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {grouped.filter(g => g.slots.length > 0).map(g => (
            <div key={g.hari} className="glass-card p-0 overflow-hidden flex flex-col group/card transition-all hover:border-primary/30">
              <div className="p-5 border-b border-outline-variant/30 bg-surface-container-low/50">
                <h3 className="font-bold text-lg gradient-text">{g.hari}</h3>
                <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-wider mt-0.5">{g.slots.length} Sesi Terdaftar</p>
              </div>
              <div className="p-4 space-y-2">
                {g.slots.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface/50 border border-border group/item hover:border-primary/40 hover:bg-primary/5 transition-all">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary group-hover/item:bg-primary group-hover/item:text-on-primary transition-all">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-on-surface">{s.jamMulai} — {s.jamSelesai}</span>
                    </div>
                    <div className="flex gap-1 md:opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button onClick={() => { if(confirm("Hapus slot waktu ini?")) del.mutate(s.id); }} className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">{editItem ? "edit_square" : "add_circle"}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-background">{editItem ? "Edit" : "Tambah"} Slot Waktu</h2>
              <p className="text-[11px] text-on-surface-variant font-medium">Lengkapi detail sesi perkuliahan berikut</p>
            </div>
          </div>
          <button onClick={() => setShowModal(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="waktu-form" onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Hari</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">calendar_today</span>
                <select 
                  className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium appearance-none" 
                  value={form.hari} 
                  onChange={e => setForm({...form, hari: e.target.value as Hari})} 
                  required
                >
                  {HARI_ORDER.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Jam Mulai</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">schedule</span>
                  <input 
                    type="time"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                    value={form.jamMulai} 
                    onChange={e => setForm({...form, jamMulai: e.target.value})} 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Jam Selesai</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">more_time</span>
                  <input 
                    type="time"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                    value={form.jamSelesai} 
                    onChange={e => setForm({...form, jamSelesai: e.target.value})} 
                    required 
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low/30">
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => setShowModal(false)} 
              className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
            >
              Batal
            </button>
            <button 
              type="submit" 
              form="waktu-form"
              className="flex-1 py-3 text-sm font-bold bg-primary text-on-primary rounded-xl shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Simpan Data
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
