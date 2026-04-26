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
        <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-18rem)] z-40 bg-white border-b border-blue-100 shadow-sm flex items-center justify-between px-8 h-16 font-['Inter'] text-sm transition-all duration-300">
          <div className="flex-1 flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            {/* Search Bar */}
            <div className="relative w-64 hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/40">search</span>
              <input 
                className="w-full pl-10 pr-4 py-2 bg-white/50 border border-blue-100 rounded-lg focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 text-on-surface text-sm" 
                placeholder="Search..." 
                type="text"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-primary/60 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors duration-300 relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
            </button>
            <button className="p-2 text-primary/60 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors duration-300 hidden sm:block">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center overflow-hidden border border-primary/20">
              {user?.username ? (
                <span className="font-bold text-on-primary-container text-xs">{user.username.charAt(0).toUpperCase()}</span>
              ) : (
                <span className="material-symbols-outlined text-on-primary-container">person</span>
              )}
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
