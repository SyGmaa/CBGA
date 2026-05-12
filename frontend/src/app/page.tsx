"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { LoginResponse } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, user } = useAppStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("cbga_token");
    const savedUser = localStorage.getItem("cbga_user");
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setAuth(parsed, savedToken);
        router.push("/dashboard");
      } catch { /* ignore */ }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = (await api.login(username, password)) as LoginResponse;
      setAuth(data.user, data.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-low min-h-screen flex items-center justify-center p-4 antialiased">
      {/* Central Card Container */}
      <div className="w-full max-w-[1000px] bg-surface-container-lowest rounded-[24px] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] overflow-hidden flex border border-[#E2E8F0]">
        
        {/* Left Side: Abstract Illustration (Hidden on Mobile) */}
        <div className="hidden md:block md:w-1/2 relative bg-surface-container">
          <img 
            alt="Abstract Illustration" 
            className="w-full h-full object-cover opacity-80" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRgOkJTHgMfFQ_wiz8dKvhK4sTCTXFSpIt4tM1xT6BeX6nyOUN7PUFBWl42O2j9fTrZO94i4JcGKE8cH0jdNM6vO6iXl-Z5PqR7krhtfMdzzHUWwBgWOG7WT-W8lRxrQ6j8qDnzgD2omtnQ4kqj654R2ln101fB66c9Ga_egsI6aVfn2w3mi_EX9UJeilajRdXat4vcLSRi7ZAipZWMDJHpILlsWXYE2mLWX6PqcYM5FXJIlJvaMA1w0QpOWGud29l5J8F1UzfyjP_"
          />
          {/* Overlay Content */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-container/90 to-transparent flex flex-col justify-end p-12">
            <div className="mb-6 animate-fade-in">
              <span className="material-symbols-outlined filled text-on-primary text-5xl mb-4">school</span>
              <h2 className="font-display-lg text-display-lg text-on-primary mb-2">Campus Scheduler</h2>
              <p className="font-body-base text-body-base text-inverse-primary max-w-sm">
                Sistem penjadwalan akademik terpadu untuk efisiensi pengelolaan waktu dan ruang.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form Area */}
        <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-surface-container-lowest animate-fade-in">
          
          {/* Logo & Title */}
          <div className="mb-10 text-center md:text-left">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-surface-container text-primary-container mb-6 md:hidden">
              <span className="material-symbols-outlined filled text-3xl">school</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-background mb-stack-sm">Masuk ke Akun Anda</h1>
            <p className="font-body-base text-body-base text-on-surface-variant">Silakan masuk menggunakan akun Prodi atau PJPJK</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-stack-lg">
            
            {/* Username Input */}
            <div className="space-y-stack-sm">
              <label className="font-label-sm text-label-sm text-on-surface block" htmlFor="username">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline">person</span>
                </div>
                <input 
                  id="username" 
                  name="username" 
                  placeholder="Masukkan username" 
                  required 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface font-body-base text-body-base focus:ring-2 focus:ring-secondary-container focus:border-secondary-container transition-all duration-300 outline-none" 
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-stack-sm">
              <label className="font-label-sm text-label-sm text-on-surface block" htmlFor="password">Kata Sandi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline">lock</span>
                </div>
                <input 
                  id="password" 
                  name="password" 
                  placeholder="••••••••" 
                  required 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface font-body-base text-body-base focus:ring-2 focus:ring-secondary-container focus:border-secondary-container transition-all duration-300 outline-none" 
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button className="text-outline hover:text-on-surface focus:outline-none transition-colors" type="button">
                    <span className="material-symbols-outlined">visibility_off</span>
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-sm text-error bg-error-container/50 border border-error-container rounded-xl px-4 py-3 animate-fade-in font-label-sm">
                {error}
              </div>
            )}

            {/* Options */}
            <div className="flex items-center justify-between pt-stack-sm">
              <div className="flex items-center">
                <input 
                  id="remember-me" 
                  name="remember-me" 
                  type="checkbox"
                  className="h-4 w-4 text-primary-container focus:ring-primary-container border-outline-variant rounded bg-surface-container-lowest" 
                />
                <label className="ml-2 block font-label-sm text-label-sm text-on-surface-variant" htmlFor="remember-me">
                  Ingat Saya
                </label>
              </div>
              <div className="text-sm">
                <a className="font-label-sm text-label-sm text-primary-container hover:text-primary transition-colors font-semibold" href="#">
                  Lupa Password?
                </a>
              </div>
            </div>

            {/* Demo Credentials */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setUsername("admin_pjpjk");
                  setPassword("password123");
                }}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-surface-variant text-on-surface hover:bg-surface-dim transition-colors"
              >
                Demo: Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername("prodi_tif");
                  setPassword("password123");
                }}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-surface-variant text-on-surface hover:bg-surface-dim transition-colors"
              >
                Demo: Prodi TI
              </button>
            </div>

            {/* Submit Button */}
            <div className="pt-stack-md">
              <button 
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-label-sm text-label-sm font-semibold text-on-primary bg-primary-container hover:bg-surface-tint focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed" 
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined spin text-[20px]">refresh</span>
                    Memproses...
                  </span>
                ) : "Masuk"}
              </button>
            </div>
          </form>
          
          {/* Support Contact */}
          <div className="mt-10 text-center">
            <p className="font-mono-data text-mono-data text-outline">
              Butuh bantuan? Hubungi <a className="text-primary-container hover:underline" href="#">Support IT</a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
