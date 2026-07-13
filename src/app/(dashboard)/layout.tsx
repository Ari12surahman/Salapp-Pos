"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  if (!isHydrated || !isAuthenticated) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 bg-background h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-300">
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 w-full relative">
        <div className="hidden md:block">
          <Topbar onMenuClick={() => setMobileMenuOpen(true)} />
        </div>
        {/* On mobile, we might want to keep the title in topbar or just remove it completely. 
            Often apps keep a small top header, but Topbar is quite big. Let's keep it but simplified or hidden. 
            For now, we hide Topbar completely on mobile because BottomNav is the primary navigation,
            and screen estate is precious. */}
        
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </main>

        <BottomNav onMenuClick={() => setMobileMenuOpen(true)} />
      </div>
    </div>
  );
}
