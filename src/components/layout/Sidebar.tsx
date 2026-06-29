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
  ShoppingBag
} from "lucide-react";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const logout = useAuthStore((state: any) => state.logout);
  const [perms, setPerms] = useState<string[] | null>(null);

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
      setPerms(["dashboard", "pos", "pesanan-online", "produk", "santri", "warung", "topup", "laporan", "pengaturan"]);
    }
  }, []);

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
        <Link href="/pesanan-online" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
          <ShoppingBag className="w-4 h-4" />
          Pesanan Online
        </Link>
        <Link href="/pencairan" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border">
          <Wallet className="w-4 h-4" />
          Pencairan Dana
        </Link>

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
            <Wallet className="w-4 h-4" />
            Laporan Harian
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        {hasAccess("pengaturan") && (
          <Link href="/pengaturan" onClick={handleNavigate} className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase hover:bg-accent hover:text-accent-foreground transition-colors">
            <Settings className="w-4 h-4" />
            Pengaturan
          </Link>
        )}
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors text-left mt-1 border border-transparent hover:border-border">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
