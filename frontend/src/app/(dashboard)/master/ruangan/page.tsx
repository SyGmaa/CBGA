"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Modal from "@/components/Modal";
import type { Ruangan, Gedung } from "@/types";

export default function RuanganPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Ruangan | null>(null);
  const [form, setForm] = useState({ namaRuangan: "", idGedung: 0, kapasitas: 30 });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGedung, setFilterGedung] = useState<number | "all">("all");

  const { data: list = [], isLoading } = useQuery<Ruangan[]>({ 
    queryKey: ["ruangan"], 
    queryFn: () => api.getRuangan() as Promise<Ruangan[]> 
  });
  
  const { data: gedungList = [] } = useQuery<Gedung[]>({ 
    queryKey: ["gedung"], 
    queryFn: () => api.getGedung() as Promise<Gedung[]> 
  });

  const filteredList = useMemo(() => {
    return list.filter(it => {
      const matchesSearch = it.namaRuangan.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGedung = filterGedung === "all" || it.idGedung === filterGedung;
      return matchesSearch && matchesGedung;
    });
  }, [list, searchQuery, filterGedung]);

  const stats = useMemo(() => {
    const totalRooms = list.length;
    const totalGedung = gedungList.length;
    const avgKapasitas = list.length > 0 ? Math.round(list.reduce((acc, curr) => acc + curr.kapasitas, 0) / list.length) : 0;
    return { totalRooms, totalGedung, avgKapasitas };
  }, [list, gedungList]);

  const create = useMutation({ 
    mutationFn: (d: any) => api.createRuangan(d), 
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ruangan"] }); setShowModal(false); } 
  });
  
  const update = useMutation({ 
    mutationFn: ({ id, d }: any) => api.updateRuangan(id, d), 
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ruangan"] }); setShowModal(false); } 
  });
  
  const del = useMutation({ 
    mutationFn: (id: number) => api.deleteRuangan(id), 
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ruangan"] });
      alert("Ruangan berhasil dihapus");
    },
    onError: (error: any) => {
      alert(error.message || "Gagal menghapus ruangan");
    }
  });

  const openCreate = () => { 
    setEditItem(null); 
    setForm({ namaRuangan: "", idGedung: gedungList[0]?.id || 0, kapasitas: 30 }); 
    setShowModal(true); 
  };
  
  const openEdit = (it: Ruangan) => { 
    setEditItem(it); 
    setForm({ namaRuangan: it.namaRuangan, idGedung: it.idGedung, kapasitas: it.kapasitas }); 
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
          <h1 className="text-2xl font-bold text-on-background tracking-tight">Data Ruangan</h1>
          <p className="text-sm text-on-surface-variant mt-1">Kelola daftar ruangan dan kapasitasnya di setiap gedung.</p>
        </div>
        <button 
          onClick={openCreate} 
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-container text-on-primary rounded-xl font-semibold shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tambah Ruangan
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[28px]">meeting_room</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Ruangan</p>
            <p className="text-xl font-bold">{stats.totalRooms}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">apartment</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Gedung</p>
            <p className="text-xl font-bold">{stats.totalGedung}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-tertiary-container/20 text-on-tertiary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">groups</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Rerata Kapasitas</p>
            <p className="text-xl font-bold">{stats.avgKapasitas} Mhs</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/50">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px]">search</span>
          <input 
            type="text"
            placeholder="Cari nama ruangan..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            value={filterGedung}
            onChange={(e) => setFilterGedung(e.target.value === "all" ? "all" : +e.target.value)}
          >
            <option value="all">Semua Gedung</option>
            {gedungList.map(g => <option key={g.id} value={g.id}>{g.namaGedung}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider w-16">No</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ruangan</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Gedung</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Kapasitas</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {isLoading ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 w-4 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-32 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 mx-auto bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 ml-auto bg-surface-variant rounded"></div></td>
                </tr>
              ))
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 opacity-40">
                    <span className="material-symbols-outlined text-[64px]">search_off</span>
                    <div>
                      <p className="text-base font-bold">Data tidak ditemukan</p>
                      <p className="text-sm">Coba sesuaikan kata kunci atau filter Anda.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredList.map((it, i) => (
                <tr key={it.id} className="hover:bg-primary/5 transition-colors group">
                  <td className="px-6 py-4 text-sm text-on-surface-variant font-mono">{i+1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
                        <span className="material-symbols-outlined text-[20px]">meeting_room</span>
                      </div>
                      <span className="font-bold text-on-surface">{it.namaRuangan}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/10 text-secondary border border-secondary-container/20 text-xs font-semibold">
                      <span className="material-symbols-outlined text-[14px]">apartment</span>
                      {it.gedung?.namaGedung || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                      {it.kapasitas} <span className="font-normal opacity-70 ml-0.5">Mhs</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(it)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button onClick={() => { if(confirm("Hapus ruangan ini?")) del.mutate(it.id); }} className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-all">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">{editItem ? "edit_square" : "add_circle"}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-background">{editItem ? "Edit" : "Tambah"} Ruangan</h2>
              <p className="text-[11px] text-on-surface-variant font-medium">Lengkapi detail informasi ruangan berikut</p>
            </div>
          </div>
          <button onClick={() => setShowModal(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="ruangan-form" onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Nama Ruangan</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">meeting_room</span>
                <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                  value={form.namaRuangan} 
                  onChange={e => setForm({...form, namaRuangan: e.target.value})} 
                  required 
                  placeholder="Contoh: R. 101" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Lokasi Gedung</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">apartment</span>
                <select 
                  className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium appearance-none" 
                  value={form.idGedung} 
                  onChange={e => setForm({...form, idGedung: +e.target.value})} 
                  required
                >
                  <option value={0} disabled>Pilih Gedung</option>
                  {gedungList.map(g => <option key={g.id} value={g.id}>{g.namaGedung}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Kapasitas (Mahasiswa)</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">groups</span>
                <input 
                  type="number" 
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                  value={form.kapasitas} 
                  onChange={e => setForm({...form, kapasitas: +e.target.value})} 
                  required 
                />
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
              form="ruangan-form"
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
