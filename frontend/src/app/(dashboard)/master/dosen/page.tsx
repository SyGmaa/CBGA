"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Dosen, Prodi } from "@/types";

export default function DosenPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Dosen | null>(null);
  const [form, setForm] = useState({ nidn: "", namaDosen: "", idProdi: 0 });
  
  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProdi, setFilterProdi] = useState<number | "all">("all");

  const { data: dosenList = [], isLoading } = useQuery<Dosen[]>({
    queryKey: ["dosen"],
    queryFn: () => api.getDosen() as Promise<Dosen[]>,
  });

  const { data: prodiList = [] } = useQuery<Prodi[]>({
    queryKey: ["prodi"],
    queryFn: () => api.getProdi() as Promise<Prodi[]>,
  });

  // Filtered List
  const filteredList = useMemo(() => {
    return dosenList.filter(it => {
      const matchesSearch = 
        it.namaDosen.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.nidn.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProdi = filterProdi === "all" || it.idProdi === filterProdi;
      return matchesSearch && matchesProdi;
    });
  }, [dosenList, searchQuery, filterProdi]);

  // Stats
  const stats = useMemo(() => {
    const totalDosen = dosenList.length;
    const totalProdi = new Set(dosenList.map(d => d.idProdi).filter(Boolean)).size;
    const hasNidn = dosenList.filter(d => d.nidn && d.nidn.length > 0).length;
    return { totalDosen, totalProdi, hasNidn };
  }, [dosenList]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createDosen(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["dosen"] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateDosen(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["dosen"] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteDosen(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dosen"] }),
  });

  const openCreate = () => { 
    setEditItem(null); 
    setForm({ nidn: "", namaDosen: "", idProdi: prodiList[0]?.id || 0 }); 
    setShowModal(true); 
  };
  
  const openEdit = (item: Dosen) => { 
    setEditItem(item); 
    setForm({ 
      nidn: item.nidn, 
      namaDosen: item.namaDosen, 
      idProdi: item.idProdi || 0 
    }); 
    setShowModal(true); 
  };
  
  const closeModal = () => { setShowModal(false); setEditItem(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, idProdi: form.idProdi || null };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Helper to get initials
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-background tracking-tight">Data Dosen</h1>
          <p className="text-sm text-on-surface-variant mt-1">Manajemen homebase dan informasi akademik dosen universitas.</p>
        </div>
        <button 
          onClick={openCreate} 
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Tambah Dosen
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[28px]">groups</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Dosen</p>
            <p className="text-xl font-bold">{stats.totalDosen}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">school</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Homebase Prodi</p>
            <p className="text-xl font-bold">{stats.totalProdi}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-tertiary-container/20 text-on-tertiary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">badge</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Valid NIDN</p>
            <p className="text-xl font-bold">{stats.hasNidn}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/50">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px]">search</span>
          <input 
            type="text"
            placeholder="Cari nama atau NIDN..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none pr-10 relative"
            value={filterProdi}
            onChange={(e) => setFilterProdi(e.target.value === "all" ? "all" : +e.target.value)}
          >
            <option value="all">Semua Prodi</option>
            {prodiList.map(p => <option key={p.id} value={p.id}>{p.namaProdi}</option>)}
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider w-16">No</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Dosen</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">NIDN</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Homebase</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {isLoading ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 w-4 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="flex gap-3"><div className="w-10 h-10 bg-surface-variant rounded-full"></div><div className="space-y-2"><div className="h-4 w-32 bg-surface-variant rounded"></div><div className="h-3 w-20 bg-surface-variant rounded"></div></div></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 bg-surface-variant rounded"></div></td>
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
              filteredList.map((item, i) => (
                <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                  <td className="px-6 py-4 text-sm text-on-surface-variant font-mono">{i + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/5">
                        {getInitials(item.namaDosen)}
                      </div>
                      <span className="font-bold text-on-surface">{item.namaDosen}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs bg-surface-container px-2 py-1 rounded-lg font-mono border border-outline-variant/30 text-primary/80">
                      {item.nidn || "-"}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    {item.prodi ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/10 text-secondary border border-secondary-container/20 text-xs font-semibold">
                        <span className="material-symbols-outlined text-[14px]">school</span>
                        {item.prodi.namaProdi}
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant/50 italic">Belum diset</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEdit(item)} 
                        className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                        title="Edit Dosen"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button 
                        onClick={() => { if (confirm("Hapus dosen ini?")) deleteMutation.mutate(item.id); }} 
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-all"
                        title="Hapus Dosen"
                      >
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={closeModal}>
          <div className="bg-surface-container-lowest w-full max-w-md rounded-[32px] shadow-2xl p-8 border border-outline-variant/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">{editItem ? "edit_square" : "person_add"}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-on-background">{editItem ? "Edit" : "Tambah"} Dosen</h2>
                  <p className="text-xs text-on-surface-variant font-medium">Lengkapi detail informasi dosen berikut</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">NIDN / NIP</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] group-focus-within:text-primary transition-colors">badge</span>
                  <input 
                    className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                    value={form.nidn} 
                    onChange={(e) => setForm({ ...form, nidn: e.target.value })} 
                    required 
                    placeholder="Contoh: 0012345678" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Nama Lengkap</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] group-focus-within:text-primary transition-colors">person</span>
                  <input 
                    className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                    value={form.namaDosen} 
                    onChange={(e) => setForm({ ...form, namaDosen: e.target.value })} 
                    required 
                    placeholder="Nama Lengkap & Gelar" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Homebase Prodi</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] group-focus-within:text-primary transition-colors">school</span>
                  <select 
                    className="w-full pl-11 pr-10 py-3.5 bg-surface-container-low border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium appearance-none" 
                    value={form.idProdi} 
                    onChange={e => setForm({...form, idProdi: +e.target.value})}
                  >
                    <option value={0}>Pilih Prodi (Opsional)</option>
                    {prodiList.map(p => <option key={p.id} value={p.id}>{p.namaProdi}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none">expand_more</span>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="flex-1 py-3.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-2xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3.5 text-sm font-bold bg-primary text-on-primary rounded-2xl shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

