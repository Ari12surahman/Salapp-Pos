"use client";

import { useState, useEffect } from "react";
import { toast } from 'sonner';
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";

export default function LaporanPage() {
  const user = useAuthStore(state => state.user);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchTransaksi = () => {
    setLoading(true);
    api.get('getTransaksi')
      .then(res => {
        if (res?.data) {
          const userState = useAuthStore.getState().user;
          const filtered = res.data.filter((trx: any) => {
            const wId = trx.warungid || trx.WarungID;
            return !userState?.warungId || userState.warungId === 'ALL' || wId === userState.warungId;
          });
          setData(filtered.reverse());
          setSelectedIds([]);
        }
      })
      .catch(() => {
        toast.error("Gagal memuat riwayat transaksi.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransaksi();
  }, []);

  const handleExportCSV = () => {
    const headers = ["ID Transaksi", "Waktu", "ID Santri/Pembeli", "Total Belanja"];
    
    const getVal = (item: any, keys: string[]) => {
      for (const k of keys) {
        for (const itemKey in item) {
          if (itemKey.replace(/\s+/g, '').toLowerCase() === k.toLowerCase()) {
            return item[itemKey];
          }
        }
      }
      return null;
    };

    const rows = data.map((t, idx) => [
      getVal(t, ['idtransaksi', 'trxid', 'id']) || `TRX-${idx}`,
      getVal(t, ['waktu', 'tanggal', 'timestamp']) || "-",
      getVal(t, ['idsantri', 'santriid', 'santri', 'pembeli']) || "GUEST",
      getVal(t, ['total', 'totalharga', 'harga', 'nominal']) || 0
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Transaksi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Yakin ingin menghapus ${ids.length} transaksi secara permanen? Saldo tidak akan dikembalikan.`)) return;
    
    setDeleting(true);
    try {
      const res = await api.post('hapusTransaksi', { trxIds: ids });
      if (res.status === "error" || (res.data && res.data.status === "error")) {
        throw new Error((res.data && res.data.message) || res.message || "Gagal menghapus");
      }
      fetchTransaksi();
    } catch (err: any) {
      toast.error("Gagal menghapus: " + (err.message || "Kesalahan server"));
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length) {
      setSelectedIds([]);
    } else {
      const allIds = data.map((item, idx) => {
        const getVal = (keys: string[]) => {
          for (const k of keys) {
            for (const itemKey in item) {
              if (itemKey.replace(/\s+/g, '').toLowerCase() === k.toLowerCase()) return item[itemKey];
            }
          }
          return null;
        };
        return getVal(['idtransaksi', 'trxid', 'id']) || `TRX-${idx}`;
      });
      setSelectedIds(allIds);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-border pb-4 print:hidden">
        <div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight">LAPORAN TRANSAKSI</h1>
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">
            DATA EKSPOR HARIAN
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" className="gap-2" onClick={() => handleDelete(selectedIds)} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              HAPUS ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button variant="secondary" className="gap-2" onClick={handleExportPDF}>
            <FileText className="w-4 h-4" /> PDF
          </Button>
        </div>
      </header>

      {/* Print Header - Only visible when printing PDF */}
      <div className="hidden print:block mb-8 text-center border-b-2 border-black pb-4">
        <h1 className="text-2xl font-black uppercase">LAPORAN TRANSAKSI {user?.warungName || "KANTIN PONDOK"}</h1>
        <p className="font-mono text-sm">Tanggal Cetak: {new Date().toLocaleString('id-ID')}</p>
      </div>

      {loading ? (
        <div className="border-2 border-border bg-card p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="font-mono text-sm uppercase tracking-widest">Memuat Riwayat Transaksi...</span>
        </div>
      ) : (
        <div className="border-2 border-border bg-card print:border-none print:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-sm">
              <thead className="bg-muted border-b-2 border-border print:bg-transparent print:border-black">
                <tr>
                  <th className="p-3 w-10 print:hidden">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4" 
                      checked={data.length > 0 && selectedIds.length === data.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-3 uppercase tracking-wider">ID TRANSAKSI</th>
                  <th className="p-3 uppercase tracking-wider">WAKTU</th>
                  <th className="p-3 uppercase tracking-wider">PEMBELI</th>
                  <th className="p-3 uppercase tracking-wider text-right">TOTAL</th>
                  <th className="p-3 w-16 text-center print:hidden">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border print:divide-black">
                {data.map((item, idx) => {
                  const getVal = (keys: string[]) => {
                    for (const k of keys) {
                      for (const itemKey in item) {
                        if (itemKey.replace(/\s+/g, '').toLowerCase() === k.toLowerCase()) {
                          return item[itemKey];
                        }
                      }
                    }
                    return null;
                  };

                  const trxId = getVal(['idtransaksi', 'trxid', 'id']) || `TRX-${idx}`;
                  const waktu = getVal(['waktu', 'tanggal', 'timestamp']) || "-";
                  const pembeli = getVal(['idsantri', 'santriid', 'santri', 'pembeli']) || "GUEST";
                  const total = getVal(['total', 'totalharga', 'harga', 'nominal']) || 0;

                  return (
                    <tr key={`${trxId}-${idx}`} className="hover:bg-accent transition-colors print:hover:bg-transparent">
                      <td className="p-3 print:hidden">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4"
                          checked={selectedIds.includes(trxId)}
                          onChange={() => toggleSelect(trxId)}
                        />
                      </td>
                      <td className="p-3 font-bold">{trxId}</td>
                      <td className="p-3 text-muted-foreground print:text-black">
                        {waktu !== "-" && new Date(waktu).toString() !== "Invalid Date" 
                          ? new Date(waktu).toLocaleString('id-ID') 
                          : waktu}
                      </td>
                      <td className="p-3 uppercase">{pembeli}</td>
                      <td className="p-3 text-right font-bold text-primary print:text-black">
                        Rp {Number(total).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-center print:hidden">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete([trxId])}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground uppercase tracking-widest">
                      BELUM ADA TRANSAKSI HARI INI
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
