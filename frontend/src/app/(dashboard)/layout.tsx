"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAppStore } from "@/store/useAppStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, token, sidebarOpen, toggleSidebar } = useAppStore();

  useEffect(() => {
    // Check auth on mount
    const savedToken = localStorage.getItem("cbga_token");
    const savedUser = localStorage.getItem("cbga_user");

    if (!savedToken || !savedUser) {
      router.push("/");
      return;
    }

    if (!user) {
      try {
        const parsed = JSON.parse(savedUser);
        useAppStore.getState().setAuth(parsed, savedToken);
      } catch {
        router.push("/");
      }
    }
  }, [user, router]);

  if (!user && typeof window !== "undefined" && !localStorage.getItem("cbga_token")) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main
        className={`flex-1 overflow-y-auto transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-0 lg:ml-20"
        }`}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 glass px-6 py-4 flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1" />
          <div className="text-xs text-muted">
            Universitas Pahlawan — Sistem Penjadwalan
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
