"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Store,
  Wallet,
  Settings,
  LogOut,
  ShoppingBag,
  BookOpen,
  FileText,
  Smartphone,
  Key,
  Loader2
} from "lucide-react";

import { api } from "@/lib/api/axios";
import { toast } from "sonner";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const logout = useAuthStore((state: any) => state.logout);
  const currentUser = useAuthStore((state: any) => state.user);
  const [perms, setPerms] = useState<string[] | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNavigate = () => {
    if (onNavigate) onNavigate();
  };

  const handleLogout = () => {
    localStorage.removeItem("userPermissions");
    if (logout) logout();
    router.push("/login");
  };

  useEffect(() => {
    // Simulasi atau baca dari localStorage setelah fitur login jadi
    const savedPerms = localStorage.getItem("userPermissions");
    if (savedPerms) {
      setPerms(savedPerms.split(","));
    } else {
      // Jika belum login, tampilkan semua sementara waktu
      setPerms(["dashboard", "pos", "pesanan-online", "pencairan", "produk", "santri", "warung", "topup", "laporan", "cashflow", "pengaturan"]);
    }

    // Tangkap event PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password minimal 6 karakter!");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post('gantiPassword', { newPassword });
      if (res && res.status === 'error') throw new Error(res.message);
      toast.success("Password berhasil diubah!");
      setIsPasswordModalOpen(false);
      setNewPassword("");
    } catch(e: any) {
      toast.error("Gagal ganti password: " + (e.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasAccess = (menuId: string) => {
    if (!perms) return true; // loading or default
    return perms.includes(menuId);
  };

  return (
    <aside className="w-64 border-r border-border bg-background flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <span className="font-black text-2xl tracking-tighter uppercase">SALAPP</span>
        <span className="font-mono text-[10px] bg-primary text-primary-foreground px-1 py-0.5">V1.0</span>
      </div>
      
      <nav className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 px-2">Menu Utama</span>
        
        {hasAccess("dashboard") && (
          <Link href="/" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        )}
        {hasAccess("pos") && (
          <Link href="/pos" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-primary hover:text-primary-foreground transition-colors border border-transparent hover:border-border">
            <ShoppingCart className="w-4 h-4" />
            Terminal POS
          </Link>
        )}
        {hasAccess("pesanan-online") && (
          <Link href="/pesanan-online" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
            <ShoppingBag className="w-4 h-4" />
            Pesanan Online
          </Link>
        )}
        {hasAccess("pencairan") && (
          <Link href="/pencairan" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
            <Wallet className="w-4 h-4" />
            Pencairan Dana
          </Link>
        )}

        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-6 mb-2 px-2">Master Data</span>
        
        {hasAccess("produk") && (
          <Link href="/produk" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
            <Package className="w-4 h-4" />
            Produk & Stok
          </Link>
        )}
        {hasAccess("santri") && (
          <Link href="/santri" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
            <Users className="w-4 h-4" />
            Data Santri
          </Link>
        )}
        {hasAccess("warung") && (
          <Link href="/warung" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
            <Store className="w-4 h-4" />
            Kelola Warung
          </Link>
        )}

        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-6 mb-2 px-2">Keuangan & Laporan</span>
        
        {hasAccess("topup") && (
          <Link href="/topup" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
            <Wallet className="w-4 h-4" />
            Top Up Saldo
          </Link>
        )}
        {hasAccess("laporan") && (
          <Link href="/laporan" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
            <FileText className="w-4 h-4" />
            Laporan Harian
          </Link>
        )}
        {hasAccess("cashflow") && (
          <Link href="/cashflow" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
            <BookOpen className="w-4 h-4" />
            Buku Kas
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-border mt-auto flex flex-col gap-1">
        {deferredPrompt && (
          <button onClick={handleInstallApp} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase text-primary hover:bg-primary hover:text-primary-foreground transition-colors text-left border border-transparent hover:border-border">
            <Smartphone className="w-4 h-4" />
            Install App
          </button>
        )}
        {hasAccess("pengaturan") && (
          <Link href="/pengaturan" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors">
            {currentUser?.role === 'Super Admin' ? (
              <Settings className="w-4 h-4" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            {currentUser?.role === 'Super Admin' ? "Pengaturan" : "Pengguna"}
          </Link>
        )}
        <button onClick={() => setIsPasswordModalOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors text-left border border-transparent hover:border-border">
          <Key className="w-4 h-4" />
          Ganti Password
        </button>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors text-left mt-1 border border-transparent hover:border-border">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <form onSubmit={handlePasswordSubmit} className="bg-card border-2 border-border p-6 w-full max-w-sm shadow-2xl relative">
            <h2 className="text-xl font-black uppercase mb-4">Ganti Password</h2>
            
            <div className="flex flex-col gap-2 mb-6">
              <label className="font-bold text-sm uppercase">Password Baru</label>
              <input 
                required 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="border-2 border-border p-2 bg-background font-mono" 
                placeholder="Minimal 6 Karakter" 
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button 
                type="button" 
                onClick={() => setIsPasswordModalOpen(false)}
                className="px-4 py-2 border-2 border-border font-bold uppercase hover:bg-accent transition-colors"
              >
                BATAL
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-bold uppercase hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                SIMPAN
              </button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
}
