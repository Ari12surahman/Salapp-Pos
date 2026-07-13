"use client";

import React, { useState } from "react";
import { Wallet, CreditCard, Loader2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/axios";
import { useQuery } from '@tanstack/react-query';
import { CameraScanner } from "@/components/ui/CameraScanner";
import { useAudio } from "@/hooks/useAudio";
import { toast } from "sonner";

export default function CekSaldoPage() {
  const { playDing, playError } = useAudio();
  const [cekSaldoInput, setCekSaldoInput] = useState("");
  const [cekSaldoData, setCekSaldoData] = useState<{ status: 'idle' | 'success' | 'error', nama?: string, saldo?: number, message?: string }>({ status: 'idle' });
  const [scannerOpen, setScannerOpen] = useState(false);

  const { data: santriMasterData, isLoading: santriLoading } = useQuery({
    queryKey: ['santriMaster'],
    queryFn: () => api.get('getSantri', { params: { spreadsheetId: "1jrUrg3DVS0migGJdWuzaRj4WJ65hS_ZSPG7y7bwPHe0" } }).then(res => res.data),
  });

  const { data: tabunganMasterData, isLoading: tabunganLoading } = useQuery({
    queryKey: ['tabunganMaster'],
    queryFn: () => api.get('getTabungan').then(res => res.data),
  });

  const handleCekSaldo = (id: string) => {
    if (!id) return;
    try {
      if (santriMasterData) {
        const foundSantri = santriMasterData.find((s: any) => String(s.nis) === String(id) || String(s.uid) === String(id));
        if (foundSantri) {
          let saldo = 0;
          if (tabunganMasterData && Array.isArray(tabunganMasterData)) {
            const sNisClean = String(foundSantri.nis).replace(/^0+/, '');
            const foundTabunganRows = tabunganMasterData.filter((t: any) => 
              String(t.NIS || t.nis).replace(/^0+/, '') === sNisClean
            );
            saldo = foundTabunganRows.reduce((sum: number, t: any) => {
              const nom = Number(t.Nominal || t.nominal || t.Saldo || t.saldo || 0);
              const jenis = String(t.Jenis || t.jenis || 'Setor').toLowerCase();
              return jenis === 'tarik' ? sum - nom : sum + nom;
            }, 0);
          }
          setCekSaldoData({ status: 'success', nama: foundSantri.nama, saldo: saldo });
          playDing();
          setCekSaldoInput("");
        } else {
          setCekSaldoData({ status: 'error', message: 'Santri (RFID/NIS) tidak ditemukan' });
          playError();
          setCekSaldoInput("");
        }
      } else {
        toast.error("Data master santri belum siap.");
      }
    } catch (err) {
      setCekSaldoData({ status: 'error', message: 'Gagal mengecek saldo' });
      playError();
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-6 min-h-screen animate-in fade-in duration-300">
      <header className="flex flex-col gap-2 border-b-2 border-border pb-4">
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight flex items-center gap-4">
          <Wallet className="w-8 h-8 md:w-12 md:h-12" /> CEK SALDO
        </h1>
        <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
          INFORMASI SALDO TABUNGAN SANTRI
        </p>
      </header>

      <div className="border-2 border-border bg-card shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] flex flex-col items-center justify-center p-8 md:p-16 relative overflow-hidden">
        
        <div className="w-full max-w-md flex flex-col gap-8 relative z-10">
          <div className="text-center space-y-2">
            <h2 className="font-bold uppercase tracking-widest text-lg">SCAN KARTU RFID</h2>
            <p className="font-mono text-sm text-muted-foreground">Silakan tempelkan kartu pada scanner.</p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input 
                type="password"
                placeholder="Scan RFID..." 
                className="font-mono text-center uppercase text-xl h-14"
                value={cekSaldoInput}
                onChange={(e) => setCekSaldoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCekSaldo(cekSaldoInput);
                }}
                autoFocus
                disabled={santriLoading || tabunganLoading}
              />
            </div>
            <Button variant="outline" className="h-14 w-14 shrink-0 p-0" onClick={() => setScannerOpen(true)} disabled={santriLoading || tabunganLoading}>
              <Camera className="w-6 h-6" />
            </Button>
            <Button className="h-14 px-8 font-bold text-lg" onClick={() => handleCekSaldo(cekSaldoInput)} disabled={santriLoading || tabunganLoading}>
              {santriLoading || tabunganLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'CEK'}
            </Button>
          </div>

          <div className="mt-8 min-h-[200px] flex items-center justify-center w-full">
            {cekSaldoData.status === 'success' && (
              <div className="bg-green-600/10 border-4 border-green-600 p-8 flex flex-col items-center text-center animate-in zoom-in duration-300 w-full h-full justify-center">
                <span className="font-mono text-xs text-green-700 dark:text-green-400 uppercase tracking-widest mb-2">IDENTITAS SANTRI</span>
                <p className="text-3xl font-black uppercase text-green-800 dark:text-green-300 mb-6">{cekSaldoData.nama}</p>
                
                <span className="font-mono text-xs text-green-700 dark:text-green-400 uppercase tracking-widest mb-2 border-t-2 border-green-600/30 pt-6 w-full">SISA SALDO AKTIF</span>
                <p className="text-5xl font-mono font-black tracking-tighter text-green-600 dark:text-green-400">
                  Rp {(cekSaldoData.saldo || 0).toLocaleString('id-ID')}
                </p>
              </div>
            )}

            {cekSaldoData.status === 'error' && (
              <div className="bg-red-600/10 border-4 border-red-600 p-8 flex flex-col items-center text-center animate-in shake duration-300 w-full h-full justify-center">
                <X className="w-16 h-16 text-red-600 mb-4" />
                <p className="text-2xl font-black text-red-600 uppercase tracking-tighter">{cekSaldoData.message}</p>
              </div>
            )}

            {cekSaldoData.status === 'idle' && (
              <div className="border-4 border-dashed border-muted p-8 flex flex-col items-center text-center w-full h-full justify-center opacity-50">
                <CreditCard className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                <p className="text-xl font-black text-muted-foreground uppercase tracking-tighter">MENUNGGU SCAN...</p>
              </div>
            )}
          </div>
        </div>

        {/* Decorative background */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 text-muted/10 transform rotate-12 pointer-events-none hidden md:block">
          <Wallet className="w-96 h-96" />
        </div>
      </div>

      {scannerOpen && (
        <CameraScanner 
          onClose={() => setScannerOpen(false)}
          onScan={(text) => {
            setScannerOpen(false);
            setCekSaldoInput(text);
            handleCekSaldo(text);
          }}
        />
      )}
    </div>
  );
}
