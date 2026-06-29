"use client";

import { Menu, UserCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useState, useEffect } from "react";
import { api } from "@/lib/api/axios";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const user = useAuthStore(state => state.user);
  const [warungName, setWarungName] = useState<string>("");

  useEffect(() => {
    if (user?.warungId && user.warungId !== "ALL") {
      api.get('getWarung').then(res => {
        if (res?.data) {
          const warung = res.data.find((w: any) => w.id === user.warungId || w.ID === user.warungId);
          if (warung) {
            setWarungName(warung.nama || warung.Nama);
          }
        }
      }).catch(console.error);
    }
  }, [user?.warungId]);

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 shrink-0 print:hidden">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="md:hidden p-1 hover:bg-accent hover:text-accent-foreground border border-transparent hover:border-border transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="font-mono text-xs hidden md:flex items-center gap-2">
          <span className="px-2 py-0.5 bg-foreground text-background">SESSION</span>
          <span className="uppercase tracking-widest text-muted-foreground">Active</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="font-mono text-xs text-right hidden sm:block">
          <p className="font-bold uppercase tracking-widest text-foreground">{user?.role || "GUEST"}</p>
          <p className="text-muted-foreground">
            {user?.warungId === "ALL" 
              ? (user?.name || "SEMUA WARUNG") 
              : (warungName || user?.warungId || user?.name || "-")}
          </p>
        </div>
        <div className="w-8 h-8 bg-muted border border-border flex items-center justify-center">
          <UserCircle className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
