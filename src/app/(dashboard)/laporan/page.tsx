"use client";

import { useState, useEffect } from "react";
import { toast } from 'sonner';
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export default function LaporanPage() {
  const user = useAuthStore(state => state.user);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchTransaksi = (background = false) => {
    if (!background) setLoading(true);
    api.get('getTransaksi')
      .then(res => {
        if (res?.data) {
          const userState = useAuthStore.getState().user;
          const filtered = res.data.filter((trx: any) => {
            const wId = trx.warungid || trx.WarungID;
            return !userState?.warungId || userState.warungId === 'ALL' || wId === userState.warungId;
          });
          setData(filtered.reverse());
        }
      })
      .catch(() => {
        if (!background) toast.error("Gagal memuat riwayat transaksi.");
      })
      .finally(() => {
        if (!background) setLoading(false);
      });
  };

  useEffect(() => {
    fetchTransaksi();
    const interval = setInterval(() => {
      fetchTransaksi(true);
    }, 10000); // 10s polling for realtime
    return () => clearInterval(interval);
  }, []);

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Laporan Transaksi");

    // Title Row
    sheet.mergeCells("A1:D1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `LAPORAN TRANSAKSI - ${user?.warungName || "KANTIN"}`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const headers = ["ID Transaksi", "Waktu", "ID Santri/Pembeli", "Total Belanja (Rp)"];
    sheet.getRow(3).values = headers;
    sheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(3).alignment = { horizontal: 'center' };
    
    headers.forEach((_, index) => {
      const cell = sheet.getCell(3, index + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    sheet.columns = [
      { width: 25 }, { width: 20 }, { width: 25 }, { width: 20 }
    ];
    
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

    let totalKeseluruhan = 0;

    data.forEach(t => {
      const nominal = Number(getVal(t, ['total', 'totalharga', 'harga', 'nominal'])) || 0;
      totalKeseluruhan += nominal;

      const row = sheet.addRow([
        getVal(t, ['idtransaksi', 'trxid', 'id']) || `TRX`,
        new Date(getVal(t, ['waktu', 'tanggal', 'timestamp'])).toLocaleString('id-ID'),
        getVal(t, ['idsantri', 'santriid', 'santri', 'pembeli']) || "GUEST",
        nominal
      ]);
      row.getCell(4).numFmt = '#,##0';
      row.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    sheet.addRow([]);
    const summaryRow = sheet.addRow(["", "", "TOTAL SELURUHNYA", totalKeseluruhan]);
    summaryRow.getCell(3).font = { bold: true };
    summaryRow.getCell(4).font = { bold: true };
    summaryRow.getCell(4).numFmt = '#,##0';
    summaryRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAFAF1' } };
    summaryRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAFAF1' } };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Laporan_Transaksi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`LAPORAN TRANSAKSI - ${user?.warungName || "KANTIN"}`, 14, 20);

    const getVal = (item: any, keys: string[]) => {
      for (const k of keys) {
        for (const itemKey in item) {
          if (itemKey.replace(/\s+/g, '').toLowerCase() === k.toLowerCase()) return item[itemKey];
        }
      }
      return null;
    };

    let totalKeseluruhan = 0;
    const tableColumn = ["ID Transaksi", "Waktu", "Pembeli", "Total Belanja (Rp)"];
    const tableRows: any[] = data.map((t, idx) => {
      const nominal = Number(getVal(t, ['total', 'totalharga', 'harga', 'nominal'])) || 0;
      totalKeseluruhan += nominal;
      return [
        getVal(t, ['idtransaksi', 'trxid', 'id']) || `TRX-${idx}`,
        new Date(getVal(t, ['waktu', 'tanggal', 'timestamp'])).toLocaleString('id-ID'),
        getVal(t, ['idsantri', 'santriid', 'santri', 'pembeli']) || "GUEST",
        nominal.toLocaleString('id-ID')
      ];
    });

    tableRows.push([{ content: '', colSpan: 4, styles: { fillColor: [255, 255, 255] } }]); 
    tableRows.push([
      { content: '', colSpan: 2, styles: { fillColor: [255, 255, 255] } },
      { content: 'TOTAL SELURUHNYA', styles: { fontStyle: 'bold', textColor: [39, 174, 96] } },
      { content: `Rp ${totalKeseluruhan.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [39, 174, 96] } }
    ]);

    autoTable(doc, {
      startY: 28,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { font: "helvetica", fontSize: 9 }
    });

    doc.save(`Laporan_Transaksi_${new Date().toISOString().split('T')[0]}.pdf`);
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

  // Setor Kas states
  const getLocalTodayDate = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const [showSetorModal, setShowSetorModal] = useState(false);
  const [setorDate, setSetorDate] = useState(getLocalTodayDate());
  const [isSubmittingKas, setIsSubmittingKas] = useState(false);

  const calculateTotalForDate = (dateString: string) => {
    let total = 0;
    const target = new Date(dateString).toDateString();
    
    data.forEach(t => {
      const getVal = (item: any, keys: string[]) => {
        for (const k of keys) {
          for (const itemKey in item) {
            if (itemKey.replace(/\s+/g, '').toLowerCase() === k.toLowerCase()) return item[itemKey];
          }
        }
        return null;
      };
      
      const tDate = new Date(getVal(t, ['waktu', 'tanggal', 'timestamp']));
      const status = getVal(t, ['statusambil']) || "";
      if (tDate.toDateString() === target && status !== "Batal") {
        total += Number(getVal(t, ['total', 'totalharga', 'harga', 'nominal'])) || 0;
      }
    });
    return total;
  };

  const calculatedSetorTotal = calculateTotalForDate(setorDate);

  const handleSubmitSetor = async () => {
    if (calculatedSetorTotal <= 0) {
      toast.error("Tidak ada pemasukan pada tanggal tersebut");
      return;
    }
    
    setIsSubmittingKas(true);
    try {
      const payload = {
        warungId: user?.warungId || "ALL",
        tanggal: setorDate,
        tipeKas: "MASUK",
        kategori: "Penjualan",
        keterangan: `Rekap Penjualan Harian - ${setorDate}`,
        nominal: calculatedSetorTotal
      };
      
      const res = await api.post('tambahKasWarung', payload);
      if (res.status === "error") throw new Error(res.message);
      
      toast.success("Berhasil disetor ke Buku Kas!");
      setShowSetorModal(false);
    } catch (err: any) {
      toast.error("Gagal menyetor ke Buku Kas");
    } finally {
      setIsSubmittingKas(false);
    }
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col gap-6 relative">
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
          <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowSetorModal(true)}>
             SETOR KE BUKU KAS
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
            <Download className="w-4 h-4" /> EXCEL
          </Button>
          <Button variant="secondary" className="gap-2" onClick={handleExportPDF}>
            <FileText className="w-4 h-4" /> PDF
          </Button>
        </div>
      </header>

      {/* Modal Setor Kas */}
      {showSetorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-card border-2 border-border p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-black uppercase mb-2">Setor Ke Buku Kas</h2>
            <p className="text-sm font-mono text-muted-foreground mb-6">Hitung otomatis total penjualan harian untuk dimasukkan ke Buku Kas.</p>
            
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col gap-2">
                <label className="font-bold text-sm uppercase">Pilih Tanggal</label>
                <input 
                  type="date" 
                  className="border-2 border-border p-2 bg-background font-mono"
                  value={setorDate}
                  onChange={(e) => setSetorDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 bg-muted p-4 border-2 border-border text-center">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total Penjualan Ditemukan</span>
                <span className="text-2xl font-black text-emerald-600">Rp {calculatedSetorTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSetorModal(false)} disabled={isSubmittingKas}>Batal</Button>
              <Button 
                onClick={handleSubmitSetor} 
                disabled={calculatedSetorTotal <= 0 || isSubmittingKas}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmittingKas ? <Loader2 className="w-4 h-4 animate-spin" /> : "Setor Sekarang"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
