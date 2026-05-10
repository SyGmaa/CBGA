"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Data Ruangan", href: "/master/ruangan", icon: "meeting_room" },
  { label: "Data Dosen", href: "/master/dosen", icon: "person" },
  { label: "Data Matkul", href: "/master/matkul", icon: "menu_book" },
  { label: "Slot Waktu", href: "/master/waktu", icon: "schedule" },
  { label: "Preferensi Dosen", href: "/master/preferensi", icon: "pending_actions" },
  { label: "Jadwal Perkuliahan", href: "/schedule", icon: "calendar_month" },
  { label: "Interactive View", href: "/schedule-interactive", icon: "monitoring" },
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
        className={`fixed left-0 top-0 h-screen border-r border-slate-800 bg-slate-900 text-blue-400 font-['Inter'] text-sm antialiased shadow-xl flex flex-col py-6 z-50 transition-all duration-300 ease-out
          ${sidebarOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full lg:translate-x-0 lg:w-20"}`}
      >
        <div className={`px-6 mb-8 flex items-center transition-all duration-300 ${sidebarOpen ? "gap-4" : "justify-center px-0"}`}>
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container font-black tracking-tight text-xl shadow-lg border border-white/10">
            J
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="text-white font-bold text-lg leading-tight">Jadwal UP</h1>
              <p className="text-slate-400 text-xs">Academic Portal</p>
            </div>
          )}
        </div>

        <div className={`flex-1 ${sidebarOpen ? "overflow-y-auto" : "overflow-y-visible"} px-4 space-y-1.5 transition-all duration-300 ${!sidebarOpen && "px-2"} custom-scrollbar`}>
          {navItems.map((item, i) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={i}
                href={item.href}
                className={`group relative flex items-center rounded-lg transition-all duration-200 scale-98 active:opacity-80
                  ${sidebarOpen ? "gap-3 px-6 py-3" : "justify-center py-3 w-full"}
                  ${isActive 
                    ? "bg-blue-600/10 text-blue-400 font-semibold border-r-4 border-blue-600 shadow-sm" 
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                  }`}
              >
                <span className="material-symbols-outlined flex-shrink-0">{item.icon}</span>
                {sidebarOpen ? (
                  <span className="overflow-hidden whitespace-nowrap">{item.label}</span>
                ) : (
                  <div className="fixed left-20 ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none transition-all duration-200 whitespace-nowrap z-[100] shadow-2xl border border-white/10 translate-x-[-10px] group-hover:translate-x-0">
                    {item.label}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45 border-l border-b border-white/10"></div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div className={`px-6 mt-auto space-y-4 transition-all duration-300 ${!sidebarOpen && "px-2 flex flex-col items-center"}`}>
          <button 
            className={`group relative w-full bg-primary text-on-primary rounded-lg font-medium hover:bg-primary-container transition-all shadow-md text-sm border border-white/5 active:scale-95 flex items-center justify-center
              ${sidebarOpen ? "py-2.5 px-4" : "h-12 w-12 p-0"}`}
          >
            <span className="material-symbols-outlined">analytics</span>
            {sidebarOpen ? (
              <span className="ml-2 overflow-hidden whitespace-nowrap">Generate Report</span>
            ) : (
              <div className="fixed left-20 ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none transition-all duration-200 whitespace-nowrap z-[100] shadow-2xl border border-white/10 translate-x-[-10px] group-hover:translate-x-0 font-normal">
                Generate Report
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45 border-l border-b border-white/10"></div>
              </div>
            )}
          </button>
          <div className={`pt-4 border-t border-slate-800 space-y-2 w-full ${!sidebarOpen && "flex flex-col items-center"}`}>
            <div className={`flex items-center text-slate-400 py-2 rounded-lg bg-slate-800/30 transition-all duration-300 ${sidebarOpen ? "gap-3 px-2" : "justify-center px-0 w-12 h-12"}`}>
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 border border-slate-600">
                <span className="material-symbols-outlined text-lg">account_circle</span>
              </div>
              {sidebarOpen && (
                <div className="flex flex-col overflow-hidden whitespace-nowrap">
                  <span className="text-sm font-bold text-slate-200">{user?.username || "Admin"}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{user?.role || "STAFF"}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className={`group relative w-full flex items-center text-error/80 hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200
                ${sidebarOpen ? "gap-3 px-4 py-2.5" : "justify-center h-12 w-12 p-0"}`}
            >
              <span className="material-symbols-outlined group-hover:rotate-180 transition-transform duration-500">logout</span>
              {sidebarOpen ? (
                <span className="font-medium overflow-hidden whitespace-nowrap">Logout</span>
              ) : (
                <div className="fixed left-20 ml-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none transition-all duration-200 whitespace-nowrap z-[100] shadow-2xl border border-white/10 translate-x-[-10px] group-hover:translate-x-0 font-normal text-error">
                  Logout
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45 border-l border-b border-white/10"></div>
                </div>
              )}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
