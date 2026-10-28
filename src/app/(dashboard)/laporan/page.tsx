"use client";

import { useState, useEffect } from "react";
import { toast } from 'sonner';
import { Download, FileText, Loader2, Trash2, Receipt, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";
import { useConfirmStore } from "@/store/confirmStore";
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
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Struk States, Warung List & Santri Master
  const [warungs, setWarungs] = useState<any[]>([]);
  const [santriList, setSantriList] = useState<any[]>([]);
  const [selectedStruk, setSelectedStruk] = useState<any | null>(null);
  const [loadingStruk, setLoadingStruk] = useState(false);

  const getSantriName = (rawId: any) => {
    if (!rawId || String(rawId).trim().toUpperCase() === "GUEST") return "GUEST";
    const cleanId = String(rawId).trim().replace(/^0+/, '');
    const found = santriList.find((s: any) => {
      const sNis = String(s.nis || '').trim().replace(/^0+/, '');
      const sUid = String(s.uid || '').trim().replace(/^0+/, '');
      return sNis === cleanId || sUid === cleanId || String(s.id) === cleanId;
    });
    return found?.nama || rawId;
  };

  const handleOpenStruk = async (item: any, meta: any) => {
    const warungObj = warungs.find((w: any) => String(w.id || w.ID) === String(meta.warungId));
    const warungName = warungObj?.nama || user?.warungName || "KANTIN PONDOK";

    const rawPembeli = meta.pembeli || "";
    let namaSantri = getSantriName(rawPembeli);

    setSelectedStruk({
      trxId: meta.trxId,
      waktu: meta.waktu,
      pembeli: namaSantri,
      total: meta.total,
      metode: meta.metode || "Tunai",
      warungName,
      items: []
    });
    setLoadingStruk(true);

    try {
      // Jika namaSantri masih berupa angka NIS (belum sempat termuat di santriList)
      const cleanRaw = String(rawPembeli).trim().replace(/^0+/, '');
      if (rawPembeli && String(rawPembeli).toUpperCase() !== "GUEST" && /^\d+$/.test(cleanRaw) && namaSantri === rawPembeli) {
        const { supabase } = await import('@/lib/supabase');
        const { data: sData } = await supabase
          .from('Data Santri')
          .select('nama')
          .or(`nis.eq.${rawPembeli},nis.eq.${cleanRaw},uid.eq.${rawPembeli}`)
          .maybeSingle();
        if (sData?.nama) {
          namaSantri = sData.nama;
          setSelectedStruk((prev: any) => prev ? { ...prev, pembeli: sData.nama } : null);
        }
      }

      const res = await api.post('getDetailTransaksi', { trxId: meta.trxId });
      if (res?.data && Array.isArray(res.data)) {
        setSelectedStruk((prev: any) => prev ? { ...prev, items: res.data } : null);
      }
    } catch (err) {
      console.error("Gagal memuat detail transaksi", err);
    } finally {
      setLoadingStruk(false);
    }
  };
  
  const getValGlobal = (item: any, keys: string[]) => {
    for (const k of keys) {
      for (const itemKey in item) {
        if (itemKey.replace(/\s+/g, '').toLowerCase() === k.toLowerCase()) {
          return item[itemKey];
        }
      }
    }
    return null;
  };

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
          setData(filtered);
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
    api.get('getWarung').then(res => {
      if (res?.data && Array.isArray(res.data)) setWarungs(res.data);
    }).catch(() => {});
    api.get('getSantri').then(res => {
      if (res?.data && Array.isArray(res.data)) setSantriList(res.data);
    }).catch(() => {});
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
    const confirmed = await useConfirmStore.getState().showConfirm({
      title: "HAPUS TRANSAKSI",
      message: `Yakin ingin menghapus ${ids.length} transaksi secara permanen? Saldo tidak akan dikembalikan.`,
    });
    if (!confirmed) return;
    
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

  const filteredData = data.filter(t => {
    if (!search) return true;
    const trxId = getValGlobal(t, ['idtransaksi', 'trxid', 'id']) || "";
    const pembeliId = getValGlobal(t, ['idsantri', 'santriid', 'santri', 'pembeli']) || "";
    const pembeliNama = getSantriName(pembeliId);
    const query = search.toLowerCase();
    return String(trxId).toLowerCase().includes(query) || 
           String(pembeliId).toLowerCase().includes(query) || 
           String(pembeliNama).toLowerCase().includes(query);
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col gap-6 relative">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-border pb-4 print:hidden">
        <div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight">LAPORAN TRANSAKSI</h1>
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">
            DATA EKSPOR HARIAN
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input 
            type="text" 
            placeholder="Cari ID / NIS..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="border-2 border-border p-2 font-mono text-sm uppercase w-full md:w-48 bg-background"
          />
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
                  <th className="p-3 w-24 text-center print:hidden">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border print:divide-black">
                {paginatedData.map((item, idx) => {
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
                  const pembeliId = getVal(['idsantri', 'santriid', 'santri', 'pembeli']) || "GUEST";
                  const pembeliNama = getSantriName(pembeliId);
                  const total = getVal(['total', 'totalharga', 'harga', 'nominal']) || 0;
                  const metode = getVal(['metode', 'method']) || "Tunai";
                  const warungId = getVal(['warungid', 'warungId', 'warung']) || "";

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
                      <td className="p-3 uppercase">
                        <span className="font-semibold block">{pembeliNama}</span>
                        {pembeliNama !== pembeliId && pembeliId !== "GUEST" && (
                          <span className="text-[10px] text-muted-foreground font-mono block">NIS: {pembeliId}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-primary print:text-black">
                        Rp {Number(total).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" 
                            title="Lihat & Cetak Struk" 
                            onClick={() => handleOpenStruk(item, { trxId, waktu, pembeli: pembeliNama, total, metode, warungId })}
                          >
                            <Receipt className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                            title="Hapus Transaksi" 
                            onClick={() => handleDelete([trxId])}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
          
          {totalPages > 0 && (
            <div className="flex items-center justify-between p-4 border-t-2 border-border bg-muted/20 print:hidden">
              <Button 
                variant="outline" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="font-mono text-sm uppercase">Halaman {currentPage} dari {totalPages}</span>
              <Button 
                variant="outline" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    
      {/* MODAL LIHAT & CETAK STRUK TRANSAKSI */}
      {selectedStruk && (
        <>
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page {
                size: 58mm auto;
                margin: 0;
              }
              body * {
                visibility: hidden !important;
              }
              #struk-thermal-print, #struk-thermal-print * {
                visibility: visible !important;
              }
              #struk-thermal-print {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 58mm !important;
                max-width: 58mm !important;
                margin: 0 !important;
                padding: 8px !important;
                background: white !important;
                color: black !important;
                display: block !important;
                z-index: 999999 !important;
                font-family: monospace !important;
                font-size: 11px !important;
                line-height: 1.2 !important;
              }
            }
          `}} />

          {/* Modal Backdrop & Card Preview di Layar */}
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-card border-4 border-border w-full max-w-sm max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
              {/* Header Modal */}
              <div className="bg-primary text-primary-foreground p-3.5 flex items-center justify-between border-b-4 border-border">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  <h2 className="text-base font-black uppercase tracking-tight">STRUK TRANSAKSI</h2>
                </div>
                <button 
                  onClick={() => setSelectedStruk(null)}
                  className="p-1 hover:bg-black/20 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Isi Struk (Tampilan Thermal) */}
              <div className="p-4 sm:p-5 bg-white text-black flex justify-center border-b-4 border-border overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                <div className="font-mono text-xs w-full max-w-[58mm] mx-auto text-black">
                  {/* Header Toko */}
                  <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                    <h1 className="font-black text-sm uppercase">{selectedStruk.warungName}</h1>
                    <p className="text-[10px] text-gray-700">Pondok Pesantren</p>
                    <p className="text-[10px] text-gray-500">================================</p>
                  </div>

                  {/* Info Transaksi */}
                  <div className="text-[10px] mb-2 flex justify-between leading-tight border-b border-dashed border-gray-300 pb-2">
                    <div>
                      <p className="font-bold">{selectedStruk.trxId}</p>
                      <p className="text-gray-600">
                        {selectedStruk.waktu !== "-" && new Date(selectedStruk.waktu).toString() !== "Invalid Date"
                          ? new Date(selectedStruk.waktu).toLocaleString('id-ID')
                          : selectedStruk.waktu}
                      </p>
                      <p className="text-gray-700">Pembeli: <span className="font-semibold uppercase">{selectedStruk.pembeli}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{selectedStruk.metode}</p>
                      <p className="text-gray-600">Kasir: {user?.name || "Admin"}</p>
                    </div>
                  </div>

                  {/* Loading Item */}
                  {loadingStruk ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-[10px]">Memuat rincian item...</span>
                    </div>
                  ) : (
                    <>
                      {/* Daftar Item Belanja */}
                      <div className="border-b border-dashed border-black pb-2 mb-2">
                        {selectedStruk.items && selectedStruk.items.length > 0 ? (
                          selectedStruk.items.map((item: any, idx: number) => {
                            const nama = item.namaproduk || item.NamaProduk || item.nama || "Item";
                            const qty = Number(item.kuantitas || item.Kuantitas || item.qty || 1);
                            const harga = Number(item.hargasatuan || item.HargaSatuan || item.harga || 0);
                            const subtotal = Number(item.subtotal || item.Subtotal || (qty * harga));
                            return (
                              <div key={idx} className="mb-1.5 leading-tight">
                                <p className="font-bold uppercase text-[11px]">{nama}</p>
                                <div className="flex justify-between pl-2 text-[10px]">
                                  <span>{qty} x {harga.toLocaleString('id-ID')}</span>
                                  <span className="font-semibold">Rp {subtotal.toLocaleString('id-ID')}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-1 flex justify-between text-[11px]">
                            <span>Total Belanja</span>
                            <span className="font-semibold">Rp {Number(selectedStruk.total || 0).toLocaleString('id-ID')}</span>
                          </div>
                        )}
                      </div>

                      {/* Total */}
                      <div className="flex justify-between font-black text-sm mb-1 pt-1">
                        <span>TOTAL</span>
                        <span>Rp {Number(selectedStruk.total || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-600 mb-3">
                        <span>Metode Bayar</span>
                        <span className="font-bold uppercase">{selectedStruk.metode}</span>
                      </div>

                      {/* Footer Struk */}
                      <div className="text-center text-[10px] text-gray-700 mt-4 border-t border-dashed border-gray-300 pt-2">
                        <p>Terima kasih atas kunjungannya!</p>
                        <p>Barang yang sudah dibeli tidak</p>
                        <p>dapat ditukar / dikembalikan.</p>
                        <p className="mt-2 font-bold text-gray-900">- SALAPP POS -</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="p-3 bg-muted/30 flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 font-bold text-xs" 
                  onClick={() => setSelectedStruk(null)}
                >
                  TUTUP
                </Button>
                <Button 
                  className="flex-1 gap-2 font-bold text-xs" 
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" /> CETAK STRUK
                </Button>
              </div>
            </div>
          </div>

          {/* Kontainer Cetak Struk (Khusus Print Thermal via Printer) */}
          <div id="struk-thermal-print" className="hidden">
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
              <h1 className="font-black text-sm uppercase">{selectedStruk.warungName}</h1>
              <p className="text-[10px]">Pondok Pesantren</p>
              <p className="text-[10px]">================================</p>
            </div>

            <div className="text-[10px] mb-2 flex justify-between leading-tight border-b border-dashed border-black pb-2">
              <div>
                <p className="font-bold">{selectedStruk.trxId}</p>
                <p>
                  {selectedStruk.waktu !== "-" && new Date(selectedStruk.waktu).toString() !== "Invalid Date"
                    ? new Date(selectedStruk.waktu).toLocaleString('id-ID')
                    : selectedStruk.waktu}
                </p>
                <p>Pembeli: {selectedStruk.pembeli}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{selectedStruk.metode}</p>
                <p>Kasir: {user?.name || "Admin"}</p>
              </div>
            </div>

            <div className="border-b border-dashed border-black pb-2 mb-2">
              {selectedStruk.items && selectedStruk.items.length > 0 ? (
                selectedStruk.items.map((item: any, idx: number) => {
                  const nama = item.namaproduk || item.NamaProduk || item.nama || "Item";
                  const qty = Number(item.kuantitas || item.Kuantitas || item.qty || 1);
                  const harga = Number(item.hargasatuan || item.HargaSatuan || item.harga || 0);
                  const subtotal = Number(item.subtotal || item.Subtotal || (qty * harga));
                  return (
                    <div key={idx} className="mb-1 leading-tight">
                      <p className="font-bold uppercase text-[11px]">{nama}</p>
                      <div className="flex justify-between pl-2 text-[10px]">
                        <span>{qty} x {harga.toLocaleString('id-ID')}</span>
                        <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-1 flex justify-between text-[11px]">
                  <span>Total Belanja</span>
                  <span>Rp {Number(selectedStruk.total || 0).toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between font-black text-sm mb-1">
              <span>TOTAL</span>
              <span>Rp {Number(selectedStruk.total || 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-[10px] mb-3">
              <span>Metode</span>
              <span className="font-bold uppercase">{selectedStruk.metode}</span>
            </div>

            <div className="text-center text-[10px] mt-4 border-t border-dashed border-black pt-2">
              <p>Terima kasih atas kunjungannya!</p>
              <p>Barang yang sudah dibeli tidak</p>
              <p>dapat ditukar / dikembalikan.</p>
              <p className="mt-2 font-bold">- SALAPP POS -</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
