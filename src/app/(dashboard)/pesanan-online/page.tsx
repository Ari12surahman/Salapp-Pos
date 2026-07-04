"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";
import { ShoppingBag, CheckCircle2, Clock, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAudio } from "@/hooks/useAudio";
import { supabase } from "@/lib/supabase";
import { supabaseServices } from "@/lib/api/supabaseServices";
import { Button } from "@/components/ui/button";
import { useConfirmStore } from "@/store/confirmStore";
import { formatDateTimeID } from "@/lib/utils";

export default function PesananOnlinePage() {
  const user = useAuthStore(state => state.user);
  const queryClient = useQueryClient();
  const { playDing } = useAudio();
  
  const [activeTab, setActiveTab] = useState<"Menunggu" | "Selesai">("Menunggu");
  const [previousOrderCount, setPreviousOrderCount] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showRekapModal, setShowRekapModal] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['pesananOnline', user?.warungId],
    queryFn: () => supabaseServices.getPesananOnline({ warungId: user?.warungId || "ALL" }).then(res => res.status === 'success' ? res.data : []),
    refetchInterval: 5000, // Poll every 5 seconds
    enabled: !!user,
  });

  // Supabase realtime dimatikan sementara, polling GAS digunakan
  // useEffect(() => {
  //   const channel = supabase.channel('realtime:pesanan-online')
  // ...
  // }, [user, refetch, playDing]);

  const { data: santriMasterData } = useQuery({
    queryKey: ['santriMaster'],
    queryFn: () => api.get('getSantri', { params: { spreadsheetId: "1jrUrg3DVS0migGJdWuzaRj4WJ65hS_ZSPG7y7bwPHe0" } }).then(res => res.data),
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  const getSantriInfo = (nisRaw: string) => {
    if (!santriMasterData || !Array.isArray(santriMasterData)) return null;
    const nis = String(nisRaw || '').replace(/'/g, '').replace(/^0+/, '');
    return santriMasterData.find((s: any) => String(s.nis).replace(/^0+/, '') === nis || String(s.uid) === nis);
  };

  const orders = Array.isArray(data) ? data : [];
  const waitingOrders = orders.filter((o: any) => o.statusambil === "Menunggu");
  const completedOrders = orders.filter((o: any) => o.statusambil === "Selesai");
  
  // Play sound if new waiting order arrives
  useEffect(() => {
    if (waitingOrders.length > previousOrderCount) {
      playDing();
    }
    setPreviousOrderCount(waitingOrders.length);
  }, [waitingOrders.length]);

  const updateMutation = useMutation({
    mutationFn: (trxIds: string | string[]) => {
      const payload = Array.isArray(trxIds) ? { trxIds, status: "Selesai" } : { trxId: trxIds, status: "Selesai" };
      return supabaseServices.updateStatusAmbil(payload);
    },
    onSuccess: (res: any, variables: any) => {
      if(res.status === "success") {
         toast.success("Status pesanan berhasil diperbarui!");
         setSelectedOrders([]);
         queryClient.invalidateQueries({ queryKey: ['pesananOnline'] });
         
         // Kirim notifikasi ke orang tua
         const trxIds = Array.isArray(variables) ? variables : [variables];
         const processedOrders = waitingOrders.filter((o: any) => trxIds.includes(o.trxid));
         processedOrders.forEach((o: any) => {
             if (o.santriid) {
                 const itemNames = o.items ? o.items.map((i: any) => `${i.nama} (${i.qty})`).join(', ') : 'beberapa jajanan';
                 fetch('https://sal-app-admin.vercel.app/api/notifikasi', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ 
                         nis: o.santriid, 
                         title: 'Pesanan Diterima', 
                         body: `Alhamdulillah, pesanan Titip Jajan (${itemNames}) senilai Rp ${Number(o.totalharga).toLocaleString('id-ID')} telah diterima oleh anak Anda.`
                     })
                 }).catch(e => console.log('Push notif error:', e));
             }
         });
      } else {
         toast.error("Gagal: " + res.message);
      }
    },
    onError: () => toast.error("Terjadi kesalahan jaringan.")
  });

  const deleteMutation = useMutation({
    mutationFn: (trxIds: string[]) => supabaseServices.hapusTransaksi({ trxIds }),
    onSuccess: (res: any) => {
      if(res.status === "success") {
         toast.success("Pesanan berhasil dihapus!");
         setSelectedOrders([]);
         queryClient.invalidateQueries({ queryKey: ['pesananOnline'] });
      } else {
         toast.error("Gagal: " + res.message);
      }
    },
    onError: () => toast.error("Terjadi kesalahan jaringan.")
  });

  const handleSelesai = async (trxIds: string | string[]) => {
    const isBulk = Array.isArray(trxIds);
    const confirmed = await useConfirmStore.getState().showConfirm({
      title: "PESANAN SELESAI",
      message: isBulk ? `Apakah ${trxIds.length} pesanan ini sudah diambil siswa?` : "Apakah pesanan ini sudah diambil siswa?",
      confirmText: "YA, SUDAH"
    });
    if(confirmed) {
      updateMutation.mutate(trxIds);
    }
  };

  const handleDelete = async (trxIds: string[]) => {
    const confirmed = await useConfirmStore.getState().showConfirm({
      title: "HAPUS PESANAN",
      message: `Yakin ingin menghapus ${trxIds.length} pesanan yang dipilih? Data akan dihapus permanen.`,
    });
    if(confirmed) {
      deleteMutation.mutate(trxIds);
    }
  };

  const toggleSelect = (trxId: string) => {
    setSelectedOrders(prev => 
      prev.includes(trxId) ? prev.filter(id => id !== trxId) : [...prev, trxId]
    );
  };

  const selectAll = () => {
    const currentOrders = activeTab === "Menunggu" ? waitingOrders : completedOrders;
    if (selectedOrders.length === currentOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(currentOrders.map((o: any) => o.trxid));
    }
  };

  // Kalkulasi Rekap
  const rekapData = {
    totalPesanan: completedOrders.length,
    totalPendapatan: completedOrders.reduce((sum, o) => sum + Number(o.totalharga || 0), 0),
    items: completedOrders.flatMap(o => o.items || [])
  };
  
  // Hitung qty per item untuk rekap
  const rekapItemsMap = rekapData.items.reduce((acc: any, item: any) => {
    if (!acc[item.nama]) {
      acc[item.nama] = { qty: 0, subtotal: 0 };
    }
    acc[item.nama].qty += Number(item.qty);
    acc[item.nama].subtotal += Number(item.qty) * Number(item.harga);
    return acc;
  }, {});

  const currentOrdersList = activeTab === "Menunggu" ? waitingOrders : completedOrders;

  return (
    <>
    <div className="p-6 space-y-6 relative print:hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Pesanan Online</h1>
          <p className="text-muted-foreground mt-1 text-sm">Kelola titip jajan dari Portal Orang Tua</p>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-bold shadow-sm hover:bg-secondary/80">
             <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
             Refresh
           </button>
        </div>
      </div>

      <div className="flex border-b">
        <button 
          onClick={() => { setActiveTab("Menunggu"); setSelectedOrders([]); }} 
          className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors mr-6 ${activeTab === "Menunggu" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Pesanan Baru ({waitingOrders.length})
        </button>
        <button 
          onClick={() => { setActiveTab("Selesai"); setSelectedOrders([]); }} 
          className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === "Selesai" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Selesai ({completedOrders.length})
        </button>
      </div>

      {currentOrdersList.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/20 p-3 rounded-lg border border-dashed">
          <div className="flex items-center gap-3">
            <button 
              onClick={selectAll}
              className="text-sm font-semibold text-primary hover:text-primary/80"
            >
              {selectedOrders.length === currentOrdersList.length ? "Batal Pilih Semua" : "Pilih Semua"}
            </button>
            <span className="text-sm text-muted-foreground">| {selectedOrders.length} terpilih</span>
          </div>
          
          <div className="flex items-center gap-3">
            {selectedOrders.length > 0 && activeTab === "Menunggu" && (
              <button 
                onClick={() => handleSelesai(selectedOrders)}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-success text-success-foreground text-sm font-bold rounded-lg hover:bg-success/90 transition-colors flex items-center gap-2"
              >
                {updateMutation.isPending ? "Memproses..." : "Tandai Diambil"}
              </button>
            )}
            {selectedOrders.length > 0 && activeTab === "Selesai" && (
              <button 
                onClick={() => handleDelete(selectedOrders)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-bold rounded-lg hover:bg-destructive/90 transition-colors flex items-center gap-2"
              >
                {deleteMutation.isPending ? "Menghapus..." : "Hapus Terpilih"}
              </button>
            )}
            {activeTab === "Selesai" && (
              <button 
                onClick={() => setShowRekapModal(true)}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                Lihat Rekap
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="col-span-full text-muted-foreground text-center py-10 font-mono animate-pulse">Memuat data pesanan...</p>}
        
        {!isLoading && activeTab === "Menunggu" && waitingOrders.length === 0 && (
          <div className="col-span-full text-center py-20 bg-muted/30 border border-dashed rounded-xl">
            <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="font-bold text-muted-foreground">Tidak ada pesanan baru.</p>
          </div>
        )}

        {!isLoading && activeTab === "Selesai" && completedOrders.length === 0 && (
          <div className="col-span-full text-center py-20 bg-muted/30 border border-dashed rounded-xl">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="font-bold text-muted-foreground">Belum ada pesanan yang selesai.</p>
          </div>
        )}

        {(activeTab === "Menunggu" ? waitingOrders : completedOrders).map((order: any, idx: number) => {
          const santriInfo = getSantriInfo(order.santriid);
          
          return (
          <div key={idx} className="bg-card border shadow-sm rounded-xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-300">
             {activeTab === "Menunggu" && (
                <div className="absolute top-0 left-0 w-1 h-full bg-warning/80"></div>
             )}
             {activeTab === "Selesai" && (
                <div className="absolute top-0 left-0 w-1 h-full bg-success/80"></div>
             )}
             
             <div className="p-4 border-b bg-muted/10">
               <div className="flex justify-between items-start mb-2">
                 <div className="flex items-start gap-2">
                   <input 
                     type="checkbox" 
                     className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary mt-1.5"
                     checked={selectedOrders.includes(order.trxid)}
                     onChange={() => toggleSelect(order.trxid)}
                   />
                   <div>
                     <h3 className="font-black text-lg leading-tight mb-0.5">{santriInfo ? santriInfo.nama : `NIS: ${String(order.santriid || '').replace(/'/g, '') || '-'}`}</h3>
                     {santriInfo && <p className="text-xs font-mono text-muted-foreground uppercase">{santriInfo.kelas} • NIS: {santriInfo.nis}</p>}
                   </div>
                 </div>
                 <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-1 rounded-md shrink-0">
                   {order.trxid}
                 </span>
               </div>
               <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
                 <Clock className="w-3.5 h-3.5" />
                 {formatDateTimeID(order.waktu)}
               </div>
             </div>
             
             <div className="p-4 flex-1 flex flex-col">
                <ul className="space-y-2 mb-4 flex-1">
                  {(order.items || []).map((item: any, i: number) => (
                    <li key={i} className="flex justify-between items-start text-sm">
                      <span className="font-medium text-foreground">{item.qty}x {item.nama}</span>
                      <span className="text-muted-foreground">Rp {(item.qty * item.harga).toLocaleString('id-ID')}</span>
                    </li>
                  ))}
                </ul>
                
                {order.catatan && (
                  <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm">
                    <span className="font-bold text-amber-800 block mb-1">Catatan Pesanan:</span>
                    <span className="text-amber-900">{order.catatan}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t font-bold mt-auto">
                  <span>Total</span>
                  <span className="text-primary text-lg">Rp {Number(order.totalharga || order.TotalHarga || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>

             {activeTab === "Menunggu" && (
               <div className="p-3 bg-muted/20 border-t">
                 <button 
                   onClick={() => handleSelesai(order.trxid)}
                   disabled={updateMutation.isPending}
                   className="w-full flex justify-center items-center gap-2 bg-primary text-primary-foreground font-bold py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
                 >
                   {updateMutation.isPending ? "Memproses..." : <><Check className="w-4 h-4" /> Tandai Diambil</>}
                 </button>
               </div>
             )}

             {activeTab === "Selesai" && (
               <div className="p-3 bg-muted/20 border-t">
                 <button 
                   onClick={() => handleDelete([order.trxid])}
                   disabled={deleteMutation.isPending}
                   className="w-full flex justify-center items-center gap-2 text-destructive font-bold py-2 hover:bg-destructive/10 rounded-lg transition-colors"
                 >
                   {deleteMutation.isPending ? "Menghapus..." : "Hapus Pesanan"}
                 </button>
               </div>
             )}
          </div>
          );
        })}
      </div>

      {/* MODAL REKAP */}
      {showRekapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-card border border-border w-full max-w-lg flex flex-col shadow-xl relative rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b bg-muted/30 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Rekap Pesanan Online</h2>
                <p className="text-sm text-muted-foreground mt-1">Pesanan yang telah selesai</p>
              </div>
              <button onClick={() => setShowRekapModal(false)} className="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl text-center">
                  <p className="text-sm text-muted-foreground mb-1">Total Pesanan</p>
                  <p className="text-3xl font-black text-primary">{rekapData.totalPesanan}</p>
                </div>
                <div className="bg-success/5 border border-success/20 p-4 rounded-xl text-center">
                  <p className="text-sm text-muted-foreground mb-1">Pendapatan</p>
                  <p className="text-2xl font-black text-success">Rp {rekapData.totalPendapatan.toLocaleString('id-ID')}</p>
                </div>
              </div>

              <h3 className="font-bold border-b pb-2 mb-3">Item Terjual</h3>
              {Object.keys(rekapItemsMap).length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">Tidak ada item.</p>
              ) : (
                <ul className="space-y-3">
                  {Object.entries(rekapItemsMap).sort((a: any, b: any) => b[1].qty - a[1].qty).map(([name, stat]: any, i) => (
                    <li key={i} className="flex justify-between items-center text-sm border-b border-dashed pb-2 last:border-0">
                      <div>
                        <span className="font-bold mr-2">{stat.qty}x</span>
                        <span>{name}</span>
                      </div>
                      <span className="font-medium text-muted-foreground">Rp {stat.subtotal.toLocaleString('id-ID')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-5 border-t bg-muted/10">
              <button 
                onClick={() => {
                  window.print();
                }}
                className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Cetak Rekap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* PRINT ONLY SECTION */}
    <div className="hidden print:block p-8 bg-white text-black min-h-screen font-sans">
      <div className="text-center mb-8 border-b-2 border-black pb-4">
        <h1 className="text-2xl font-black uppercase tracking-tight">Rekapitulasi Pesanan Online</h1>
        <p className="text-sm text-gray-600 mt-1" suppressHydrationWarning>Waktu Cetak: {formatDateTimeID(new Date())}</p>
      </div>
      
      <div className="flex justify-between mb-8">
        <div className="border-2 border-gray-200 p-4 rounded-lg w-[48%]">
          <p className="text-sm text-gray-600 font-medium">Total Pesanan Selesai</p>
          <p className="text-3xl font-black">{rekapData.totalPesanan} <span className="text-base font-normal">Transaksi</span></p>
        </div>
        <div className="border-2 border-gray-200 p-4 rounded-lg w-[48%]">
          <p className="text-sm text-gray-600 font-medium">Total Pendapatan</p>
          <p className="text-3xl font-black text-green-700">Rp {rekapData.totalPendapatan.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4 bg-gray-100 p-2 border-l-4 border-black">Rincian Item Terjual</h2>
      <table className="w-full border-collapse border-2 border-gray-800 text-sm">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-800">
            <th className="border border-gray-400 p-3 text-center w-16 uppercase font-bold text-gray-700">No</th>
            <th className="border border-gray-400 p-3 text-left uppercase font-bold text-gray-700">Nama Produk</th>
            <th className="border border-gray-400 p-3 text-center w-32 uppercase font-bold text-gray-700">Terjual</th>
            <th className="border border-gray-400 p-3 text-right w-48 uppercase font-bold text-gray-700">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(rekapItemsMap).sort((a: any, b: any) => b[1].qty - a[1].qty).map(([name, stat]: any, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              <td className="border border-gray-300 p-3 text-center font-medium">{i + 1}</td>
              <td className="border border-gray-300 p-3 font-semibold">{name}</td>
              <td className="border border-gray-300 p-3 text-center bg-gray-50/50">{stat.qty}</td>
              <td className="border border-gray-300 p-3 text-right font-mono text-sm">Rp {stat.subtotal.toLocaleString('id-ID')}</td>
            </tr>
          ))}
          {Object.keys(rekapItemsMap).length === 0 && (
            <tr>
              <td colSpan={4} className="border border-gray-300 p-8 text-center text-gray-500 italic">Tidak ada data item terjual</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 border-gray-800">
            <td colSpan={3} className="border border-gray-400 p-3 text-right font-black uppercase text-gray-700">Total Keseluruhan</td>
            <td className="border border-gray-400 p-3 text-right font-black text-base text-green-800">Rp {rekapData.totalPendapatan.toLocaleString('id-ID')}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    </>
  );
}
