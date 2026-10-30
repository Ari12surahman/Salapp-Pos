"use client";

import React, { useState } from "react";
import { Wallet, CreditCard, Loader2, Camera, X, Building2, ShieldCheck, Key, Check, History } from "lucide-react";
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
  const [checkingLive, setCheckingLive] = useState(false);
  const [cekSaldoData, setCekSaldoData] = useState<{
    status: 'idle' | 'success' | 'error';
    nama?: string;
    saldo?: number;
    message?: string;
    isKamar?: boolean;
    nis?: string;
    kelas?: string;
    pin?: string;
    mutasi?: Array<{ tanggal: string; jenis: string; nominal: number; keterangan: string }>;
  }>({ status: 'idle' });

  const [testPinInput, setTestPinInput] = useState("");
  const [testPinResult, setTestPinResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showPinTest, setShowPinTest] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const { data: santriMasterData, isLoading: santriLoading } = useQuery({
    queryKey: ['santriMaster'],
    queryFn: () => api.get('getSantri', { params: { spreadsheetId: "1jrUrg3DVS0migGJdWuzaRj4WJ65hS_ZSPG7y7bwPHe0" } }).then(res => res.data),
    staleTime: 0,
    refetchInterval: 5000,
  });

  const { data: tabunganMasterData, isLoading: tabunganLoading } = useQuery({
    queryKey: ['tabunganMaster'],
    queryFn: () => api.get('getTabungan').then(res => res.data),
    staleTime: 0,
    refetchInterval: 5000,
  });

  const handleCekSaldo = async (id: string) => {
    if (!id) return;
    setCheckingLive(true);
    try {
      let currentSantriList = santriMasterData;
      let currentTabunganList = tabunganMasterData;

      const cleanId = String(id).trim();
      const cleanNoZero = cleanId.replace(/^0+/, '').toLowerCase();

      const matchSantri = (list: any[]) => {
        if (!Array.isArray(list)) return null;
        return list.find((s: any) => {
          const nis = String(s.nis || '').trim();
          const uid = String(s.uid || '').trim();
          const rfid = String(s.rfid || '').trim();
          return nis === cleanId || nis.replace(/^0+/, '') === cleanNoZero ||
                 uid.toLowerCase() === cleanId.toLowerCase() || uid.replace(/^0+/, '').toLowerCase() === cleanNoZero ||
                 rfid.toLowerCase() === cleanId.toLowerCase() || rfid.replace(/^0+/, '').toLowerCase() === cleanNoZero;
        });
      };

      let foundSantri = matchSantri(currentSantriList);

      // Jika belum ditemukan di cache atau ingin data mutasi paling mutakhir, fallback ke live query
      if (!foundSantri || !currentTabunganList) {
        try {
          const [resS, resT] = await Promise.all([
            api.get('getSantri', { params: { spreadsheetId: "1jrUrg3DVS0migGJdWuzaRj4WJ65hS_ZSPG7y7bwPHe0" } }),
            api.get('getTabungan')
          ]);
          if (resS?.data) {
            currentSantriList = resS.data;
            foundSantri = matchSantri(currentSantriList);
          }
          if (resT?.data) {
            currentTabunganList = resT.data;
          }
        } catch (fetchErr) {
          console.warn("Live fetch fallback error:", fetchErr);
        }
      }

      if (foundSantri) {
        const isKamar = String(foundSantri.nis || '').startsWith('KAS-') || 
                        (foundSantri.nama || '').toLowerCase().startsWith('kas ') || 
                        String(foundSantri.kelas || '').toLowerCase() === 'asrama';

        let saldo = 0;
        let recentMutasi: Array<{ tanggal: string; jenis: string; nominal: number; keterangan: string }> = [];

        if (currentTabunganList && Array.isArray(currentTabunganList)) {
          const sNisClean = String(foundSantri.nis).replace(/^0+/, '');
          const foundTabunganRows = currentTabunganList.filter((t: any) => 
            String(t.NIS || t.nis).replace(/^0+/, '') === sNisClean
          );
          saldo = foundTabunganRows.reduce((sum: number, t: any) => {
            const nom = Number(t.Nominal || t.nominal || t.Saldo || t.saldo || 0);
            const jenis = String(t.Jenis || t.jenis || 'Setor').toLowerCase();
            return (jenis === 'tarik' || jenis === 'keluar') ? sum - nom : sum + nom;
          }, 0);

          const sortedRows = [...foundTabunganRows].reverse();
          recentMutasi = sortedRows.slice(0, 3).map((t: any) => ({
            tanggal: t.tanggal || t.Tanggal || '-',
            jenis: t.jenis || t.Jenis || 'Setor',
            nominal: Number(t.nominal || t.Nominal || 0),
            keterangan: t.keterangan || t.Keterangan || ''
          }));
        }

        setCekSaldoData({
          status: 'success',
          nama: foundSantri.nama,
          saldo: saldo,
          isKamar: isKamar,
          nis: foundSantri.nis,
          kelas: foundSantri.kelas,
          pin: foundSantri.pin ? String(foundSantri.pin) : '',
          mutasi: recentMutasi
        });
        setTestPinInput("");
        setTestPinResult('idle');
        setShowPinTest(false);
        playDing();
        setCekSaldoInput("");
      } else {
        setCekSaldoData({ status: 'error', message: 'Kartu RFID tidak dikenali di sistem POS' });
        playError();
        setCekSaldoInput("");
      }
    } catch (err) {
      console.error("Error cek saldo:", err);
      setCekSaldoData({ status: 'error', message: 'Gagal mengecek saldo' });
      playError();
    } finally {
      setCheckingLive(false);
    }
  };

  const isBusy = santriLoading || tabunganLoading || checkingLive;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-6 min-h-screen animate-in fade-in duration-300">
      <header className="flex flex-col gap-2 border-b-2 border-border pb-4">
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight flex items-center gap-4">
          <Wallet className="w-8 h-8 md:w-12 md:h-12" /> CEK SALDO
        </h1>
        <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
          INFORMASI SALDO TABUNGAN SANTRI & DOMPET KAS ASRAMA
        </p>
      </header>

      <div className="border-2 border-border bg-card shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
        
        <div className="w-full max-w-md flex flex-col gap-6 relative z-10">
          <div className="text-center space-y-2">
            <h2 className="font-bold uppercase tracking-widest text-lg">SCAN KARTU RFID</h2>
            <p className="font-mono text-sm text-muted-foreground">Silakan tempelkan kartu santri / kamar pada scanner.</p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input 
                type="text"
                style={{ WebkitTextSecurity: 'disc' } as any}
                autoComplete="off"
                placeholder="Scan RFID..." 
                className="font-mono text-center uppercase text-xl h-14"
                value={cekSaldoInput}
                onChange={(e) => setCekSaldoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCekSaldo(cekSaldoInput);
                }}
                autoFocus
                disabled={isBusy}
              />
            </div>
            <Button variant="outline" className="h-14 w-14 shrink-0 p-0" onClick={() => setScannerOpen(true)} disabled={isBusy}>
              <Camera className="w-6 h-6" />
            </Button>
            <Button className="h-14 px-8 font-bold text-lg" onClick={() => handleCekSaldo(cekSaldoInput)} disabled={isBusy}>
              {isBusy ? <Loader2 className="w-6 h-6 animate-spin" /> : 'CEK'}
            </Button>
          </div>

          <div className="mt-4 min-h-[220px] flex items-center justify-center w-full">
            {cekSaldoData.status === 'success' && (
              cekSaldoData.isKamar ? (
                <div className="bg-indigo-600/10 border-4 border-indigo-600 p-6 md:p-8 flex flex-col items-center text-center animate-in zoom-in duration-300 w-full h-full justify-center rounded-2xl relative shadow-md">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-600 text-white font-mono text-xs font-bold uppercase tracking-wider mb-3 shadow-sm">
                    <Building2 className="w-4 h-4" /> KARTU KAS KAMAR / ASRAMA
                  </div>
                  <p className="text-2xl md:text-3xl font-black uppercase text-indigo-950 dark:text-indigo-200 mb-1">
                    {cekSaldoData.nama}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">
                    NO. REK: {cekSaldoData.nis} • ASRAMA: {cekSaldoData.kelas || 'Asrama'}
                  </p>

                  <div className="w-full border-t-2 border-indigo-600/30 pt-4">
                    <span className="font-mono text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-widest block mb-1 font-bold">
                      SISA SALDO KAS BERSAMA
                    </span>
                    <p className="text-4xl md:text-5xl font-mono font-black tracking-tighter text-indigo-600 dark:text-indigo-400">
                      Rp {(cekSaldoData.saldo || 0).toLocaleString('id-ID')}
                    </p>
                  </div>

                  {/* Riwayat Mutasi Terakhir */}
                  {cekSaldoData.mutasi && cekSaldoData.mutasi.length > 0 && (
                    <div className="w-full mt-4 pt-4 border-t-2 border-indigo-600/20 text-left">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 mb-2">
                        <History className="w-3.5 h-3.5" /> 3 Transaksi Terakhir:
                      </div>
                      <div className="space-y-1.5 font-mono text-xs">
                        {cekSaldoData.mutasi.map((m, idx) => {
                          const isTarik = String(m.jenis).toLowerCase() === 'tarik';
                          return (
                            <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-white/80 dark:bg-black/30 border border-indigo-200/60 shadow-xs">
                              <div className="truncate pr-2">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                                  {m.keterangan || (isTarik ? 'Belanja Kasir POS' : 'Setoran Kas')}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {m.tanggal} • <span className={isTarik ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{m.jenis}</span>
                                </div>
                              </div>
                              <div className={`font-bold text-xs shrink-0 ${isTarik ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {isTarik ? '-' : '+'} Rp {m.nominal.toLocaleString('id-ID')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 w-full flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 text-xs font-medium">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Dilindungi PIN 6 Digit untuk kasir POS</span>
                    </div>

                    {!showPinTest ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowPinTest(true)}
                        className="text-xs font-bold font-mono text-indigo-700 border-indigo-300 hover:bg-indigo-50 mt-1"
                      >
                        <Key className="w-3.5 h-3.5 mr-1" /> TES PIN KARTU
                      </Button>
                    ) : (
                      <div className="mt-2 p-3 bg-card border-2 border-indigo-200 rounded-xl w-full max-w-xs space-y-2 animate-in fade-in">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase">Verifikasi PIN Kamar:</span>
                        <div className="flex gap-2">
                          <Input 
                            type="password"
                            maxLength={6}
                            placeholder="6 Digit PIN..."
                            value={testPinInput}
                            onChange={(e) => setTestPinInput(e.target.value)}
                            className="font-mono text-center tracking-widest text-sm h-9"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => {
                              const expected = cekSaldoData.pin || '123456';
                              if (testPinInput === expected) {
                                setTestPinResult('correct');
                                playDing();
                              } else {
                                setTestPinResult('wrong');
                                playError();
                              }
                            }}
                            className="font-bold text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            CEK
                          </Button>
                        </div>
                        {testPinResult === 'correct' && (
                          <p className="text-xs font-bold text-green-600 flex items-center justify-center gap-1">
                            <Check className="w-3.5 h-3.5" /> PIN Benar! Kartu siap belanja di POS.
                          </p>
                        )}
                        {testPinResult === 'wrong' && (
                          <p className="text-xs font-bold text-red-600 flex items-center justify-center gap-1">
                            <X className="w-3.5 h-3.5" /> PIN Salah! Periksa atau hubungi Admin.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-green-600/10 border-4 border-green-600 p-6 md:p-8 flex flex-col items-center text-center animate-in zoom-in duration-300 w-full h-full justify-center rounded-2xl">
                  <span className="font-mono text-xs text-green-700 dark:text-green-400 uppercase tracking-widest mb-1 font-bold">IDENTITAS SANTRI</span>
                  <p className="text-2xl md:text-3xl font-black uppercase text-green-800 dark:text-green-300 mb-1">{cekSaldoData.nama}</p>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">
                    NIS: {cekSaldoData.nis} • KELAS: {cekSaldoData.kelas || '-'}
                  </p>
                  
                  <div className="w-full border-t-2 border-green-600/30 pt-4">
                    <span className="font-mono text-xs text-green-700 dark:text-green-400 uppercase tracking-widest mb-1 block font-bold">SISA SALDO AKTIF</span>
                    <p className="text-4xl md:text-5xl font-mono font-black tracking-tighter text-green-600 dark:text-green-400">
                      Rp {(cekSaldoData.saldo || 0).toLocaleString('id-ID')}
                    </p>
                  </div>

                  {/* Riwayat Mutasi Terakhir Santri */}
                  {cekSaldoData.mutasi && cekSaldoData.mutasi.length > 0 && (
                    <div className="w-full mt-4 pt-4 border-t-2 border-green-600/20 text-left">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-green-900 dark:text-green-300 mb-2">
                        <History className="w-3.5 h-3.5" /> 3 Transaksi Terakhir:
                      </div>
                      <div className="space-y-1.5 font-mono text-xs">
                        {cekSaldoData.mutasi.map((m, idx) => {
                          const isTarik = String(m.jenis).toLowerCase() === 'tarik';
                          return (
                            <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-white/80 dark:bg-black/30 border border-green-200/60 shadow-xs">
                              <div className="truncate pr-2">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                                  {m.keterangan || (isTarik ? 'Belanja POS' : 'Setoran')}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {m.tanggal} • <span className={isTarik ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{m.jenis}</span>
                                </div>
                              </div>
                              <div className={`font-bold text-xs shrink-0 ${isTarik ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {isTarik ? '-' : '+'} Rp {m.nominal.toLocaleString('id-ID')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {cekSaldoData.status === 'error' && (
              <div className="bg-red-600/10 border-4 border-red-600 p-8 flex flex-col items-center text-center animate-in shake duration-300 w-full h-full justify-center rounded-2xl">
                <X className="w-16 h-16 text-red-600 mb-4" />
                <p className="text-xl font-black text-red-600 uppercase tracking-tighter">{cekSaldoData.message}</p>
              </div>
            )}

            {cekSaldoData.status === 'idle' && (
              <div className="border-4 border-dashed border-muted p-8 flex flex-col items-center text-center w-full h-full justify-center opacity-50 rounded-2xl">
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
