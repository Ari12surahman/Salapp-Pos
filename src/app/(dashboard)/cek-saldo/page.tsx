"use client";

import React, { useState } from "react";
import { Wallet, CreditCard, Loader2, Camera, X, Building2, ShieldCheck, Key, Check, History, Sparkles, Clock, AlertCircle, CheckCircle2, Layers, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/axios";
import { useQuery } from '@tanstack/react-query';
import { CameraScanner } from "@/components/ui/CameraScanner";
import { useAudio } from "@/hooks/useAudio";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getPeriodStartDateWIB } from "@/lib/api/supabaseServices";

export default function CekSaldoPage() {
  const { playDing, playError } = useAudio();
  const [cekSaldoInput, setCekSaldoInput] = useState("");
  const [checkingLive, setCheckingLive] = useState(false);
  const [activeMultiKasIdx, setActiveMultiKasIdx] = useState(0);
  const [cekSaldoData, setCekSaldoData] = useState<{
    status: 'idle' | 'success' | 'error';
    nama?: string;
    saldo?: number;
    message?: string;
    isKamar?: boolean;
    nis?: string;
    kelas?: string;
    pin?: string;
    limitJajan?: number;
    periode?: string;
    periodeLabel?: string;
    isCustomLimit?: boolean;
    terpakaiLimit?: number;
    sisaLimit?: number | null;
    persentaseLimit?: number;
    mutasi?: Array<{ tanggal: string; jenis: string; nominal: number; keterangan: string }>;
    multiKasList?: Array<{
      nama: string;
      nis: string;
      kelas?: string;
      saldo: number;
      pin?: string;
      isKamar: boolean;
      mutasi: Array<{ tanggal: string; jenis: string; nominal: number; keterangan: string }>;
    }>;
  }>({ status: 'idle' });

  const [unlockedKasNisList, setUnlockedKasNisList] = useState<string[]>([]);
  const [kasPinInput, setKasPinInput] = useState("");
  const [kasPinError, setKasPinError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const { data: santriMasterData, isLoading: santriLoading } = useQuery({
    queryKey: ['santriMaster'],
    queryFn: () => api.get('getSantri', { params: { spreadsheetId: "1jrUrg3DVS0migGJdWuzaRj4WJ65hS_ZSPG7y7bwPHe0" } }).then(res => res.data),
    staleTime: 1000 * 60 * 5, // 5 menit cache
    refetchOnWindowFocus: false,
  });

  const { data: tabunganMasterData, isLoading: tabunganLoading } = useQuery({
    queryKey: ['tabunganMaster'],
    queryFn: () => api.get('getTabungan').then(res => res.data),
    staleTime: 1000 * 60 * 2, // 2 menit cache
    refetchOnWindowFocus: false,
  });

  const { data: limitConfigData } = useQuery({
    queryKey: ['tabunganLimitConfig'],
    queryFn: async () => {
      const { data } = await supabase.from('MasterConfig').select('nilai').eq('kunci', 'tabunganLimitConfig').maybeSingle();
      if (data?.nilai) {
        return JSON.parse(data.nilai);
      }
      return null;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const handleUnlockKas = (overridePin?: string) => {
    const inputVal = (overridePin !== undefined ? overridePin : kasPinInput).trim();
    if (!inputVal) return;

    // Cek apakah cocok dengan akun kas aktif saat ini
    const currentExpected = cekSaldoData.pin || '123456';
    if (inputVal === currentExpected) {
      if (cekSaldoData.nis) {
        setUnlockedKasNisList(prev => [...prev.filter(n => n !== cekSaldoData.nis), cekSaldoData.nis!]);
      }
      setKasPinInput("");
      setKasPinError(null);
      playDing();
      toast.success(`Saldo kas ${cekSaldoData.nama} berhasil dibuka!`);
      return;
    }

    // Jika Multi-Kas, cek apakah PIN cocok dengan salah satu sub-kas di kartu ini
    if (cekSaldoData.multiKasList && cekSaldoData.multiKasList.length > 1) {
      const matchedIdx = cekSaldoData.multiKasList.findIndex(mk => (mk.pin || '123456') === inputVal);
      if (matchedIdx !== -1) {
        const matched = cekSaldoData.multiKasList[matchedIdx];
        setActiveMultiKasIdx(matchedIdx);
        setCekSaldoData(prev => ({
          ...prev,
          nama: matched.nama,
          nis: matched.nis,
          kelas: matched.kelas,
          saldo: matched.saldo,
          pin: matched.pin,
          mutasi: matched.mutasi
        }));
        setUnlockedKasNisList(prev => [...prev.filter(n => n !== matched.nis), matched.nis]);
        setKasPinInput("");
        setKasPinError(null);
        playDing();
        toast.success(`Saldo kas ${matched.nama} berhasil dibuka!`);
        return;
      }
    }

    setKasPinError("PIN Salah! Anda tidak memiliki izin untuk melihat saldo kas ini.");
    playError();
  };

  const handleCekSaldo = async (id: string) => {
    if (!id) return;
    setCheckingLive(true);
    setUnlockedKasNisList([]);
    setKasPinInput("");
    setKasPinError(null);
    try {
      let currentSantriList = santriMasterData;
      let currentTabunganList = tabunganMasterData;

      const cleanId = String(id).trim();
      const cleanNoZero = cleanId.replace(/^0+/, '').toLowerCase();

      const matchSantriList = (list: any[]) => {
        if (!Array.isArray(list)) return [];
        const exactMatches = list.filter((s: any) => {
          const nis = String(s.nis || '').trim();
          const uid = String(s.uid || '').trim();
          const rfid = String(s.rfid || '').trim();
          return nis === cleanId || nis.replace(/^0+/, '') === cleanNoZero ||
                 uid.toLowerCase() === cleanId.toLowerCase() || uid.replace(/^0+/, '').toLowerCase() === cleanNoZero ||
                 rfid.toLowerCase() === cleanId.toLowerCase() || rfid.replace(/^0+/, '').toLowerCase() === cleanNoZero;
        });
        if (exactMatches.length > 0) return exactMatches;
        if (cleanId.length >= 2) {
          const q = cleanId.toLowerCase();
          return list.filter((s: any) => 
            String(s.nama || '').toLowerCase().includes(q) ||
            String(s.nis || '').toLowerCase().includes(q)
          );
        }
        return [];
      };

      let foundMatches = matchSantriList(currentSantriList);

      // Jika belum ditemukan di cache atau ingin data mutasi paling mutakhir, fallback ke live query
      if (foundMatches.length === 0 || !currentTabunganList) {
        try {
          const [resS, resT] = await Promise.all([
            api.get('getSantri', { params: { spreadsheetId: "1jrUrg3DVS0migGJdWuzaRj4WJ65hS_ZSPG7y7bwPHe0" } }),
            api.get('getTabungan')
          ]);
          if (resS?.data) {
            currentSantriList = resS.data;
            foundMatches = matchSantriList(currentSantriList);
          }
          if (resT?.data) {
            currentTabunganList = resT.data;
          }
        } catch (fetchErr) {
          console.warn("Live fetch fallback error:", fetchErr);
        }
      }

      if (foundMatches.length > 0) {
        // Jika kartu menampung banyak akun kas / ekskul (Multi-Kas)
        if (foundMatches.length > 1) {
          const enrichedMulti = foundMatches.map((acc: any) => {
            const sNisClean = String(acc.nis).replace(/^0+/, '');
            let fRows: any[] = [];
            if (currentTabunganList && Array.isArray(currentTabunganList)) {
              fRows = currentTabunganList.filter((t: any) => 
                String(t.NIS || t.nis).replace(/^0+/, '') === sNisClean
              );
            }
            const accSaldo = fRows.reduce((sum: number, t: any) => {
              const nom = Number(t.Nominal || t.nominal || t.Saldo || t.saldo || 0);
              const jenis = String(t.Jenis || t.jenis || 'Setor').toLowerCase();
              return (jenis === 'tarik' || jenis === 'keluar' || jenis === 'debet') ? sum - nom : sum + nom;
            }, 0);

            const sortedRows = [...fRows].reverse();
            const mRecent = sortedRows.slice(0, 3).map((t: any) => ({
              tanggal: t.tanggal || t.Tanggal || '-',
              jenis: t.jenis || t.Jenis || 'Setor',
              nominal: Number(t.nominal || t.Nominal || 0),
              keterangan: t.keterangan || t.Keterangan || ''
            }));

            const isK = String(acc.nis || '').startsWith('KAS-') || 
                        (acc.nama || '').toLowerCase().startsWith('kas ') || 
                        String(acc.kelas || '').toLowerCase() === 'asrama' ||
                        String(acc.kelas || '').toLowerCase() === 'ekskul';

            return {
              nama: acc.nama,
              nis: acc.nis,
              kelas: acc.kelas,
              saldo: accSaldo,
              pin: acc.pin ? String(acc.pin) : '',
              isKamar: isK,
              mutasi: mRecent
            };
          });

          setActiveMultiKasIdx(0);
          const activeOne = enrichedMulti[0];
          setCekSaldoData({
            status: 'success',
            nama: activeOne.nama,
            saldo: activeOne.saldo,
            isKamar: true,
            nis: activeOne.nis,
            kelas: activeOne.kelas,
            pin: activeOne.pin,
            mutasi: activeOne.mutasi,
            multiKasList: enrichedMulti
          });
          setKasPinInput("");
          setKasPinError(null);
          playDing();
          setCekSaldoInput("");
          return;
        }

        const foundSantri = foundMatches[0];
        const isKamar = String(foundSantri.nis || '').startsWith('KAS-') || 
                        (foundSantri.nama || '').toLowerCase().startsWith('kas ') || 
                        String(foundSantri.kelas || '').toLowerCase() === 'asrama' ||
                        String(foundSantri.kelas || '').toLowerCase() === 'ekskul';

        let saldo = 0;
        let recentMutasi: Array<{ tanggal: string; jenis: string; nominal: number; keterangan: string }> = [];
        let limitJajan = 0;
        let periode = 'mingguan';
        let periodeLabel = 'Minggu Ini (Reset tiap Senin)';
        let isCustomLimit = false;
        let terpakaiLimit = 0;
        let sisaLimit: number | null = null;
        let persentaseLimit = 0;

        let foundTabunganRows: any[] = [];
        if (currentTabunganList && Array.isArray(currentTabunganList)) {
          const sNisClean = String(foundSantri.nis).replace(/^0+/, '');
          foundTabunganRows = currentTabunganList.filter((t: any) => 
            String(t.NIS || t.nis).replace(/^0+/, '') === sNisClean
          );
          saldo = foundTabunganRows.reduce((sum: number, t: any) => {
            const nom = Number(t.Nominal || t.nominal || t.Saldo || t.saldo || 0);
            const jenis = String(t.Jenis || t.jenis || 'Setor').toLowerCase();
            return (jenis === 'tarik' || jenis === 'keluar' || jenis === 'debet') ? sum - nom : sum + nom;
          }, 0);

          const sortedRows = [...foundTabunganRows].reverse();
          recentMutasi = sortedRows.slice(0, 3).map((t: any) => ({
            tanggal: t.tanggal || t.Tanggal || '-',
            jenis: t.jenis || t.Jenis || 'Setor',
            nominal: Number(t.nominal || t.Nominal || 0),
            keterangan: t.keterangan || t.Keterangan || ''
          }));
        }

        // Hitung limit jajan untuk santri (bukan kas kamar)
        if (!isKamar) {
          let liveConfig = limitConfigData;
          if (!liveConfig) {
            try {
              const { data: cfgRow } = await supabase.from('MasterConfig').select('nilai').eq('kunci', 'tabunganLimitConfig').maybeSingle();
              if (cfgRow?.nilai) liveConfig = JSON.parse(cfgRow.nilai);
            } catch (e) {}
          }

          const sNis = String(foundSantri.nis || '').trim();
          const sNisClean = sNis.replace(/^0+/, '');
          const override = liveConfig?.santriLimits?.[sNis] || liveConfig?.santriLimits?.[sNisClean];

          if (override && override.limit !== undefined) {
            limitJajan = Number(override.limit);
            periode = override.periode || 'mingguan';
            isCustomLimit = true;
          } else if (liveConfig?.defaultLimit !== undefined && Number(liveConfig.defaultLimit) > 0) {
            limitJajan = Number(liveConfig.defaultLimit);
            periode = liveConfig.defaultPeriode || 'mingguan';
            isCustomLimit = false;
          } else if (foundSantri.limit_jajan_harian && Number(foundSantri.limit_jajan_harian) > 0) {
            limitJajan = Number(foundSantri.limit_jajan_harian);
            periode = foundSantri.limit_periode || liveConfig?.defaultPeriode || 'harian';
            isCustomLimit = true;
          }

          const startDateStr = getPeriodStartDateWIB(periode);
          periodeLabel = periode === 'mingguan' 
            ? 'Minggu Ini (Reset tiap Senin)' 
            : periode === 'bulanan' 
              ? 'Bulan Ini' 
              : 'Hari Ini';

          // Hitung pemakaian jajan dalam periode berjalan (hanya transaksi jajan/kantin/pos)
          if (limitJajan > 0 && foundTabunganRows.length > 0) {
            terpakaiLimit = foundTabunganRows.reduce((sum: number, t: any) => {
              const nom = Number(t.nominal || t.Nominal || t.Saldo || t.saldo || 0);
              const jenis = String(t.jenis || t.Jenis || 'Setor').toLowerCase().trim();
              const rawDate = t.tanggal || t.Tanggal || t.created_at || '';
              const tgl = String(rawDate).split('T')[0];
              const ket = String(t.keterangan || t.Keterangan || '').toLowerCase();

              const isWithdraw = jenis === 'tarik' || jenis === 'keluar' || jenis.includes('tarik') || jenis.includes('keluar') || jenis === 'debet' || jenis === 'debit';
              const isJajan = ket.includes('kantin') || ket.includes('pos') || ket.includes('jajan') || ket.includes('belanja') || ket.includes('kasir') || ket.includes('trx-');

              if (isWithdraw && isJajan && tgl >= startDateStr) {
                return sum + nom;
              }
              return sum;
            }, 0);

            sisaLimit = Math.max(0, limitJajan - terpakaiLimit);
            persentaseLimit = Math.min(100, Math.round((terpakaiLimit / limitJajan) * 100));
          } else if (limitJajan > 0) {
            sisaLimit = limitJajan;
            persentaseLimit = 0;
          }
        }

        setCekSaldoData({
          status: 'success',
          nama: foundSantri.nama,
          saldo: saldo,
          isKamar: isKamar,
          nis: foundSantri.nis,
          kelas: foundSantri.kelas,
          pin: foundSantri.pin ? String(foundSantri.pin) : '',
          limitJajan,
          periode,
          periodeLabel,
          isCustomLimit,
          terpakaiLimit,
          sisaLimit,
          persentaseLimit,
          mutasi: recentMutasi,
          multiKasList: undefined
        });
        setKasPinInput("");
        setKasPinError(null);
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
                  {/* Selector Tab jika Kartu Multi-Kas */}
                  {cekSaldoData.multiKasList && cekSaldoData.multiKasList.length > 1 && (
                    <div className="w-full mb-4 pb-4 border-b-2 border-indigo-600/30">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-700 text-white font-mono text-xs font-bold uppercase tracking-wider mb-2">
                        <Layers className="w-4 h-4" /> KARTU MULTI-KAS ({cekSaldoData.multiKasList.length} DOMPET KAS/EKSKUL)
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Pilih ekskul di bawah, lalu masukkan PIN akun tersebut untuk melihat saldo:
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {cekSaldoData.multiKasList.map((item, idx) => {
                          const isSelected = activeMultiKasIdx === idx;
                          const isItemUnlocked = unlockedKasNisList.includes(item.nis);
                          return (
                            <button
                              key={item.nis}
                              type="button"
                              onClick={() => {
                                setActiveMultiKasIdx(idx);
                                setCekSaldoData(prev => ({
                                  ...prev,
                                  nama: item.nama,
                                  nis: item.nis,
                                  kelas: item.kelas,
                                  saldo: item.saldo,
                                  pin: item.pin,
                                  mutasi: item.mutasi
                                }));
                                setKasPinInput("");
                                setKasPinError(null);
                              }}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 ${
                                isSelected 
                                  ? 'bg-indigo-600 text-white shadow-md scale-105 ring-2 ring-indigo-500/40' 
                                  : 'bg-white/80 dark:bg-black/30 hover:bg-white text-indigo-950 dark:text-indigo-200 border border-indigo-200'
                              }`}
                            >
                              {isItemUnlocked ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 opacity-60" />}
                              <span>{item.nama}</span>
                              {isItemUnlocked ? (
                                <span className="font-mono text-[10px] text-emerald-300 font-bold">(Rp {item.saldo.toLocaleString('id-ID')})</span>
                              ) : (
                                <span className="opacity-60 font-normal text-[10px]">(Terkunci)</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-600 text-white font-mono text-xs font-bold uppercase tracking-wider mb-3 shadow-sm">
                    <Building2 className="w-4 h-4" /> {cekSaldoData.multiKasList && cekSaldoData.multiKasList.length > 1 ? 'KARTU MULTI-KAS AKTIF' : 'KARTU KAS BERSAMA / EKSKUL'}
                  </div>
                  <p className="text-2xl md:text-3xl font-black uppercase text-indigo-950 dark:text-indigo-200 mb-1">
                    {cekSaldoData.nama}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">
                    NO. REK: {cekSaldoData.nis} • ASRAMA: {cekSaldoData.kelas || 'Asrama'}
                  </p>

                  {(() => {
                    const isCurrentKasUnlocked = cekSaldoData.nis ? unlockedKasNisList.includes(cekSaldoData.nis) : false;
                    if (!isCurrentKasUnlocked) {
                      return (
                        <div className="w-full max-w-sm my-4 p-5 bg-card/90 border-2 border-indigo-300 dark:border-indigo-800 rounded-2xl shadow-sm text-center">
                          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 mb-2 shadow-xs">
                            <Lock className="w-6 h-6" />
                          </div>
                          <h4 className="font-bold text-foreground text-sm mb-1">
                            Saldo Kas Terproteksi PIN
                          </h4>
                          <p className="text-[11px] text-muted-foreground mb-3">
                            Masukkan PIN 6 Digit untuk melihat saldo kas <strong>{cekSaldoData.nama}</strong>:
                          </p>
                          <form onSubmit={(e) => { e.preventDefault(); handleUnlockKas(); }} className="space-y-3">
                            <Input
                              type="password"
                              inputMode="numeric"
                              maxLength={6}
                              autoFocus
                              placeholder="••••••"
                              value={kasPinInput}
                              onChange={(e) => {
                                setKasPinInput(e.target.value.replace(/\D/g, ''));
                                setKasPinError(null);
                              }}
                              className="font-mono text-center tracking-[0.4em] text-lg h-11 bg-background border-indigo-200 dark:border-indigo-800 font-bold"
                            />
                            {kasPinError && (
                              <p className="text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5 animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {kasPinError}
                              </p>
                            )}
                            <Button
                              type="submit"
                              disabled={kasPinInput.length < 4}
                              className="w-full h-10 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                            >
                              <Key className="w-4 h-4 mr-1.5" /> Buka Saldo Kas
                            </Button>
                          </form>
                        </div>
                      );
                    }

                    return (
                      <div className="w-full animate-in fade-in duration-200">
                        <div className="w-full border-t-2 border-indigo-600/30 pt-4">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="font-mono text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-widest font-bold">
                              SISA SALDO KAS
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Terverifikasi PIN
                            </span>
                          </div>
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

                        <div className="mt-4 flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setUnlockedKasNisList(prev => prev.filter(n => n !== cekSaldoData.nis));
                              setKasPinInput("");
                              setKasPinError(null);
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-mono font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 transition-all flex items-center gap-1.5"
                          >
                            <Lock className="w-3 h-3" /> Kunci Kembali
                          </button>
                        </div>
                      </div>
                    );
                  })()}
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

                  {/* Informasi Limit Jajan Santri */}
                  <div className="w-full mt-4 pt-4 border-t-2 border-green-600/20 text-left">
                    {cekSaldoData.limitJajan === 0 ? (
                      <div className="p-3.5 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <p className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                              BEBAS LIMIT JAJAN
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              Santri tidak dibatasi kuota jajan berkala (dapat berbelanja sesuai saldo aktif).
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                          UNLIMITED
                        </span>
                      </div>
                    ) : (
                      <div className={`p-4 rounded-xl border-2 font-mono transition-all shadow-xs ${
                        (cekSaldoData.sisaLimit !== null && cekSaldoData.sisaLimit !== undefined && cekSaldoData.sisaLimit <= 0)
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-950 dark:text-rose-200'
                          : (cekSaldoData.persentaseLimit || 0) >= 75
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-950 dark:text-amber-200'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                      }`}>
                        {/* Header Limit */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/40">
                          <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider">
                            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>STATUS LIMIT: {cekSaldoData.periodeLabel}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {cekSaldoData.isCustomLimit && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                KHUSUS
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border border-emerald-600/25">
                              Rp {(cekSaldoData.limitJajan || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>

                        {/* Grid 3 Statistik Kuota */}
                        <div className="grid grid-cols-3 gap-2 py-3 text-center">
                          <div className="p-2 rounded-lg bg-white/80 dark:bg-black/30 border border-border/40 shadow-xs">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5 font-semibold">
                              Batas Limit
                            </span>
                            <span className="text-xs md:text-sm font-black text-foreground">
                              Rp {(cekSaldoData.limitJajan || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white/80 dark:bg-black/30 border border-border/40 shadow-xs">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5 font-semibold">
                              Terpakai
                            </span>
                            <span className="text-xs md:text-sm font-black text-rose-600 dark:text-rose-400">
                              Rp {(cekSaldoData.terpakaiLimit || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white/80 dark:bg-black/30 border border-border/40 shadow-xs">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5 font-bold">
                              Sisa Limit
                            </span>
                            <span className={`text-xs md:text-sm font-black ${
                              (cekSaldoData.sisaLimit !== null && cekSaldoData.sisaLimit !== undefined && cekSaldoData.sisaLimit <= 0)
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {(cekSaldoData.sisaLimit !== null && cekSaldoData.sisaLimit !== undefined && cekSaldoData.sisaLimit <= 0)
                                ? 'HABIS (Rp 0)'
                                : `Rp ${(cekSaldoData.sisaLimit || 0).toLocaleString('id-ID')}`
                              }
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Pemakaian */}
                        <div className="space-y-1 mt-1">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                            <span>Pemakaian Kuota</span>
                            <span className="font-bold">{cekSaldoData.persentaseLimit || 0}% Terpakai</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                (cekSaldoData.persentaseLimit || 0) >= 100
                                  ? 'bg-rose-500'
                                  : (cekSaldoData.persentaseLimit || 0) >= 75
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, cekSaldoData.persentaseLimit || 0)}%` }}
                            />
                          </div>
                        </div>

                        {/* Banner Panduan Transaksi POS */}
                        <div className="mt-3 pt-2.5 border-t border-border/30">
                          {(cekSaldoData.sisaLimit !== null && cekSaldoData.sisaLimit !== undefined && cekSaldoData.sisaLimit <= 0) ? (
                            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 leading-tight">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Limit jajan minggu ini telah habis. Jajan di kasir POS baru dapat dilakukan kembali setelah reset otomatis hari Senin.
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 leading-tight">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Santri dapat berbelanja di kasir POS maksimal <strong className="text-foreground">Rp {(cekSaldoData.sisaLimit || 0).toLocaleString('id-ID')}</strong> sampai reset periode berikutnya.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
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
