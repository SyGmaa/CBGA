"use client";
import { create } from "zustand";
import type { User, GAProgress, JadwalDetail } from "@/types";

interface AppStore {
  // Auth
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;

  // GA Progress
  gaProgress: GAProgress | null;
  setGAProgress: (progress: GAProgress | null) => void;

  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Auth
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem("cbga_token", token);
    localStorage.setItem("cbga_user", JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem("cbga_token");
    localStorage.removeItem("cbga_user");
    set({ user: null, token: null });
  },

  // GA Progress
  gaProgress: null,
  setGAProgress: (progress) => set({ gaProgress: progress }),

  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
