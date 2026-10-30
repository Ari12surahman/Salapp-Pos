"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useConfirmStore } from "@/store/confirmStore";
import { api } from "@/lib/api/axios";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Info, CheckCircle2, Clock, Loader2, Store, BadgePercent, Calculator, ShieldCheck, ArrowRight, Sparkles, SlidersHorizontal, X, Receipt, Printer, Copy } from "lucide-react";
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
  const [selectedStrukPencairan, setSelectedStrukPencairan] = useState<any | null>(null);

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

  // Fetch MasterConfig for Fee Deduction Status
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
      toast.success("Pengaturan Tagihan Kader & Tagihan Aplikasi berhasil disimpan!");
      queryClient.invalidateQueries({ queryKey: ['masterConfigPencairan'] });
      setIsConfigModalOpen(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan pengaturan: " + err.message);
    }
  };

  // Hitung akumulasi yang sudah dibayarkan di bulan ini
  Object.values(feeHistory).forEach((h: any) => {
    if (String(h.warungId) === String(activeWarungId) && h.periodeBulan === currentPeriodeBulan) {
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

  const estPotongKader = Math.min(sisaKader, maxPotongan);
  const estPotongAplikasi = Math.min(sisaAplikasi, Math.max(0, maxPotongan - estPotongKader));
  const estTotalPotongan = estPotongKader + estPotongAplikasi;
  const estDanaBersih = Math.max(0, totalDanaEligible - estTotalPotongan);
  const estSisaSetelahPencairan = Math.max(0, totalSisa - estTotalPotongan);

  const handleAjukan = async () => {
    if (trxIds.length === 0) return;

    const potongSummary = isLunas 
      ? "Rp 0 (LUNAS)" 
      : (estTotalPotongan > 0 
          ? `-Rp ${estTotalPotongan.toLocaleString('id-ID')} (${estPotongKader > 0 ? `Tagihan Kader: Rp ${estPotongKader.toLocaleString('id-ID')}` : ''}${estPotongAplikasi > 0 ? `${estPotongKader > 0 ? ', ' : ''}Tagihan Aplikasi: Rp ${estPotongAplikasi.toLocaleString('id-ID')}` : ''})`
          : "Rp 0");

    const message = [
      `Detail Rincian Pengajuan:`,
      `• Warung: ${activeWarungName}`,
      `• Pengajuan Kotor: Rp ${totalDanaEligible.toLocaleString('id-ID')}`,
      `• Estimasi Potongan Tagihan: ${potongSummary}`,
      `• Estimasi Bersih Diterima: Rp ${estDanaBersih.toLocaleString('id-ID')}`,
      ``,
      isLunas
        ? `Seluruh tagihan bulan ini telah lunas, dana akan dicairkan 100% utuh tanpa potongan.`
        : (estTotalPotongan > 0 
            ? `Dana bersih sekitar Rp ${estDanaBersih.toLocaleString('id-ID')} akan ditransfer ke rekening warung. Sisa tagihan bulan ini menjadi Rp ${estSisaSetelahPencairan.toLocaleString('id-ID')} (dilanjutkan pada pencairan berikutnya).`
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

  const handleCopyWhatsAppPencairan = (data: any) => {
    if (!data) return;
    const { item, hist, warungName } = data;
    const tgl = item.waktuselesai || item.WaktuSelesai || item.waktupengajuan || item.WaktuPengajuan;
    const tglStr = tgl ? new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
    const totalKotor = Number(hist?.totalKotor || item.totaldana || item.TotalDana || 0);
    const potKader = Number(hist?.potonganKader || 0);
    const potAplikasi = Number(hist?.potonganAplikasi || 0);
    const totalPot = Number(hist?.totalPotongan || (potKader + potAplikasi));
    const totalBersih = Number(hist?.totalBersih || (totalKotor - totalPot));
    const sisaKaderVal = Number(hist?.sisaKaderSetelah || 0);
    const sisaAplikasiVal = Number(hist?.sisaAplikasiSetelah || 0);

    const text = 
`*BUKTI PENCAIRAN SALDO KANTIN*
---------------------------------------
Nama Warung: *${warungName}*
ID Pencairan: \`${item.idpencairan || item.IDPencairan}\`
Tanggal: ${tglStr}
Periode: *${hist?.periodeBulan || currentPeriodeLabel}*

*RINCIAN DANA:*
  Total Penjualan Non-Tunai: *Rp ${totalKotor.toLocaleString('id-ID')}*

*POTONGAN TAGIHAN:*
  Tagihan Kader: -Rp ${potKader.toLocaleString('id-ID')}
  Tagihan Aplikasi: -Rp ${potAplikasi.toLocaleString('id-ID')}
  Total Terpotong: *-Rp ${totalPot.toLocaleString('id-ID')}*

---------------------------------------
*TOTAL BERSIH DITERIMA:*
*Rp ${totalBersih.toLocaleString('id-ID')}*
---------------------------------------

*SISA TAGIHAN BULAN INI:*
  Tagihan Kader: Rp ${sisaKaderVal.toLocaleString('id-ID')}
  Tagihan Aplikasi: Rp ${sisaAplikasiVal.toLocaleString('id-ID')}

Terima kasih atas kerja samanya.
- KEUANGAN PONDOK PESANTREN -`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success("Format WhatsApp berhasil disalin!");
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

      {/* BANNER STATUS KEWAJIBAN BULANAN (TAGIHAN KADER & APLIKASI) */}
      <div className="bg-card border-2 border-border p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-sm uppercase">
                Kewajiban Tagihan Warung ({currentPeriodeLabel})
              </h3>
              {isLunas ? (
                <span className="text-[11px] bg-green-100 text-green-700 font-bold px-2.5 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> LUNAS BULAN INI
                </span>
              ) : (
                <span className="text-[11px] bg-amber-100 text-amber-700 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                  Sisa Tagihan: Rp {totalSisa.toLocaleString('id-ID')}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Tagihan Kader: Rp {terbayarKader.toLocaleString('id-ID')} / {targetKader.toLocaleString('id-ID')} {customWarung?.biayaKader !== undefined ? '(Khusus Warung)' : ''} • Tagihan Aplikasi: Rp {terbayarAplikasi.toLocaleString('id-ID')} / {targetAplikasi.toLocaleString('id-ID')}
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
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Atur Tagihan Kader & Aplikasi
            </Button>
          )}
          <div className="text-xs text-muted-foreground bg-muted/60 border border-border/80 px-3 py-2 rounded-xl font-mono max-w-sm">
            💡 Pemotongan tagihan bertahap (maks. {maxPotongPersen}% per pencairan) agar modal harian warung terjaga.
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
                  <span>Nominal Penjualan (Kotor)</span>
                  <span className="font-bold text-foreground">Rp {totalDanaEligible.toLocaleString('id-ID')}</span>
                </div>
                
                {/* Rincian Potongan: Tagihan Kader & Tagihan Aplikasi */}
                <div className="space-y-1.5 pt-1 border-t border-border/60">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      Tagihan Kader
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                        Maks {maxPotongPersen}%
                      </span>
                    </span>
                    {estPotongKader > 0 ? (
                      <span className="font-bold text-amber-600">-Rp {estPotongKader.toLocaleString('id-ID')}</span>
                    ) : (
                      <span className="text-muted-foreground font-medium">{sisaKader === 0 ? 'Rp 0 (LUNAS)' : 'Rp 0'}</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tagihan Aplikasi</span>
                    {estPotongAplikasi > 0 ? (
                      <span className="font-bold text-amber-600">-Rp {estPotongAplikasi.toLocaleString('id-ID')}</span>
                    ) : (
                      <span className="text-muted-foreground font-medium">{sisaAplikasi === 0 ? 'Rp 0 (LUNAS)' : 'Rp 0'}</span>
                    )}
                  </div>

                  {!isLunas && estTotalPotongan > 0 && (
                    <div className="pl-3 py-1.5 text-[11px] text-muted-foreground border-l-2 border-amber-300 space-y-1 bg-amber-50/50 dark:bg-amber-950/20 rounded-r-lg mt-1">
                      <div className="flex justify-between text-amber-800 dark:text-amber-300 font-bold">
                        <span>• Sisa Tagihan Bulan Ini Nanti:</span>
                        <span>Rp {estSisaSetelahPencairan.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  )}
                </div>
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
                  Pemotongan tagihan kader & aplikasi dibatasi maksimal {maxPotongPersen}% dari setiap pencairan agar uang operasional warung tidak habis. Sisa tagihan dapat dicicil di pencairan berikutnya.
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
                              Kotor: Rp {totaldana.toLocaleString('id-ID')} • Potong: {hist.potonganKader ? `Kader -Rp ${Number(hist.potonganKader).toLocaleString('id-ID')}` : ''} {hist.potonganAplikasi ? `Aplikasi -Rp ${Number(hist.potonganAplikasi).toLocaleString('id-ID')}` : ''}
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

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {status === 'Selesai' && waktuselesai && (
                        <div className="text-left sm:text-right text-xs mr-1 hidden md:block">
                          <div className="text-muted-foreground font-mono">Ditransfer:</div>
                          <div className="font-bold">{new Date(waktuselesai).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</div>
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedStrukPencairan({ item, hist, warungName: activeWarungName })}
                        className="h-8 gap-1.5 font-mono text-xs border shadow-2xs hover:bg-muted"
                        title="Lihat & Cetak Struk Bukti Pencairan"
                      >
                        <Receipt className="w-3.5 h-3.5 text-primary" />
                        <span>STRUK</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* MODAL STRUK BUKTI PENCAIRAN */}
      {selectedStrukPencairan && (() => {
        const { item, hist, warungName } = selectedStrukPencairan;
        const totaldana = Number(hist?.totalKotor || item.totaldana || item.TotalDana || 0);
        const potKader = Number(hist?.potonganKader || 0);
        const potAplikasi = Number(hist?.potonganAplikasi || 0);
        const totalPotongan = Number(hist?.totalPotongan || (potKader + potAplikasi));
        const totalBersih = Number(hist?.totalBersih || (totaldana - totalPotongan));
        const sisaKaderVal = Number(hist?.sisaKaderSetelah || 0);
        const sisaAplikasiVal = Number(hist?.sisaAplikasiSetelah || 0);
        const tglPengajuan = item.waktupengajuan || item.WaktuPengajuan;
        const tglSelesai = item.waktuselesai || item.WaktuSelesai;
        const idpencairan = item.idpencairan || item.IDPencairan;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:p-0 print:bg-white print:block">
            <style jsx global>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #struk-pencairan-print, #struk-pencairan-print * {
                  visibility: visible;
                }
                #struk-pencairan-print {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  max-width: 80mm;
                  margin: 0;
                  padding: 10px;
                  color: #000;
                  background: #fff;
                }
              }
            `}</style>

            <div className="bg-card border-4 border-border w-full max-w-md flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] rounded-2xl overflow-hidden print:hidden">
              <div className="p-4 border-b-2 border-border flex items-center justify-between bg-muted/40">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-black uppercase tracking-tight">STRUK BUKTI PENCAIRAN</h2>
                </div>
                <button onClick={() => setSelectedStrukPencairan(null)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Isi Struk */}
              <div className="p-5 bg-white text-black flex justify-center border-b-2 border-border overflow-y-auto max-h-[60vh]">
                <div id="struk-pencairan-print" className="font-mono text-xs w-full max-w-[72mm] mx-auto text-black">
                  <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                    <h1 className="font-black text-sm uppercase">{warungName}</h1>
                    <p className="text-[10px] text-gray-700">STRUK BUKTI PENCAIRAN SALDO</p>
                    <p className="text-[10px] text-gray-500">================================</p>
                  </div>

                  <div className="text-[10px] mb-2 leading-tight border-b border-dashed border-gray-400 pb-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID Pencairan:</span>
                      <span className="font-bold">{idpencairan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Waktu Pengajuan:</span>
                      <span>{tglPengajuan ? new Date(tglPengajuan).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}</span>
                    </div>
                    {tglSelesai && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Waktu Ditransfer:</span>
                        <span>{new Date(tglSelesai).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-bold uppercase text-emerald-700">{item.status || item.Status}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-b border-dashed border-gray-400 pb-2 mb-2">
                    <div className="flex justify-between text-[11px]">
                      <span>Penjualan Kotor</span>
                      <span className="font-bold">Rp {totaldana.toLocaleString('id-ID')}</span>
                    </div>
                    {potKader > 0 && (
                      <div className="flex justify-between text-[11px] text-rose-700">
                        <span>Tagihan Kader</span>
                        <span className="font-semibold">-Rp {potKader.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {potAplikasi > 0 && (
                      <div className="flex justify-between text-[11px] text-rose-700">
                        <span>Tagihan Aplikasi</span>
                        <span className="font-semibold">-Rp {potAplikasi.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {totalPotongan > 0 && (
                      <div className="flex justify-between text-[10px] text-gray-600 pt-1 border-t border-dotted border-gray-300">
                        <span>Total Potongan Tagihan</span>
                        <span className="font-bold text-rose-700">-Rp {totalPotongan.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>

                  {/* Bersih Diterima */}
                  <div className="flex justify-between items-center font-black text-sm mb-2 pt-1 border-b border-dashed border-black pb-2">
                    <span>BERSIH DITERIMA</span>
                    <span className="text-base text-emerald-700">Rp {totalBersih.toLocaleString('id-ID')}</span>
                  </div>

                  {/* Sisa Tagihan Bulan Ini */}
                  {(sisaKaderVal > 0 || sisaAplikasiVal > 0) ? (
                    <div className="text-[10px] space-y-0.5 text-gray-700 border-b border-dashed border-gray-400 pb-2 mb-2">
                      <p className="font-bold">SISA TAGIHAN BULAN INI:</p>
                      {sisaKaderVal > 0 && (
                        <div className="flex justify-between">
                          <span>• Tagihan Kader:</span>
                          <span>Rp {sisaKaderVal.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {sisaAplikasiVal > 0 && (
                        <div className="flex justify-between">
                          <span>• Tagihan Aplikasi:</span>
                          <span>Rp {sisaAplikasiVal.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-center text-emerald-700 font-bold border-b border-dashed border-gray-400 pb-1 mb-2">
                      TAGIHAN BULAN INI TELAH LUNAS
                    </div>
                  )}

                  <div className="text-center text-[10px] text-gray-600 mt-2">
                    <p>Simpan struk ini sebagai bukti pencairan sah.</p>
                    <p className="mt-1 font-bold text-gray-900">- KEUANGAN PONDOK PESANTREN -</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 bg-card flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => window.print()} 
                  className="flex-1 gap-2 font-bold text-xs"
                >
                  <Printer className="w-4 h-4" /> CETAK STRUK
                </Button>
                <Button 
                  onClick={() => handleCopyWhatsAppPencairan(selectedStrukPencairan)} 
                  variant="outline" 
                  className="flex-1 gap-2 font-bold text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                >
                  <Copy className="w-4 h-4" /> SALIN FORMAT WA
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL PENGATURAN TAGIHAN KADER & APLIKASI PER WARUNG */}
      {isConfigModalOpen && configForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border-4 border-border w-full max-w-xl p-6 rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b-2 border-border mb-4">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">PENGATURAN TAGIHAN KADER & APLIKASI</h2>
                <p className="text-xs font-mono text-muted-foreground">Sesuaikan tarif tagihan aplikasi & tagihan kader standar maupun khusus per warung.</p>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfigModal} className="flex-1 overflow-y-auto pr-1 space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase tracking-wider">TAGIHAN APLIKASI STANDAR (RP/BLN)</label>
                  <Input 
                    type="number"
                    min="0"
                    required
                    value={configForm.biayaAplikasi ?? 30000}
                    onChange={(e) => setConfigForm((prev: any) => ({ ...prev, biayaAplikasi: Number(e.target.value) }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase tracking-wider">TAGIHAN KADER STANDAR (RP/BLN)</label>
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
                  <span className="font-black uppercase tracking-wider text-primary">TARIF KHUSUS TAGIHAN KADER PER WARUNG</span>
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
