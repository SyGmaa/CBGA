const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cbga_token");
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    fetchAPI("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  getProfile: () => fetchAPI("/auth/profile"),

  // Dashboard
  getStats: () => fetchAPI("/dashboard/stats"),

  // Slot Waktu
  getSlotWaktu: () => fetchAPI("/waktu"),
  createSlotWaktu: (data: any) =>
    fetchAPI("/waktu", { method: "POST", body: JSON.stringify(data) }),
  updateSlotWaktu: (id: number, data: any) =>
    fetchAPI(`/waktu/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSlotWaktu: (id: number) =>
    fetchAPI(`/waktu/${id}`, { method: "DELETE" }),

  // Mata Kuliah
  getMatkul: () => fetchAPI("/matkul"),
  createMatkul: (data: any) =>
    fetchAPI("/matkul", { method: "POST", body: JSON.stringify(data) }),
  updateMatkul: (id: number, data: any) =>
    fetchAPI(`/matkul/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMatkul: (id: number) =>
    fetchAPI(`/matkul/${id}`, { method: "DELETE" }),

  // Dosen
  getDosen: () => fetchAPI("/dosen"),
  createDosen: (data: any) =>
    fetchAPI("/dosen", { method: "POST", body: JSON.stringify(data) }),
  updateDosen: (id: number, data: any) =>
    fetchAPI(`/dosen/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDosen: (id: number) =>
    fetchAPI(`/dosen/${id}`, { method: "DELETE" }),

  // Ruangan
  getRuangan: () => fetchAPI("/ruangan"),
  createRuangan: (data: any) =>
    fetchAPI("/ruangan", { method: "POST", body: JSON.stringify(data) }),
  updateRuangan: (id: number, data: any) =>
    fetchAPI(`/ruangan/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRuangan: (id: number) =>
    fetchAPI(`/ruangan/${id}`, { method: "DELETE" }),

  // Preferensi
  getPreferensi: () => fetchAPI("/preferensi"),
  createPreferensi: (data: any) =>
    fetchAPI("/preferensi", { method: "POST", body: JSON.stringify(data) }),
  updatePreferensi: (id: number, data: any) =>
    fetchAPI(`/preferensi/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePreferensi: (id: number) =>
    fetchAPI(`/preferensi/${id}`, { method: "DELETE" }),

  // Schedule
  getSchedules: () => fetchAPI("/schedule"),
  generateSchedule: (data: any) =>
    fetchAPI("/schedule/generate", { method: "POST", body: JSON.stringify(data) }),
  getScheduleResult: (id: number) => fetchAPI(`/schedule/result/${id}`),
  updateScheduleSlot: (detailId: number, data: any) =>
    fetchAPI(`/schedule/update-slot/${detailId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSchedule: (id: number) =>
    fetchAPI(`/schedule/${id}`, { method: "DELETE" }),
  bulkDeleteSchedules: (ids: number[]) =>
    fetchAPI('/schedule/bulk-delete', { method: "POST", body: JSON.stringify({ ids }) }),

  // Master Lookups
  getFakultas: () => fetchAPI("/master/fakultas"),
  getProdi: () => fetchAPI("/master/prodi"),
  getGedung: () => fetchAPI("/master/gedung"),
};
