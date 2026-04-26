"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MataKuliah, Prodi } from "@/types";

export default function MatkulPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MataKuliah | null>(null);
  const [form, setForm] = useState({ kodeMk: "", namaMk: "", sks: 2, semester: 1, jumlahMhs: 30, idProdi: 0 });

  const { data: list = [], isLoading } = useQuery<MataKuliah[]>({
    queryKey: ["matkul"], 
    queryFn: () => api.getMatkul() as Promise<MataKuliah[]>,
  });
  
  const { data: prodiList = [] } = useQuery<Prodi[]>({
    queryKey: ["prodi"],
    queryFn: () => api.getProdi() as Promise<Prodi[]>,
  });

  const create = useMutation({ 
    mutationFn: (d: any) => api.createMatkul(d), 
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matkul"] }); setShowModal(false); } 
  });
  
  const update = useMutation({ 
    mutationFn: ({ id, d }: any) => api.updateMatkul(id, d), 
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matkul"] }); setShowModal(false); } 
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mata Kuliah</h1>
          <p className="text-sm text-muted mt-1">Kelola data kurikulum universitas</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ Tambah MK</button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Kode</th>
              <th>Nama MK</th>
              <th>Prodi</th>
              <th>SKS</th>
              <th>Smt</th>
              <th>Mhs</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-8">Loading...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted">Belum ada data mata kuliah.</td></tr>
            ) : (
              list.map((it, i) => (
                <tr key={it.id}>
                  <td className="text-muted">{i+1}</td>
                  <td><code className="text-xs bg-surface px-2 py-1 rounded font-mono">{it.kodeMk}</code></td>
                  <td className="font-medium">{it.namaMk}</td>
                  <td>
                    <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
                      {it.prodi?.namaProdi || "N/A"}
                    </span>
                  </td>
                  <td>{it.sks}</td>
                  <td><span className={`px-2 py-1 rounded-lg text-xs font-semibold ${sc(it.semester)}`}>Smt {it.semester}</span></td>
                  <td>{it.jumlahMhs}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(it)} className="btn-secondary text-xs py-1.5 px-3">Edit</button>
                      <button onClick={() => { if(confirm("Hapus mata kuliah ini?")) del.mutate(it.id); }} className="btn-danger text-xs py-1.5 px-3">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editItem ? "Edit" : "Tambah"} Mata Kuliah</h2>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase mb-2">Kode MK</label>
                  <input className="input-field" value={form.kodeMk} onChange={e => setForm({...form, kodeMk: e.target.value})} required placeholder="TIF101" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase mb-2">SKS</label>
                  <input type="number" className="input-field" value={form.sks} onChange={e => setForm({...form, sks: +e.target.value})} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">Nama Mata Kuliah</label>
                <input className="input-field" value={form.namaMk} onChange={e => setForm({...form, namaMk: e.target.value})} required placeholder="Masukkan nama mata kuliah" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">Program Studi</label>
                <select 
                  className="input-field" 
                  value={form.idProdi} 
                  onChange={e => setForm({...form, idProdi: +e.target.value})} 
                  required
                >
                  <option value={0} disabled>Pilih Program Studi</option>
                  {prodiList.map(p => (
                    <option key={p.id} value={p.id}>{p.namaProdi} ({p.fakultas?.namaFakultas})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase mb-2">Semester</label>
                  <input type="number" className="input-field" value={form.semester} onChange={e => setForm({...form, semester: +e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase mb-2">Kapasitas Mahasiswa</label>
                  <input type="number" className="input-field" value={form.jumlahMhs} onChange={e => setForm({...form, jumlahMhs: +e.target.value})} required />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Batal</button>
                <button type="submit" className="btn-primary flex-1">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
