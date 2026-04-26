"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Dosen, Prodi } from "@/types";

export default function DosenPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Dosen | null>(null);
  const [form, setForm] = useState({ nidn: "", namaDosen: "", idProdi: 0 });

  const { data: dosenList = [], isLoading } = useQuery<Dosen[]>({
    queryKey: ["dosen"],
    queryFn: () => api.getDosen() as Promise<Dosen[]>,
  });

  const { data: prodiList = [] } = useQuery<Prodi[]>({
    queryKey: ["prodi"],
    queryFn: () => api.getProdi() as Promise<Prodi[]>,
  });

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dosen</h1>
          <p className="text-sm text-muted mt-1">Manajemen homebase dosen universitas</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ Tambah Dosen</button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>NIDN</th>
              <th>Nama Dosen</th>
              <th>Homebase</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
            ) : dosenList.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted py-8">Belum ada data dosen</td></tr>
            ) : (
              dosenList.map((item, i) => (
                <tr key={item.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td><code className="text-xs bg-surface px-2 py-1 rounded font-mono">{item.nidn}</code></td>
                  <td className="font-medium">{item.namaDosen}</td>
                  <td>
                    {item.prodi ? (
                      <span className="text-xs text-secondary-light bg-secondary/15 px-2 py-1 rounded">
                        {item.prodi.namaProdi}
                      </span>
                    ) : (
                      <span className="text-xs text-muted italic">Belum diset</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(item)} className="btn-secondary text-xs py-1.5 px-3">Edit</button>
                      <button onClick={() => { if (confirm("Hapus dosen ini?")) deleteMutation.mutate(item.id); }} className="btn-danger text-xs py-1.5 px-3">Hapus</button>
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
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editItem ? "Edit Dosen" : "Tambah Dosen"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">NIDN</label>
                <input className="input-field" value={form.nidn} onChange={(e) => setForm({ ...form, nidn: e.target.value })} required placeholder="12345678" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">Nama Dosen</label>
                <input className="input-field" value={form.namaDosen} onChange={(e) => setForm({ ...form, namaDosen: e.target.value })} required placeholder="Nama Lengkap & Gelar" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">Homebase Prodi</label>
                <select 
                  className="input-field" 
                  value={form.idProdi} 
                  onChange={e => setForm({...form, idProdi: +e.target.value})}
                >
                  <option value={0}>Pilih Prodi (Opsional)</option>
                  {prodiList.map(p => <option key={p.id} value={p.id}>{p.namaProdi}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Batal</button>
                <button type="submit" className="btn-primary flex-1">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
