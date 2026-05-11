"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Modal from "@/components/Modal";
import type { Matkul, Prodi } from "@/types";

export default function MatkulPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Matkul | null>(null);
  const [form, setForm] = useState({ 
    kodeMk: "", 
    namaMk: "", 
    sks: 2, 
    idProdi: 0, 
    semester: 1, 
    jumlahMhs: 40,
    isAktif: true
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProdi, setFilterProdi] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "aktif" | "nonaktif">("all");

  const { data: list = [], isLoading } = useQuery<Matkul[]>({
    queryKey: ["matkul"],
    queryFn: () => api.getMatkul() as Promise<Matkul[]>,
  });

  const { data: prodiList = [] } = useQuery<Prodi[]>({
    queryKey: ["prodi"],
    queryFn: () => api.getProdi() as Promise<Prodi[]>,
  });

  const filteredList = useMemo(() => {
    return list.filter(it => {
      const matchesSearch = 
        it.namaMk.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.kodeMk.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProdi = filterProdi === "all" || it.idProdi === filterProdi;
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "aktif" && it.isAktif) || 
        (filterStatus === "nonaktif" && !it.isAktif);
      return matchesSearch && matchesProdi && matchesStatus;
    });
  }, [list, searchQuery, filterProdi, filterStatus]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createMatkul(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["matkul"] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateMatkul(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["matkul"] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteMatkul(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["matkul"] }),
  });

  const openCreate = () => { 
    setEditItem(null); 
    setForm({ 
      kodeMk: "", 
      namaMk: "", 
      sks: 2, 
      idProdi: prodiList[0]?.id || 0, 
      semester: 1, 
      jumlahMhs: 40,
      isAktif: true
    }); 
    setShowModal(true); 
  };
  
  const openEdit = (item: Matkul) => { 
    setEditItem(item); 
    setForm({ 
      kodeMk: item.kodeMk, 
      namaMk: item.namaMk, 
      sks: item.sks, 
      idProdi: item.idProdi, 
      semester: item.semester, 
      jumlahMhs: item.jumlahMhs,
      isAktif: item.isAktif 
    }); 
    setShowModal(true); 
  };
  
  const closeModal = () => { setShowModal(false); setEditItem(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-background tracking-tight">Data Mata Kuliah</h1>
          <p className="text-sm text-on-surface-variant mt-1">Kelola kurikulum, beban SKS, dan kapasitas mahasiswa per kelas.</p>
        </div>
        <button 
          onClick={openCreate} 
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add_box</span>
          Tambah Matkul
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/50">
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
        <div className="flex gap-2">
          <select 
            className="px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none pr-10 relative"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Tidak Aktif</option>
          </select>
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

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider w-16">No</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Mata Kuliah</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">SKS</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Smstr</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Prodi</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {isLoading ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 w-4 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-48 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-8 bg-surface-variant rounded mx-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-8 bg-surface-variant rounded mx-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 bg-surface-variant rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 ml-auto bg-surface-variant rounded"></div></td>
                </tr>
              ))
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 opacity-40">
                    <span className="material-symbols-outlined text-[64px]">search_off</span>
                    <p className="text-base font-bold">Data tidak ditemukan</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredList.map((item, i) => (
                <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                  <td className="px-6 py-4 text-sm text-on-surface-variant font-mono">{i + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-on-surface">{item.namaMk}</span>
                      <span className="text-[10px] text-primary font-mono uppercase tracking-wider">{item.kodeMk}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-md bg-secondary-container/10 text-secondary text-xs font-bold border border-secondary-container/20">
                      {item.sks}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium">{item.semester}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-on-surface-variant font-medium">{item.prodi?.namaProdi || "N/A"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <button 
                        onClick={() => updateMutation.mutate({ id: item.id, data: { ...item, isAktif: !item.isAktif } })}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                          item.isAktif 
                            ? "bg-success-container/10 text-success border border-success/20 hover:bg-success/10" 
                            : "bg-error-container/10 text-error border border-error/20 hover:bg-error/10"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {item.isAktif ? "check_circle" : "cancel"}
                        </span>
                        {item.isAktif ? "AKTIF" : "NONAKTIF"}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(item)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button onClick={() => { if (confirm("Hapus matkul ini?")) deleteMutation.mutate(item.id); }} className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-all">
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

      <Modal isOpen={showModal} onClose={closeModal}>
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">{editItem ? "edit_square" : "add_box"}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-background">{editItem ? "Edit" : "Tambah"} Mata Kuliah</h2>
              <p className="text-[11px] text-on-surface-variant font-medium">Lengkapi detail kurikulum mata kuliah</p>
            </div>
          </div>
          <button onClick={closeModal} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="matkul-form" onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Kode MK</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">qr_code</span>
                  <input 
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                    value={form.kodeMk} 
                    onChange={e => setForm({...form, kodeMk: e.target.value})} 
                    required 
                    placeholder="TIF101" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">SKS</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">fitness_center</span>
                  <input 
                    type="number" 
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                    value={form.sks} 
                    onChange={e => setForm({...form, sks: +e.target.value})} 
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Nama Mata Kuliah</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">title</span>
                <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                  value={form.namaMk} 
                  onChange={e => setForm({...form, namaMk: e.target.value})} 
                  required 
                  placeholder="Masukkan nama mata kuliah" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Program Studi</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">school</span>
                <select 
                  className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium appearance-none" 
                  value={form.idProdi} 
                  onChange={e => setForm({...form, idProdi: +e.target.value})} 
                  required
                >
                  <option value={0} disabled>Pilih Program Studi</option>
                  {prodiList.map(p => (
                    <option key={p.id} value={p.id}>{p.namaProdi}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Semester</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">event_repeat</span>
                  <input 
                    type="number" 
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                    value={form.semester} 
                    onChange={e => setForm({...form, semester: +e.target.value})} 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.1em] ml-1">Kapasitas Mhs</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px] group-focus-within:text-primary transition-colors">groups</span>
                  <input 
                    type="number" 
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium" 
                    value={form.jumlahMhs} 
                    onChange={e => setForm({...form, jumlahMhs: +e.target.value})} 
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 p-4 bg-surface-container-low border border-outline-variant rounded-2xl cursor-pointer hover:bg-primary/5 transition-all group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${form.isAktif ? 'bg-success/10 text-success' : 'bg-on-surface-variant/10 text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-[22px]">{form.isAktif ? "check_circle" : "cancel"}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-on-surface">Status Mata Kuliah Aktif</p>
                  <p className="text-[11px] text-on-surface-variant">Aktifkan agar mata kuliah ini diikutkan dalam pembuatan jadwal otomatis.</p>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={form.isAktif}
                    onChange={(e) => setForm({ ...form, isAktif: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </div>
              </label>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low/30">
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={closeModal} 
              className="flex-1 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
            >
              Batal
            </button>
            <button 
              type="submit" 
              form="matkul-form"
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
