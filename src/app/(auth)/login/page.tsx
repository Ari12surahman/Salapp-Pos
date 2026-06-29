"use client";

import { useState } from "react";
import { toast } from 'sonner';
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/axios";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('login', { username, password });
      if (res && res.status === "success" && res.user) {
        // Save permissions to localStorage
        localStorage.setItem("userPermissions", res.user.permissions || "pos");
        login(res.user);
        
        // Let React re-render, then redirect
        setTimeout(() => {
          const perms = res.user.permissions || "pos";
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
        }, 100);
      } else {
        toast.error("Login Gagal: " + (res?.message || "Username atau Password salah"));
      }
    } catch (error) {
      toast.error("Error menghubungi server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
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
  );
}
