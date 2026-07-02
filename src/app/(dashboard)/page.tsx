"use client";

import Link from "next/link";
import { ArrowRight, ShoppingCart, Users, Package, Wallet } from "lucide-react";
import { formatDateID, formatDateTimeID } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((state: any) => state.user);
  const [perms, setPerms] = useState<string[] | null>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [selectedWarung, setSelectedWarung] = useState<string>("ALL");
  const [warungs, setWarungs] = useState<any[]>([]);

  useEffect(() => {
    const savedPerms = localStorage.getItem("userPermissions");
    if (savedPerms) {
      const permsArray = savedPerms.split(",");
      if (!permsArray.includes("dashboard")) {
        // Find the first dashboard route they have access to so they don't get trapped in /pos
        const dashboardRoutes = ["produk", "santri", "warung", "topup", "laporan", "pengaturan", "cashflow"];
        const firstRoute = dashboardRoutes.find(r => permsArray.includes(r));
        if (firstRoute) {
          router.replace(`/${firstRoute}`);
        } else {
          router.replace("/pos");
        }
      } else {
        setPerms(permsArray);
      }
    } else {
      // Default to allowed if no permissions found (for dev/fallback)
      setPerms(["dashboard", "pos", "produk", "santri", "warung", "topup", "laporan", "pengaturan", "cashflow"]);
    }
  }, [router]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const payload = {
          warungId: user?.warungId === 'ALL' ? selectedWarung : user?.warungId
        };
        const res = await api.post('getDashboard', payload);
        if (res && res.data) {
          setTelemetry(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data");
      }
    };
    fetchDashboard();
  }, [selectedWarung, user]);

  useEffect(() => {
    if (user?.warungId === 'ALL') {
      const fetchWarung = async () => {
        try {
          const res = await api.get('getWarung');
          if (res && res.data) {
            setWarungs(res.data);
          }
        } catch (err) {
          console.error("Failed to fetch warung data");
        }
      };
      fetchWarung();
    }
  }, [user]);

  if (!perms) return null; // Loading state to prevent flash

  const hasAccess = (menuId: string) => perms.includes(menuId);

  return (
    <div className="flex-1 p-4 md:p-8 flex flex-col gap-8 max-w-[1400px] mx-auto w-full animate-in fade-in duration-300">
      {/* HEADER SECTION */}
      <header className="border-b-2 border-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none mb-2">
            POS SALAPP
          </h1>
          <p className="font-mono text-muted-foreground uppercase text-sm tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-primary inline-block"></span>
            Pusat Data Utama // Rev 1.0
          </p>
        </div>
        <div className="font-mono text-xs md:text-sm text-right flex flex-col items-end gap-1">
          <span>STATUS SISTEM: <span className="text-primary font-bold">AKTIF</span></span>
          <span suppressHydrationWarning>TANGGAL: {formatDateID(new Date())}</span>
        </div>
      </header>

      {/* QUICK ACTIONS GRID */}
      <div className="industrial-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-2 border-border">
        {hasAccess("pos") && (
          <Link href="/pos" className="group p-6 flex flex-col gap-4 hover:bg-primary hover:text-primary-foreground transition-colors">
            <div className="flex justify-between items-center">
              <ShoppingCart className="w-8 h-8" />
              <span className="font-mono text-xs border border-current px-2 py-1">/POS</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-tight group-hover:text-primary-foreground">Terminal Kasir</h2>
              <p className="text-sm opacity-80 mt-1">Buka antarmuka kasir utama.</p>
            </div>
            <ArrowRight className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-2" />
          </Link>
        )}
        
        {hasAccess("produk") && (
          <Link href="/produk" className="group p-6 flex flex-col gap-4 hover:bg-muted transition-colors">
            <div className="flex justify-between items-center">
              <Package className="w-8 h-8" />
              <span className="font-mono text-xs border border-current px-2 py-1">/PRODUK</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-tight">Katalog</h2>
              <p className="text-sm text-muted-foreground mt-1">Kelola data produk dan stok.</p>
            </div>
            <ArrowRight className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-2" />
          </Link>
        )}

        {hasAccess("santri") && (
          <Link href="/santri" className="group p-6 flex flex-col gap-4 hover:bg-muted transition-colors">
            <div className="flex justify-between items-center">
              <Users className="w-8 h-8" />
              <span className="font-mono text-xs border border-current px-2 py-1">/SANTRI</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-tight">Data Santri</h2>
              <p className="text-sm text-muted-foreground mt-1">Manajemen identitas dan RFID.</p>
            </div>
            <ArrowRight className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-2" />
          </Link>
        )}

        {hasAccess("topup") && (
          <Link href="/topup" className="group p-6 flex flex-col gap-4 hover:bg-muted transition-colors">
            <div className="flex justify-between items-center">
              <Wallet className="w-8 h-8" />
              <span className="font-mono text-xs border border-current px-2 py-1">/TOPUP</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-tight">Saldo</h2>
              <p className="text-sm text-muted-foreground mt-1">Top up dan riwayat mutasi.</p>
            </div>
            <ArrowRight className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-2" />
          </Link>
        )}
      </div>

      {/* DASHBOARD TELEMETRY */}
      <section className="mt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase bg-foreground text-background px-2 py-1">DATA</span>
            <h3 className="font-bold uppercase tracking-widest text-sm">Ringkasan Hari Ini</h3>
          </div>
          
          {user?.warungId === 'ALL' && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold opacity-80">FILTER WARUNG:</span>
              <select 
                value={selectedWarung}
                onChange={(e) => setSelectedWarung(e.target.value)}
                className="h-8 border-2 border-border bg-background px-2 text-xs uppercase"
              >
                <option value="ALL">SEMUA WARUNG</option>
                {warungs.map((w: any, idx: number) => (
                  <option key={w.id || w.ID || idx} value={w.id || w.ID}>{w.nama || w.Nama}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="industrial-grid grid-cols-2 lg:grid-cols-4 border border-border">
          <div className="p-4 md:p-6 flex flex-col justify-between gap-2">
            <span className="font-mono text-xs lg:text-sm font-bold opacity-80 leading-tight">TOTAL TRANSAKSI HARI INI</span>
            <span className="text-3xl lg:text-4xl font-black break-words">{telemetry?.totalTrx || 0}</span>
          </div>
          <div className="p-4 md:p-6 flex flex-col justify-between gap-2">
            <span className="font-mono text-xs lg:text-sm font-bold opacity-80 leading-tight">UANG MASUK</span>
            <span className="text-3xl lg:text-4xl font-black tracking-tighter text-primary break-words">
              <span className="text-lg lg:text-xl mr-1">Rp</span>
              {telemetry?.uangMasuk ? Number(telemetry.uangMasuk).toLocaleString('id-ID') : 0}
            </span>
          </div>
          <div className="p-4 md:p-6 flex flex-col justify-between gap-2">
            <span className="font-mono text-xs lg:text-sm font-bold opacity-80 leading-tight">UANG KELUAR</span>
            <span className="text-3xl lg:text-4xl font-black tracking-tighter text-destructive break-words">
              <span className="text-lg lg:text-xl mr-1">Rp</span>
              {telemetry?.uangKeluar ? Number(telemetry.uangKeluar).toLocaleString('id-ID') : 0}
            </span>
          </div>
          <div className="p-4 md:p-6 flex flex-col justify-between gap-2 bg-foreground text-background">
            <span className="font-mono text-xs lg:text-sm font-bold opacity-90 leading-tight">KEUNTUNGAN BERSIH</span>
            <span className="text-3xl lg:text-4xl font-black tracking-tighter break-words">
              <span className="text-lg lg:text-xl mr-1">Rp</span>
              {telemetry?.keuntunganBersih ? Number(telemetry.keuntunganBersih).toLocaleString('id-ID') : 0}
            </span>
          </div>
        </div>

        {/* TRANSAKSI & STOK GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          
          {/* TRANSAKSI TERAKHIR */}
          <div className="md:col-span-2 border-2 border-border p-4 bg-card">
            <h3 className="font-bold uppercase tracking-widest text-sm mb-4 pb-2 border-b-2 border-border flex justify-between items-center">
              <span>Transaksi Terakhir</span>
              <Link href="/laporan" className="text-primary hover:underline text-xs">Lihat Semua</Link>
            </h3>
            {telemetry?.transaksiTerakhir?.length > 0 ? (
              <div className="flex flex-col gap-2">
                {telemetry.transaksiTerakhir.map((trx: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-3 border border-border hover:bg-accent transition-colors">
                    <div>
                      <div className="font-bold font-mono">{trx.trxid}</div>
                      <div className="text-xs text-muted-foreground uppercase">{formatDateTimeID(trx.waktu)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">Rp {Number(trx.totalharga).toLocaleString('id-ID')}</div>
                      <div className="text-xs font-mono bg-primary text-primary-foreground px-2 py-0.5 uppercase inline-block">Selesai</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground uppercase text-sm font-mono border border-dashed border-border">
                Belum ada transaksi
              </div>
            )}
          </div>

          {/* BARANG PALING LARIS & STOK HABIS */}
          <div className="flex flex-col gap-4">
            <div className="border-2 border-border p-4 bg-primary text-primary-foreground flex flex-col items-center justify-center py-8">
              <span className="font-mono text-sm font-bold opacity-90 mb-2 uppercase">Stok Barang Habis</span>
              <span className="text-6xl font-black">{telemetry?.stokHabis || 0}</span>
              <Link href="/produk" className="text-xs underline mt-2 hover:opacity-80 uppercase">Periksa Gudang</Link>
            </div>

            <div className="border-2 border-border p-4 bg-card flex-1">
              <h3 className="font-bold uppercase tracking-widest text-sm mb-4 pb-2 border-b-2 border-border">
                Barang Paling Laris
              </h3>
              {telemetry?.barangLaris?.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {telemetry.barangLaris.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="font-bold text-sm uppercase truncate max-w-[150px]">{item.nama}</span>
                      <span className="font-mono text-xs bg-foreground text-background px-2 py-1">{item.qty} Terjual</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground uppercase text-xs font-mono border border-dashed border-border">
                  Belum ada data
                </div>
              )}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
