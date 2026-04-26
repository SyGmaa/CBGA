"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Data Ruangan", href: "/master/ruangan", icon: "meeting_room" },
  { label: "Data Dosen", href: "/master/dosen", icon: "person" },
  { label: "Data Matkul", href: "/master/matkul", icon: "menu_book" },
  { label: "Preferensi Waktu", href: "/master/waktu", icon: "pending_actions" },
  { label: "Jadwal Perkuliahan", href: "/schedule", icon: "calendar_month" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <nav
        className={`fixed left-0 top-0 h-screen border-r border-slate-800 bg-slate-900 dark:bg-black text-blue-600 dark:text-blue-400 font-['Inter'] text-sm antialiased shadow-xl flex flex-col py-6 z-50 transition-all duration-300 ease-out
          ${sidebarOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full lg:translate-x-0 lg:w-72"}`}
      >
        <div className="px-6 mb-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container font-black tracking-tight text-xl">
            J
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Jadwal UP</h1>
            <p className="text-slate-400 text-xs">Academic Portal</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          {navItems.map((item, i) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={i}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-3 rounded-lg transition-all duration-200 scale-98 active:opacity-80
                  ${isActive 
                    ? "bg-blue-600/10 text-blue-400 font-semibold border-r-4 border-blue-600" 
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                  }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="px-6 mt-auto space-y-4">
          <button className="w-full bg-primary text-on-primary py-2 rounded-lg font-medium hover:bg-primary-container transition-colors shadow-sm text-sm">
            Generate Report
          </button>
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="flex items-center gap-3 text-slate-400 px-2 py-2 rounded-lg">
              <span className="material-symbols-outlined">account_circle</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-200">{user?.username || "User"}</span>
                <span className="text-[10px] uppercase tracking-wider">{user?.role || "—"}</span>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className="w-full flex items-center gap-3 text-error hover:text-error-container px-2 py-2 rounded-lg hover:bg-slate-800/50 transition-all duration-200"
            >
              <span className="material-symbols-outlined">logout</span>
              Logout
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
