"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useState, useEffect } from "react";

export function BottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const currentUser = useAuthStore((state: any) => state.user);
  const [perms, setPerms] = useState<string[] | null>(null);

  useEffect(() => {
    const savedPerms = localStorage.getItem("userPermissions");
    if (savedPerms) {
      const permsArray = savedPerms.split(",");
      if (!permsArray.includes("cek-saldo")) permsArray.push("cek-saldo");
      setPerms(permsArray);
    } else {
      setPerms(["dashboard", "pos", "pesanan-online", "pencairan", "produk", "santri", "warung", "topup", "laporan", "cashflow", "pengaturan"]);
    }
  }, []);

  const hasAccess = (menuId: string) => {
    if (!perms) return true;
    return perms.includes(menuId);
  };

  const navItems = [
    {
      name: "Home",
      href: "/",
      icon: "ri-home-5-line",
      activeIcon: "ri-home-5-fill",
      id: "dashboard"
    },
    {
      name: "Kasir",
      href: "/pos",
      icon: "ri-store-2-line",
      activeIcon: "ri-store-2-fill",
      id: "pos"
    },
    {
      name: "Produk",
      href: "/produk",
      icon: "ri-box-3-line",
      activeIcon: "ri-box-3-fill",
      id: "produk"
    },
    {
      name: "Laporan",
      href: "/laporan",
      icon: "ri-file-chart-line",
      activeIcon: "ri-file-chart-fill",
      id: "laporan"
    }
  ];

  // Filter out items user doesn't have access to
  const visibleItems = navItems.filter(item => hasAccess(item.id));

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t-2 border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <i className={`${isActive ? item.activeIcon : item.icon} text-2xl`}></i>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'font-black' : ''}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
        
        {/* Menu Toggle Button */}
        <button 
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <i className="ri-menu-4-line text-2xl"></i>
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Menu
          </span>
        </button>
      </div>
    </div>
  );
}
