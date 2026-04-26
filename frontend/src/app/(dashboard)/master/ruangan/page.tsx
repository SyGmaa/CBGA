"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Ruangan } from "@/types";

export default function RuanganPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Ruangan | null>(null);
  const [form, setForm] = useState({ namaRuangan: "", namaGedung: "", kapasitas: 30 });
  const { data: list = [], isLoading } = useQuery<Ruangan[]>({ queryKey: ["ruangan"], queryFn: () => api.getRuangan() as Promise<Ruangan[]> });
  const create = useMutation({ mutationFn: (d: any) => api.createRuangan(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["ruangan"] }); setShowModal(false); } });
  const update = useMutation({ mutationFn: ({ id, d }: any) => api.updateRuangan(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["ruangan"] }); setShowModal(false); } });
  const del = useMutation({ mutationFn: (id: number) => api.deleteRuangan(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["ruangan"] }) });
  const openCreate = () => { setEditItem(null); setForm({ namaRuangan: "", namaGedung: "", kapasitas: 30 }); setShowModal(true); };
  const openEdit = (it: Ruangan) => { setEditItem(it); setForm({ namaRuangan: it.namaRuangan, namaGedung: it.namaGedung, kapasitas: it.kapasitas }); setShowModal(true); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); editItem ? update.mutate({ id: editItem.id, d: form }) : create.mutate(form); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Ruangan</h1><p className="text-sm text-muted mt-1">Kelola data ruangan</p></div>
        <button onClick={openCreate} className="btn-primary">+ Tambah</button>
      </div>
      <div className="glass-card overflow-hidden">
        <table className="data-table"><thead><tr><th>No</th><th>Nama Ruangan</th><th>Gedung</th><th>Kapasitas</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>{isLoading ? <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr> : list.map((it, i) => (
            <tr key={it.id}><td className="text-muted">{i+1}</td><td className="font-medium">{it.namaRuangan}</td><td>{it.namaGedung}</td><td><span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/15 text-primary-light">{it.kapasitas} org</span></td>
              <td className="text-right"><div className="flex justify-end gap-2"><button onClick={() => openEdit(it)} className="btn-secondary text-xs py-1.5 px-3">Edit</button><button onClick={() => { if(confirm("Hapus?")) del.mutate(it.id); }} className="btn-danger text-xs py-1.5 px-3">Hapus</button></div></td></tr>
          ))}</tbody></table>
      </div>
      {showModal && <div className="modal-overlay" onClick={() => setShowModal(false)}><div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{editItem ? "Edit" : "Tambah"} Ruangan</h2>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="block text-xs font-semibold text-muted uppercase mb-2">Nama Ruangan</label><input className="input-field" value={form.namaRuangan} onChange={e => setForm({...form, namaRuangan: e.target.value})} required /></div>
          <div><label className="block text-xs font-semibold text-muted uppercase mb-2">Gedung</label><input className="input-field" value={form.namaGedung} onChange={e => setForm({...form, namaGedung: e.target.value})} required /></div>
          <div><label className="block text-xs font-semibold text-muted uppercase mb-2">Kapasitas</label><input type="number" className="input-field" value={form.kapasitas} onChange={e => setForm({...form, kapasitas: +e.target.value})} required /></div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Batal</button><button type="submit" className="btn-primary flex-1">Simpan</button></div>
        </form></div></div>}
    </div>
  );
}
