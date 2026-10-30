"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useConfirmStore } from "@/store/confirmStore";
import { api } from "@/lib/api/axios";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Info, CheckCircle2, Clock, Loader2, Store, BadgePercent, Calculator, ShieldCheck, ArrowRight, Sparkles, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function PencairanPage() {
  const user = useAuthStore((state: any) => state.user);
  const queryClient = useQueryClient();

  // Fetch warung list for admin switching or name lookup
  const { data: warungData } = useQuery({
    queryKey: ['warungList'],
    queryFn: () => api.get('getWarung').then(res => res?.data ?? []),
    enabled: !!user,
  });
  const warungList = Array.isArray(warungData) ? warungData : [];

  const [selectedWarungId, setSelectedWarungId] = useState<string>("");
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.warungId === 'ALL';
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState<any>(null);
  const activeWarungId = (user?.warungId && user.warungId !== "ALL") 
    ? user.warungId 
    : (selectedWarungId || (warungList[0]?.id || ""));

  const activeWarung = warungList.find((w: any) => String(w.id || w.ID) === String(activeWarungId));
  const activeWarungName = activeWarung?.nama || activeWarung?.Nama || user?.name || "Warung";

  // Fetch eligible (unwithdrawn) non-cash transactions
  const { data: eligibleData, isLoading: isLoadingEligible } = useQuery({
    queryKey: ['pencairanEligible', activeWarungId],
    queryFn: () => api.post('getPencairanEligible', { warungId: activeWarungId || "ALL" }).then(res => res?.data ?? []),
    enabled: !!activeWarungId,
    refetchInterval: 10000,
  });

  // Fetch withdrawal history
  const { data: riwayatData, isLoading: isLoadingRiwayat } = useQuery({
    queryKey: ['riwayatPencairan', activeWarungId],
    queryFn: () => api.post('getRiwayatPencairan', { warungId: activeWarungId || "ALL" }).then(res => res?.data ?? []),
    enabled: !!activeWarungId,
    refetchInterval: 10000,
  });

  // Fetch MasterConfig for MOU Fee Deduction Status
  const { data: configData } = useQuery({
    queryKey: ['masterConfigPencairan'],
    queryFn: async () => {
      const { data } = await supabase.from('MasterConfig').select('*').in('kunci', ['pencairanFeeConfig', 'pencairanFeeHistory']);
      const res: any = {};
      (data || []).forEach((row: any) => {
        try {
          res[row.kunci] = typeof row.nilai === 'string' ? JSON.parse(row.nilai) : row.nilai;
        } catch (e) {
          res[row.kunci] = row.nilai;
        }
      });
      return res;
    },
    refetchInterval: 10000,
  });

  const ajukanMutation = useMutation({
    mutationFn: (payload: { warungId: string, trxIds: string[], totalDana: number }) => 
      api.post('ajukanPencairan', payload).then(res => {
        if (res.status === 'error') throw new Error(res.message);
        return res;
      }),
    onSuccess: () => {
      toast.success("Pengajuan pencairan berhasil dikirim ke Bendahara!");
      queryClient.invalidateQueries({ queryKey: ['pencairanEligible'] });
      queryClient.invalidateQueries({ queryKey: ['riwayatPencairan'] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Gagal mengajukan pencairan.");
    }
  });

  const eligibleList = Array.isArray(eligibleData) ? eligibleData : [];
  const riwayatList = Array.isArray(riwayatData) ? riwayatData : [];

  const totalDanaEligible = eligibleList.reduce((sum: number, item: any) => sum + (Number(item.totalharga || item.TotalHarga) || 0), 0);
  const trxIds = eligibleList.map((item: any) => item.trxid || item.TrxID).filter(Boolean);

  const feeConfig = configData?.pencairanFeeConfig || { biayaAplikasi: 30000, biayaKader: 200000, maxPotongPersen: 50 };
  const feeHistory = configData?.pencairanFeeHistory || {};
  
  const now = new Date();
  const currentPeriodeBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentPeriodeLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  
  // Calculate status for this warung (dukung pengaturan kader per warung)
  let terbayarAplikasi = 0;
  let terbayarKader = 0;
  const customWarung = feeConfig?.warungConfig?.[activeWarungId] || {};
  const targetAplikasi = customWarung?.biayaAplikasi !== undefined ? Number(customWarung.biayaAplikasi) : Number(feeConfig.biayaAplikasi ?? 30000);
  const targetKader = customWarung?.biayaKader !== undefined ? Number(customWarung.biayaKader) : Number(feeConfig.biayaKader ?? 200000);
  const targetTotal = targetAplikasi + targetKader;

  const handleOpenConfigModal = () => {
    setConfigForm(JSON.parse(JSON.stringify(feeConfig)));
    setIsConfigModalOpen(true);
  };

  const handleSaveConfigModal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabase.from('MasterConfig').upsert({
        kunci: 'pencairanFeeConfig',
        nilai: JSON.stringify(configForm)
      }, { onConflict: 'kunci' });
      toast.success("Pengaturan MOU dan Biaya Kader berhasil disimpan!");
      queryClient.invalidateQueries({ queryKey: ['masterConfigPencairan'] });
      setIsConfigModalOpen(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan pengaturan: " + err.message);
    }
  };

  Object.values(feeHistory).forEach((h: any) => {
    if (h && String(h.warungId) === String(activeWarungId) && h.periodeBulan === currentPeriodeBulan) {
      terbayarAplikasi += Number(h.potonganAplikasi || 0);
      terbayarKader += Number(h.potonganKader || 0);
    }
  });

  const sisaAplikasi = Math.max(0, targetAplikasi - terbayarAplikasi);
  const sisaKader = Math.max(0, targetKader - terbayarKader);
  const totalSisa = sisaAplikasi + sisaKader;
  const isLunas = totalSisa === 0;

  // Realtime Upfront Deduction Calculation
  const maxPotongPersen = Number(feeConfig.maxPotongPersen ?? 50);
  const maxPotongan = Math.floor(totalDanaEligible * (maxPotongPersen / 100));

  const estPotongAplikasi = Math.min(sisaAplikasi, maxPotongan);
  const estPotongKader = Math.min(sisaKader, Math.max(0, maxPotongan - estPotongAplikasi));
  const estTotalPotongan = estPotongAplikasi + estPotongKader;
  const estDanaBersih = Math.max(0, totalDanaEligible - estTotalPotongan);
  const estSisaSetelahPencairan = Math.max(0, totalSisa - estTotalPotongan);

  const handleAjukan = async () => {
    if (trxIds.length === 0) return;

    const potongSummary = isLunas 
      ? "Rp 0 (MOU LUNAS)" 
      : (estTotalPotongan > 0 
          ? `-Rp ${estTotalPotongan.toLocaleString('id-ID')} (${estPotongAplikasi > 0 ? `Aplikasi Rp ${estPotongAplikasi.toLocaleString('id-ID')}` : ''}${estPotongKader > 0 ? `${estPotongAplikasi > 0 ? ', ' : ''}Kader Rp ${estPotongKader.toLocaleString('id-ID')}` : ''})`
          : "Rp 0");

    const message = [
      `Detail Rincian Pengajuan:`,
      `• Warung: ${activeWarungName}`,
      `• Pengajuan Kotor: Rp ${totalDanaEligible.toLocaleString('id-ID')}`,
      `• Estimasi Potongan MOU: ${potongSummary}`,
      `• Estimasi Bersih Diterima: Rp ${estDanaBersih.toLocaleString('id-ID')}`,
      ``,
      isLunas
        ? `Kewajiban MOU bulan ini telah lunas, dana akan dicairkan 100% utuh tanpa potongan.`
        : (estTotalPotongan > 0 
            ? `Dana bersih sekitar Rp ${estDanaBersih.toLocaleString('id-ID')} akan ditransfer ke rekening warung. Sisa tanggungan MOU bulan ini menjadi Rp ${estSisaSetelahPencairan.toLocaleString('id-ID')} (dilanjutkan pada pencairan berikutnya).`
            : `Dana pengajuan akan diproses oleh Bendahara.`),
      ``,
      `Lanjutkan proses pengajuan pencairan?`
    ].join('\n');

    const confirmed = await useConfirmStore.getState().showConfirm({
      title: "AJUKAN PENCAIRAN",
      message: message,
      confirmText: "YA, AJUKAN"
    });

    if (confirmed) {
      ajukanMutation.mutate({
        warungId: activeWarungId,
        trxIds: trxIds,
        totalDana: totalDanaEligible
      });
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Pencairan Dana</h1>
          <p className="text-muted-foreground font-mono mt-1">
            Cairkan penghasilan dari transaksi Tabungan & QRIS/VA secara berkala.
          </p>
        </div>

        {user?.warungId === "ALL" && warungList.length > 0 && (
          <div className="flex items-center gap-2 bg-card border-2 border-border p-2 rounded-xl">
            <span className="text-xs font-bold uppercase text-muted-foreground font-mono">Pilih Warung:</span>
            <select
              value={activeWarungId}
              onChange={(e) => setSelectedWarungId(e.target.value)}
              className="text-xs font-bold bg-background border rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              {warungList.map((w: any) => (
                <option key={w.id || w.ID} value={w.id || w.ID}>
                  {w.nama || w.Nama}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* BANNER STATUS KEWAJIBAN BULANAN (MOU) */}
      <div className="bg-card border-2 border-border p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-sm uppercase">
                Kewajiban Bulanan Warung ({currentPeriodeLabel})
              </h3>
              {isLunas ? (
                <span className="text-[11px] bg-green-100 text-green-700 font-bold px-2.5 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> LUNAS BULAN INI
                </span>
              ) : (
                <span className="text-[11px] bg-amber-100 text-amber-700 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                  Sisa Tanggungan: Rp {totalSisa.toLocaleString('id-ID')}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Sewa Aplikasi: Rp {terbayarAplikasi.toLocaleString('id-ID')} / {targetAplikasi.toLocaleString('id-ID')} • Honor Kader: Rp {terbayarKader.toLocaleString('id-ID')} / {targetKader.toLocaleString('id-ID')} {customWarung?.biayaKader !== undefined ? '(Khusus Warung)' : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {isAdmin && (
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={handleOpenConfigModal}
              className="gap-1.5 font-mono text-xs border-2 shadow-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Atur Biaya Kader / MOU
            </Button>
          )}
          <div className="text-xs text-muted-foreground bg-muted/60 border border-border/80 px-3 py-2 rounded-xl font-mono max-w-sm">
            💡 Pemotongan tagihan bertahap (maks. 50% per pencairan) agar modal harian warung terjaga.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PANEL DANA TERSEDIA & SIMULASI PENCAIRAN UPFRONT */}
        <div className="bg-card border-4 border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-6 rounded-2xl flex flex-col justify-between">
          <div>
            {/* Header Dana Kotor */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Penjualan Non-Tunai</p>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-primary">
                    Rp {totalDanaEligible.toLocaleString('id-ID')}
                  </h2>
                </div>
              </div>
              <span className="text-xs font-mono bg-muted px-2.5 py-1 rounded-lg border font-semibold">
                {trxIds.length} Transaksi
              </span>
            </div>

            {/* KOTAK ESTIMASI RINCIAN PENCAIRAN */}
            <div className="bg-muted/40 border-2 border-border/90 rounded-xl p-4 my-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide text-foreground">
                  <Calculator className="w-4 h-4 text-primary" />
                  <span>Estimasi Rincian Pencairan</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Periode: {currentPeriodeLabel}
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Nominal Pengajuan (Kotor)</span>
                  <span className="font-bold text-foreground">Rp {totalDanaEligible.toLocaleString('id-ID')}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    Potongan Tagihan MOU
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                      Maks {maxPotongPersen}%
                    </span>
                  </span>
                  {isLunas ? (
                    <span className="font-bold text-emerald-600">Rp 0 (LUNAS)</span>
                  ) : estTotalPotongan > 0 ? (
                    <span className="font-bold text-amber-600">-Rp {estTotalPotongan.toLocaleString('id-ID')}</span>
                  ) : (
                    <span className="text-muted-foreground">Rp 0</span>
                  )}
                </div>

                {!isLunas && estTotalPotongan > 0 && (
                  <div className="pl-3 py-1.5 text-[11px] text-muted-foreground border-l-2 border-amber-300 space-y-1 bg-amber-50/50 dark:bg-amber-950/20 rounded-r-lg">
                    {estPotongAplikasi > 0 && (
                      <div className="flex justify-between">
                        <span>• Sewa Aplikasi:</span>
                        <span>-Rp {estPotongAplikasi.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {estPotongKader > 0 && (
                      <div className="flex justify-between">
                        <span>• Honor Kader:</span>
                        <span>-Rp {estPotongKader.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-amber-800 dark:text-amber-300 font-bold pt-1 border-t border-amber-200/60">
                      <span>• Sisa Tanggungan Nanti:</span>
                      <span>Rp {estSisaSetelahPencairan.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ESTIMASI DANA BERSIH */}
              <div className="pt-3 border-t-2 border-dashed border-border/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-foreground">
                    Estimasi Dana Bersih
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Dana riil yang ditransfer ke rekening
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    Rp {estDanaBersih.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>

            {/* INFO PROTEKSI MODAL */}
            <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 border border-blue-200/80 rounded-xl p-3.5 text-xs flex gap-2.5 items-start mb-5">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[11px] uppercase tracking-wide">Proteksi Modal Usaha Warung</p>
                <p className="text-blue-800 dark:text-blue-300 text-[11px] leading-relaxed mt-0.5">
                  Potongan MOU dibatasi maksimal {maxPotongPersen}% dari setiap pencairan agar uang operasional warung tidak habis. Sisa tagihan dapat dicicil di pencairan berikutnya.
                </p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleAjukan}
            disabled={trxIds.length === 0 || ajukanMutation.isPending}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${trxIds.length > 0 ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-1 shadow-lg' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
          >
            {ajukanMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> MENGAJUKAN KE BENDAHARA...
              </span>
            ) : trxIds.length > 0 ? (
              <span className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
                <span>AJUKAN PENCAIRAN</span>
                <span className="text-xs opacity-90 font-mono">(BERSIH: RP {estDanaBersih.toLocaleString('id-ID')})</span>
              </span>
            ) : (
              "BELUM ADA DANA UNTUK DICAIRKAN"
            )}
          </button>
        </div>

        {/* PANEL RIWAYAT PENCAIRAN */}
        <div className="bg-card border-2 border-border rounded-2xl p-6 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-xl uppercase tracking-tight">Riwayat Pencairan</h3>
            <span className="text-xs font-mono text-muted-foreground">{riwayatList.length} Catatan</span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[500px]">
            {isLoadingRiwayat ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : riwayatList.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground font-mono text-sm border-2 border-dashed border-border rounded-xl">
                Belum ada riwayat pencairan.
              </div>
            ) : (
              riwayatList.map((item: any, idx: number) => {
                const totaldana = Number(item.totaldana || item.TotalDana || 0);
                const status = item.status || item.Status;
                const idpencairan = item.idpencairan || item.IDPencairan;
                const waktupengajuan = item.waktupengajuan || item.WaktuPengajuan;
                const waktuselesai = item.waktuselesai || item.WaktuSelesai;
                const hist = feeHistory[idpencairan];
                
                return (
                  <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border rounded-xl hover:bg-muted/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {hist ? (
                          <div className="flex flex-col">
                            <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                              Rp {Number(hist.totalBersih || 0).toLocaleString('id-ID')}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              Kotor: Rp {totaldana.toLocaleString('id-ID')} • Potong MOU: -Rp {Number(hist.totalPotongan || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-bold text-lg">Rp {totaldana.toLocaleString('id-ID')}</span>
                            {status === 'Menunggu' && (
                              <span className="text-[11px] text-amber-600 font-mono">
                                Menunggu verifikasi & transfer Bendahara
                              </span>
                            )}
                          </div>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${status === 'Selesai' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'}`}>
                          {status === 'Selesai' ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <Clock className="w-3 h-3 inline mr-1" />}
                          {status}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        ID: {idpencairan} • {new Date(waktupengajuan).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}
                      </div>
                    </div>

                    {status === 'Selesai' && waktuselesai && (
                      <div className="text-left sm:text-right text-xs">
                        <div className="text-muted-foreground font-mono">Ditransfer:</div>
                        <div className="font-bold">{new Date(waktuselesai).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
      {/* MODAL PENGATURAN BIAYA KADER & MOU PER WARUNG */}
      {isConfigModalOpen && configForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border-4 border-border w-full max-w-xl p-6 rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b-2 border-border mb-4">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">PENGATURAN BIAYA KADER & MOU</h2>
                <p className="text-xs font-mono text-muted-foreground">Sesuaikan tarif sewa aplikasi & honor kader standar maupun khusus per warung.</p>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfigModal} className="flex-1 overflow-y-auto pr-1 space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase tracking-wider">SEWA APLIKASI STANDAR (RP/BLN)</label>
                  <Input 
                    type="number"
                    min="0"
                    required
                    value={configForm.biayaAplikasi ?? 30000}
                    onChange={(e) => setConfigForm((prev: any) => ({ ...prev, biayaAplikasi: Number(e.target.value) }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase tracking-wider">HONOR KADER STANDAR (RP/BLN)</label>
                  <Input 
                    type="number"
                    min="0"
                    required
                    value={configForm.biayaKader ?? 200000}
                    onChange={(e) => setConfigForm((prev: any) => ({ ...prev, biayaKader: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold uppercase tracking-wider">MAKSIMAL PEMOTONGAN PER PENCAIRAN (%)</label>
                <Input 
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={configForm.maxPotongPersen ?? 50}
                  onChange={(e) => setConfigForm((prev: any) => ({ ...prev, maxPotongPersen: Number(e.target.value) }))}
                />
                <span className="text-[10px] text-muted-foreground">Standar: 50% (warung tetap memegang minimal 50% dari pengajuannya).</span>
              </div>

              {/* Pengaturan Khusus per Warung */}
              <div className="pt-3 border-t-2 border-border/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black uppercase tracking-wider text-primary">TARIF KHUSUS HONOR KADER PER WARUNG</span>
                  <span className="text-[10px] text-muted-foreground">Kosong = Standar (Rp {(configForm.biayaKader ?? 200000).toLocaleString('id-ID')})</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {warungList.map((w: any) => {
                    const wId = String(w.id || w.ID);
                    const wName = w.nama || w.Nama || wId;
                    const curVal = configForm.warungConfig?.[wId]?.biayaKader ?? '';
                    return (
                      <div key={wId} className="flex items-center justify-between gap-3 p-2 rounded-xl border-2 border-border bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold uppercase truncate">{wName}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{w.lokasi || w.Lokasi ? `${w.lokasi || w.Lokasi} • ` : ''}PJ: {w.pj || w.PJ || '-'}</div>
                        </div>
                        <div className="relative w-36 shrink-0">
                          <span className="absolute left-2.5 top-2 text-[11px] text-muted-foreground">Rp</span>
                          <Input 
                            type="number"
                            min="0"
                            placeholder={`${(configForm.biayaKader ?? 200000).toLocaleString('id-ID')}`}
                            value={curVal}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              setConfigForm((prev: any) => {
                                const wc = { ...(prev.warungConfig || {}) };
                                if (val === undefined || isNaN(val)) {
                                  if (wc[wId]) {
                                    const copy = { ...wc[wId] };
                                    delete copy.biayaKader;
                                    if (Object.keys(copy).length === 0) delete wc[wId];
                                    else wc[wId] = copy;
                                  }
                                } else {
                                  wc[wId] = { ...(wc[wId] || {}), biayaKader: val };
                                }
                                return { ...prev, warungConfig: wc };
                              });
                            }}
                            className="pl-8 text-xs font-bold"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t-2 border-border mt-4">
                <Button type="button" variant="outline" onClick={() => setIsConfigModalOpen(false)}>BATAL</Button>
                <Button type="submit" className="font-bold">SIMPAN PENGATURAN</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


