"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Dosen } from "@/types";

export default function DosenPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Dosen | null>(null);
  const [form, setForm] = useState({ nidn: "", namaDosen: "" });

  const { data: dosenList = [], isLoading } = useQuery<Dosen[]>({
    queryKey: ["dosen"],
    queryFn: () => api.getDosen() as Promise<Dosen[]>,
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

  const openCreate = () => { setEditItem(null); setForm({ nidn: "", namaDosen: "" }); setShowModal(true); };
  const openEdit = (item: Dosen) => { setEditItem(item); setForm({ nidn: item.nidn, namaDosen: item.namaDosen }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditItem(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dosen</h1>
          <p className="text-sm text-muted mt-1">Kelola data dosen</p>
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
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={4}><div className="h-5 bg-surface rounded animate-pulse" /></td>
                </tr>
              ))
            ) : dosenList.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted py-8">Belum ada data dosen</td></tr>
            ) : (
              dosenList.map((item, i) => (
                <tr key={item.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td><code className="text-xs bg-surface px-2 py-1 rounded">{item.nidn}</code></td>
                  <td className="font-medium">{item.namaDosen}</td>
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
                <input className="input-field" value={form.nidn} onChange={(e) => setForm({ ...form, nidn: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-2">Nama Dosen</label>
                <input className="input-field" value={form.namaDosen} onChange={(e) => setForm({ ...form, namaDosen: e.target.value })} required />
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
