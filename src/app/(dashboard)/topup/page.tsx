"use client";

import { useState } from "react";
import { toast } from 'sonner';
import { Wallet, Search, ArrowRight, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/axios";

export default function TopupPage() {
  const [rfid, setRfid] = useState("");
  const [amount, setAmount] = useState("");
  const [santriData, setSantriData] = useState<{nama: string, saldo: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const handleCheckSantri = async () => {
    if (!rfid) return;
    setLoading(true);
    try {
      const resSantri = await api.get('getSantri', { params: { spreadsheetId: "1jrUrg3DVS0migGJdWuzaRj4WJ65hS_ZSPG7y7bwPHe0" } });
      const resTabungan = await api.get('getTabungan');
      
      if (resSantri.data) {
        const foundSantri = resSantri.data.find((s: any) => s.nis === rfid || s.rfid === rfid);
        if (foundSantri) {
          let saldo = 0;
          if (resTabungan.data && Array.isArray(resTabungan.data)) {
            const sNisClean = String(foundSantri.nis).replace(/^0+/, '');
            const foundTabunganRows = resTabungan.data.filter((t: any) => 
              String(t.NIS || t.nis).replace(/^0+/, '') === sNisClean
            );
            saldo = foundTabunganRows.reduce((sum: number, t: any) => sum + Number(t.Nominal || t.nominal || t.Saldo || t.saldo || 0), 0);
          }
          setSantriData({ nama: foundSantri.nama, saldo: saldo });
        } else {
          toast.error("Santri tidak ditemukan!");
          setSantriData(null);
        }
      }
    } catch (err) {
      toast.error("Gagal mengecek data santri");
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async () => {
    if (!rfid || !amount) {
      toast.warning("Masukkan NIS/RFID dan nominal top up!");
      return;
    }
    setProcessing(true);
    try {
      const payload = {
        nis: rfid,
        amount: Number(amount)
      };
      const res = await api.post('topupSaldo', payload);
      
      if (res.status === "error" || (res.data && res.data.status === "error")) {
        throw new Error((res.data && res.data.message) || res.message || "Gagal melakukan topup");
      }

      toast.success("Topup Berhasil!");
      
      const newHistory = {
        id: `TOPUP-${new Date().getTime()}`,
        rfid: rfid,
        nama: santriData?.nama || rfid,
        amount: Number(amount),
        date: new Date().toLocaleString('id-ID')
      };
      
      setHistory([newHistory, ...history]);
      
      // Update saldo di layar jika ada
      if (res.data && res.data.newSaldo !== undefined && santriData) {
        setSantriData({ ...santriData, saldo: res.data.newSaldo });
      } else {
        setRfid("");
        setSantriData(null);
      }
      setAmount("");

    } catch (err: any) {
      toast.error("Gagal: " + (err.message || "Terjadi kesalahan server"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col md:flex-row gap-8">
      {/* FORM SECTION */}
      <div className="flex-1 flex flex-col gap-6">
        <header className="border-b-2 border-border pb-4">
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight flex items-center gap-4">
            <Wallet className="w-10 h-10" /> TOP UP SALDO
          </h1>
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">
            SANTRI WALLET MANAGEMENT
          </p>
        </header>

        <div className="border-2 border-border bg-card p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">SCAN RFID / BARCODE NIS_</label>
            <div className="flex gap-2">
              <Input 
                placeholder="TAP KARTU DISINI..." 
                className="font-mono uppercase h-12 text-lg"
                value={rfid}
                onChange={(e) => setRfid(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCheckSantri();
                  }
                }}
              />
              <Button onClick={handleCheckSantri} disabled={loading} variant="secondary" className="h-12 px-4 font-bold">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "CEK"}
              </Button>
            </div>
            {santriData && (
              <div className="p-3 bg-muted border border-border mt-2">
                <p className="font-bold uppercase">{santriData.nama}</p>
                <p className="font-mono text-sm text-muted-foreground">Saldo Saat Ini: <span className="text-primary font-bold">Rp {santriData.saldo.toLocaleString('id-ID')}</span></p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">NOMINAL TOP UP (RP)_</label>
            <Input 
              type="number"
              placeholder="0" 
              className="font-mono uppercase h-16 text-3xl font-black text-primary"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[20000, 50000, 100000].map(val => (
              <Button 
                key={val} 
                variant="outline" 
                className="h-12 font-mono"
                onClick={() => setAmount(val.toString())}
              >
                {val / 1000}K
              </Button>
            ))}
          </div>

          <Button 
            onClick={handleTopup} 
            disabled={processing || !rfid || !amount}
            className="h-14 text-lg w-full gap-2 mt-4"
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "PROSES TOP UP"} 
            {!processing && <ArrowRight className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* HISTORY SECTION */}
      <div className="w-full md:w-96 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b-2 border-border pb-2">
          <History className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-bold uppercase tracking-widest">RIWAYAT SESI INI</h2>
        </div>
        
        <div className="flex flex-col gap-2">
          {history.length === 0 ? (
            <p className="text-muted-foreground font-mono text-sm uppercase text-center p-8 border-2 border-dashed border-border">BELUM ADA TOPUP</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="border border-border bg-background p-4 flex flex-col gap-2 hover:bg-muted transition-colors">
                <div className="flex justify-between items-start">
                  <span className="font-bold uppercase text-sm">{item.nama}</span>
                  <span className="font-mono text-xs text-primary font-bold">+Rp {(item.amount).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase">
                  <span>{item.id}</span>
                  <span>{item.date}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
