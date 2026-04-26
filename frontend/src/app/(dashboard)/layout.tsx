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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div
        className={`flex-1 flex flex-col relative h-full transition-all duration-300 ${
          sidebarOpen ? "ml-72" : "ml-0 lg:ml-72"
        }`}
      >
        {/* TopAppBar (Navbar) */}
        <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-18rem)] z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm flex items-center justify-between px-8 h-16 font-['Inter'] text-sm transition-all duration-300">
          <div className="flex-1 flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            {/* Search Bar */}
            <div className="relative w-64 hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60">search</span>
              <input 
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20 text-on-surface text-sm transition-all" 
                placeholder="Search..." 
                type="text"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-on-surface-variant/60 hover:text-primary hover:bg-primary/5 rounded-lg transition-all duration-300 relative group">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
            </button>
            <button className="p-2 text-on-surface-variant/60 hover:text-primary hover:bg-primary/5 rounded-lg transition-all duration-300 hidden sm:block">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-xs font-bold text-on-surface">{user?.username || "Admin"}</span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Administrator</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center overflow-hidden border border-outline-variant shadow-sm">
                {user?.username ? (
                  <span className="font-bold text-primary text-xs">{user.username.charAt(0).toUpperCase()}</span>
                ) : (
                  <span className="material-symbols-outlined text-on-surface-variant">person</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace Scrollable */}
        <main className="flex-1 overflow-y-auto mt-16 p-container-margin space-y-stack-lg pb-24">
          {children}
        </main>
      </div>
    </div>
  );
}
