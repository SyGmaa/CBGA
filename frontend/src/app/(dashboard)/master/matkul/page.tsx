"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MataKuliah, Prodi } from "@/types";

export default function MatkulPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MataKuliah | null>(null);
  const [form, setForm] = useState({ kodeMk: "", namaMk: "", sks: 2, semester: 1, jumlahMhs: 30, idProdi: 0 });

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProdi, setFilterProdi] = useState<number | "all">("all");
  const [filterSemester, setFilterSemester] = useState<number | "all">("all");

  const { data: list = [], isLoading } = useQuery<MataKuliah[]>({
    queryKey: ["matkul"], 
    queryFn: () => api.getMatkul() as Promise<MataKuliah[]>,
  });
  
  const { data: prodiList = [] } = useQuery<Prodi[]>({
    queryKey: ["prodi"],
    queryFn: () => api.getProdi() as Promise<Prodi[]>,
  });

  // Filtered List
  const filteredList = useMemo(() => {
    return list.filter(it => {
      const matchesSearch = 
        it.namaMk.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.kodeMk.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProdi = filterProdi === "all" || it.idProdi === filterProdi;
      const matchesSemester = filterSemester === "all" || it.semester === filterSemester;
      return matchesSearch && matchesProdi && matchesSemester;
    });
  }, [list, searchQuery, filterProdi, filterSemester]);

  // Stats
  const stats = useMemo(() => {
    const totalMk = list.length;
    const totalSks = list.reduce((sum, it) => sum + it.sks, 0);
    const avgKapasitas = list.length > 0 
      ? Math.round(list.reduce((sum, it) => sum + it.jumlahMhs, 0) / list.length) 
      : 0;
    return { totalMk, totalSks, avgKapasitas };
  }, [list]);

  const create = useMutation({ 
    mutationFn: (d: any) => api.createMatkul(d), 
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matkul"] }); closeModal(); } 
  });
  
  const update = useMutation({ 
    mutationFn: ({ id, d }: any) => api.updateMatkul(id, d), 
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matkul"] }); closeModal(); } 
  });
  
  const del = useMutation({ 
    mutationFn: (id: number) => api.deleteMatkul(id), 
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matkul"] }) 
  });

  const openCreate = () => { 
    setEditItem(null); 
    setForm({ kodeMk: "", namaMk: "", sks: 2, semester: 1, jumlahMhs: 30, idProdi: prodiList[0]?.id || 0 }); 
    setShowModal(true); 
  };
  
  const openEdit = (it: MataKuliah) => { 
    setEditItem(it); 
    setForm({ 
      kodeMk: it.kodeMk, 
      namaMk: it.namaMk, 
      sks: it.sks, 
      semester: it.semester, 
      jumlahMhs: it.jumlahMhs, 
      idProdi: it.idProdi 
    }); 
    setShowModal(true); 
  };

  const closeModal = () => { setShowModal(false); setEditItem(null); };
  
  const submit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    editItem ? update.mutate({ id: editItem.id, d: form }) : create.mutate(form); 
  };
  
  const sc = (s: number) => ({ 
    1: "bg-blue-500/15 text-blue-400", 
    2: "bg-cyan-500/15 text-cyan-400",
    3: "bg-emerald-500/15 text-emerald-400", 
    4: "bg-teal-500/15 text-teal-400",
    5: "bg-violet-500/15 text-violet-400", 
    6: "bg-purple-500/15 text-purple-400",
    7: "bg-amber-500/15 text-amber-400",
    8: "bg-orange-500/15 text-orange-400"
  }[s] || "bg-muted/15 text-muted");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-background tracking-tight">Data Mata Kuliah</h1>
          <p className="text-sm text-on-surface-variant mt-1">Kelola kurikulum, beban SKS, dan kapasitas mahasiswa per semester.</p>
        </div>
        <button 
          onClick={openCreate} 
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add_box</span>
          Tambah MK
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[28px]">menu_book</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total MK</p>
            <p className="text-xl font-bold">{stats.totalMk}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">fitness_center</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Beban SKS</p>
            <p className="text-xl font-bold">{stats.totalSks} <span className="text-sm font-normal text-muted">SKS</span></p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-tertiary-container/20 text-on-tertiary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">groups</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Avg. Kapasitas</p>
            <p className="text-xl font-bold">{stats.avgKapasitas} <span className="text-sm font-normal text-muted">Mhs</span></p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/50">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px]">search</span>
          <input 
            type="text"
            placeholder="Cari nama atau kode MK..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select 
            className="px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none pr-10 relative"
            value={filterProdi}
            onChange={(e) => setFilterProdi(e.target.value === "all" ? "all" : +e.target.value)}
          >
            <option value="all">Semua Prodi</option>
            {prodiList.map(p => <option key={p.id} value={p.id}>{p.namaProdi}</option>)}
          </select>
          <select 
            className="px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none pr-10 relative"
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value === "all" ? "all" : +e.target.value)}
          >
            <option value="all">Semua Smt</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider w-16 text-center">No</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider w-32">Kode</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Mata Kuliah</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Prodi</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">SKS</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Smt</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Mhs</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {isLoading ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 w-4 mx-auto bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-48 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-12 mx-auto bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-8 mx-auto bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 ml-auto bg-surface-variant rounded"></div></td>
                </tr>
              ))
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
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
                  <td className="px-6 py-4 text-sm text-on-surface-variant font-mono text-center">{i+1}</td>
                  <td className="px-6 py-4">
                    <code className="text-[11px] bg-surface-container px-2 py-1 rounded border border-outline-variant/30 font-mono text-primary/80 font-bold">
                      {it.kodeMk}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-on-surface">{it.namaMk}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/30">
                      {it.prodi?.namaProdi || "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-sm">{it.sks}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${sc(it.semester)}`}>
                      Smt {it.semester}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-bold">{it.jumlahMhs}</span>
                      <span className="text-[10px] text-on-surface-variant uppercase">Kaps</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEdit(it)} 
                        className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                        title="Edit MK"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button 
                        onClick={() => { if(confirm("Hapus mata kuliah ini?")) del.mutate(it.id); }} 
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-all"
                        title="Hapus MK"
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
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-[32px] shadow-2xl p-8 border border-outline-variant/30" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">{editItem ? "edit_square" : "add_box"}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-on-background">{editItem ? "Edit" : "Tambah"} Mata Kuliah</h2>
                  <p className="text-xs text-on-surface-variant font-medium">Lengkapi detail kurikulum mata kuliah</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Kode MK</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] group-focus-within:text-primary transition-colors">qr_code</span>
                    <input 
                      className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                      value={form.kodeMk} 
                      onChange={e => setForm({...form, kodeMk: e.target.value})} 
                      required 
                      placeholder="TIF101" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">SKS</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] group-focus-within:text-primary transition-colors">fitness_center</span>
                    <input 
                      type="number" 
                      className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                      value={form.sks} 
                      onChange={e => setForm({...form, sks: +e.target.value})} 
                      required 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Nama Mata Kuliah</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] group-focus-within:text-primary transition-colors">title</span>
                  <input 
                    className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                    value={form.namaMk} 
                    onChange={e => setForm({...form, namaMk: e.target.value})} 
                    required 
                    placeholder="Masukkan nama mata kuliah" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Program Studi</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] group-focus-within:text-primary transition-colors">school</span>
                  <select 
                    className="w-full pl-11 pr-10 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium appearance-none" 
                    value={form.idProdi} 
                    onChange={e => setForm({...form, idProdi: +e.target.value})} 
                    required
                  >
                    <option value={0} disabled>Pilih Program Studi</option>
                    {prodiList.map(p => (
                      <option key={p.id} value={p.id}>{p.namaProdi} ({p.fakultas?.namaFakultas})</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none">expand_more</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Semester</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] group-focus-within:text-primary transition-colors">event_repeat</span>
                    <input 
                      type="number" 
                      className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                      value={form.semester} 
                      onChange={e => setForm({...form, semester: +e.target.value})} 
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Kapasitas Mahasiswa</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[20px] group-focus-within:text-primary transition-colors">groups</span>
                    <input 
                      type="number" 
                      className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                      value={form.jumlahMhs} 
                      onChange={e => setForm({...form, jumlahMhs: +e.target.value})} 
                      required 
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-2xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 text-sm font-bold bg-primary text-on-primary rounded-2xl shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
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

