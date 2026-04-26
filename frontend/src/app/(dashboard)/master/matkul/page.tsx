"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MataKuliah } from "@/types";

export default function MatkulPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MataKuliah | null>(null);
  const [form, setForm] = useState({ kodeMk: "", namaMk: "", sks: 2, semester: 1, jumlahMhs: 30, idUserProdi: 2 });

  const { data: list = [], isLoading } = useQuery<MataKuliah[]>({
    queryKey: ["matkul"], queryFn: () => api.getMatkul() as Promise<MataKuliah[]>,
  });

  const create = useMutation({ mutationFn: (d: any) => api.createMatkul(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["matkul"] }); setShowModal(false); } });
  const update = useMutation({ mutationFn: ({ id, d }: any) => api.updateMatkul(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["matkul"] }); setShowModal(false); } });
  const del = useMutation({ mutationFn: (id: number) => api.deleteMatkul(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["matkul"] }) });

  const openCreate = () => { setEditItem(null); setForm({ kodeMk: "", namaMk: "", sks: 2, semester: 1, jumlahMhs: 30, idUserProdi: 2 }); setShowModal(true); };
  const openEdit = (it: MataKuliah) => { setEditItem(it); setForm({ kodeMk: it.kodeMk, namaMk: it.namaMk, sks: it.sks, semester: it.semester, jumlahMhs: it.jumlahMhs, idUserProdi: it.idUserProdi }); setShowModal(true); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); editItem ? update.mutate({ id: editItem.id, d: form }) : create.mutate(form); };
  const sc = (s: number) => ({ 1: "bg-blue-500/15 text-blue-400", 3: "bg-emerald-500/15 text-emerald-400", 5: "bg-violet-500/15 text-violet-400", 7: "bg-amber-500/15 text-amber-400" }[s] || "bg-muted/15 text-muted");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Mata Kuliah</h1><p className="text-sm text-muted mt-1">Kelola data mata kuliah</p></div>
        <button onClick={openCreate} className="btn-primary">+ Tambah MK</button>
      </div>
      <div className="glass-card overflow-hidden">
        <table className="data-table"><thead><tr><th>No</th><th>Kode</th><th>Nama MK</th><th>SKS</th><th>Smt</th><th>Mhs</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>{isLoading ? <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr> : list.map((it, i) => (
            <tr key={it.id}><td className="text-muted">{i+1}</td><td><code className="text-xs bg-surface px-2 py-1 rounded">{it.kodeMk}</code></td><td className="font-medium">{it.namaMk}</td><td>{it.sks}</td><td><span className={`px-2 py-1 rounded-lg text-xs font-semibold ${sc(it.semester)}`}>Smt {it.semester}</span></td><td>{it.jumlahMhs}</td>
              <td className="text-right"><div className="flex justify-end gap-2"><button onClick={() => openEdit(it)} className="btn-secondary text-xs py-1.5 px-3">Edit</button><button onClick={() => { if(confirm("Hapus?")) del.mutate(it.id); }} className="btn-danger text-xs py-1.5 px-3">Hapus</button></div></td></tr>
          ))}</tbody></table>
      </div>
      {showModal && <div className="modal-overlay" onClick={() => setShowModal(false)}><div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{editItem ? "Edit" : "Tambah"} MK</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-semibold text-muted uppercase mb-2">Kode</label><input className="input-field" value={form.kodeMk} onChange={e => setForm({...form, kodeMk: e.target.value})} required /></div>
            <div><label className="block text-xs font-semibold text-muted uppercase mb-2">SKS</label><input type="number" className="input-field" value={form.sks} onChange={e => setForm({...form, sks: +e.target.value})} required /></div></div>
          <div><label className="block text-xs font-semibold text-muted uppercase mb-2">Nama MK</label><input className="input-field" value={form.namaMk} onChange={e => setForm({...form, namaMk: e.target.value})} required /></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-semibold text-muted uppercase mb-2">Semester</label><input type="number" className="input-field" value={form.semester} onChange={e => setForm({...form, semester: +e.target.value})} /></div>
            <div><label className="block text-xs font-semibold text-muted uppercase mb-2">Jumlah Mhs</label><input type="number" className="input-field" value={form.jumlahMhs} onChange={e => setForm({...form, jumlahMhs: +e.target.value})} /></div></div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Batal</button><button type="submit" className="btn-primary flex-1">Simpan</button></div>
        </form></div></div>}
    </div>
  );
}
