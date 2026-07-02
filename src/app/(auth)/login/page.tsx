"use client";

import { useState, useEffect } from "react";
import { toast } from 'sonner';
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/axios";
import { Smartphone } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUser = useAuthStore((state) => state.user);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // If already authenticated, redirect immediately
    if (isAuthenticated && currentUser) {
      const perms = currentUser.permissions || "pos";
      const permsArray = perms.split(",");
      if (permsArray.includes("dashboard")) {
        router.push("/");
      } else {
        const dashboardRoutes = ["produk", "santri", "warung", "topup", "laporan", "pengaturan"];
        const firstRoute = dashboardRoutes.find(r => permsArray.includes(r));
        if (firstRoute) {
          router.push(`/${firstRoute}`);
        } else {
          router.push("/pos");
        }
      }
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [isAuthenticated, currentUser, router]);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
    } else {
      toast.info("Untuk install di HP: Buka menu browser (titik tiga) lalu pilih 'Tambahkan ke Layar Utama' atau 'Add to Home Screen'.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('login', { username, password });
      if (res && res.status === "success" && res.user) {
        localStorage.setItem("userPermissions", res.user.permissions || "pos");
        login(res.user);
        // router.push will happen via useEffect above once isAuthenticated becomes true
      } else {
        toast.error("Login Gagal: " + (res?.message || "Username atau Password salah"));
      }
    } catch (error) {
      toast.error("Error menghubungi server.");
    } finally {
      setLoading(false);
    }
  };

  // If already authenticated, don't show the login form (prevents flicker before redirect)
  if (isAuthenticated) return null;

  return (
    <div className="w-full max-w-sm flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center justify-between">
            <span>SALAPP</span>
            <span className="bg-primary text-primary-foreground font-mono text-xs px-2 py-1 ml-4 border border-border">/LOGIN</span>
          </CardTitle>
          <CardDescription>
            SYSTEM AUTHENTICATION PROTOCOL
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">USERNAME_</label>
              <Input 
                type="text" 
                placeholder="ENTER CREDENTIAL" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">PASSWORD_</label>
              <Input 
                type="password" 
                placeholder="*********" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
              {loading ? "VERIFYING..." : "VERIFY IDENTITY"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {!isInstalled && (
        <Button 
          variant="outline" 
          onClick={handleInstallApp} 
          className="w-full h-12 border-2 font-bold flex items-center gap-2"
        >
          <Smartphone className="w-4 h-4" />
          INSTALL APLIKASI
        </Button>
      )}
    </div>
  );
}
