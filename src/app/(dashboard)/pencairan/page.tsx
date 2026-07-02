"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Info, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PencairanPage() {
  const user = useAuthStore((state: any) => state.user);
  const queryClient = useQueryClient();

  // Fetch eligible (unwithdrawn) non-cash transactions
  const { data: eligibleData, isLoading: isLoadingEligible } = useQuery({
    queryKey: ['pencairanEligible', user?.warungId],
    queryFn: () => api.post('getPencairanEligible', { warungId: user?.warungId || "ALL" }).then(res => res?.data ?? []),
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Fetch withdrawal history
  const { data: riwayatData, isLoading: isLoadingRiwayat } = useQuery({
    queryKey: ['riwayatPencairan', user?.warungId],
    queryFn: () => api.post('getRiwayatPencairan', { warungId: user?.warungId || "ALL" }).then(res => res?.data ?? []),
    enabled: !!user,
    refetchInterval: 10000,
  });

  const ajukanMutation = useMutation({
    mutationFn: (payload: { warungId: string, trxIds: string[], totalDana: number }) => 
      api.post('ajukanPencairan', payload).then(res => {
        if (res.status === 'error') throw new Error(res.message);
        return res;
      }),
    onSuccess: () => {
      toast.success("Pengajuan pencairan berhasil dibuat!");
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

  const handleAjukan = () => {
    if (trxIds.length === 0) return;
    if (confirm(`Anda akan mengajukan pencairan sebesar Rp ${totalDanaEligible.toLocaleString('id-ID')}.\nLanjutkan?`)) {
      ajukanMutation.mutate({
        warungId: user?.warungId,
        trxIds: trxIds,
        totalDana: totalDanaEligible
      });
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in zoom-in duration-300">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Pencairan Dana</h1>
        <p className="text-muted-foreground font-mono mt-1">Cairkan penghasilan dari transaksi Tabungan & QRIS/VA.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* PANEL DANA TERSEDIA */}
        <div className="bg-card border-4 border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-6 flex flex-col items-center justify-center text-center">
          <Wallet className="w-16 h-16 text-primary mb-4" />
          <p className="text-sm font-bold text-muted-foreground uppercase mb-2">Dana Dapat Dicairkan</p>
          <h2 className="text-5xl font-black tracking-tighter mb-4 text-primary">
            Rp {totalDanaEligible.toLocaleString('id-ID')}
          </h2>
          <p className="text-sm font-mono text-muted-foreground mb-6">
            Dari {trxIds.length} transaksi non-tunai terbaru.
          </p>

          <div className="bg-blue-50 text-blue-800 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3 text-left w-full max-w-sm">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold mb-1">Informasi Pencairan</p>
              <p>Pencairan dana memakan waktu proses estimasi <span className="font-bold">1 hingga 3 hari kerja</span> setelah diajukan.</p>
            </div>
          </div>

          <button 
            onClick={handleAjukan}
            disabled={trxIds.length === 0 || ajukanMutation.isPending}
            className={`w-full max-w-sm py-4 rounded-xl font-black uppercase tracking-widest transition-all ${trxIds.length > 0 ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-1 shadow-lg' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
          >
            {ajukanMutation.isPending ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> MENGUSULKAN...</span>
            ) : "AJUKAN PENCAIRAN"}
          </button>
        </div>

        {/* PANEL RIWAYAT PENCAIRAN */}
        <div className="bg-card border-2 border-border rounded-xl p-6 overflow-hidden flex flex-col">
          <h3 className="font-black text-xl uppercase mb-4">Riwayat Pencairan</h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {isLoadingRiwayat ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : riwayatList.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground font-mono text-sm border-2 border-dashed border-border rounded-xl">
                Belum ada riwayat pencairan.
              </div>
            ) : (
              riwayatList.map((item: any, idx: number) => {
                const totaldana = item.totaldana || item.TotalDana;
                const status = item.status || item.Status;
                const idpencairan = item.idpencairan || item.IDPencairan;
                const waktupengajuan = item.waktupengajuan || item.WaktuPengajuan;
                const waktuselesai = item.waktuselesai || item.WaktuSelesai;
                
                return (
                <div key={idx} className="flex justify-between items-center p-4 border rounded-xl hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">Rp {Number(totaldana || 0).toLocaleString('id-ID')}</span>
                      <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase ${status === 'Selesai' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {status === 'Selesai' ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <Clock className="w-3 h-3 inline mr-1" />}
                        {status}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      ID: {idpencairan} • {new Date(waktupengajuan).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}
                    </div>
                  </div>
                  {status === 'Selesai' && waktuselesai && (
                    <div className="text-right text-xs">
                      <div className="text-muted-foreground">Diselesaikan:</div>
                      <div className="font-bold">{new Date(waktuselesai).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</div>
                    </div>
                  )}
                </div>
              )})
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
