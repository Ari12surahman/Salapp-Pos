"use client";

import { useState, useEffect } from "react";
import { toast } from 'sonner';
import { Download, FileText, Loader2, Trash2, Plus, ArrowUpRight, ArrowDownRight, Settings, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";
import { useConfirmStore } from "@/store/confirmStore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export default function CashflowPage() {
  const user = useAuthStore(state => state.user);
  const [data, setData] = useState<any[]>([]);
  const [kategoriList, setKategoriList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Filters
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showKategoriForm, setShowKategoriForm] = useState(false);
  
  // Form States
  const [formType, setFormType] = useState("MASUK");
  const [formKategori, setFormKategori] = useState("");
  const [formKeterangan, setFormKeterangan] = useState("");
  const [formNominal, setFormNominal] = useState("");
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);

  const [newKategoriNama, setNewKategoriNama] = useState("");
  const [newKategoriTipe, setNewKategoriTipe] = useState("MASUK");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.post('getKasWarung', { warungId: user?.warungId || "ALL" });
      if (res?.data) {
        setData(res.data);
      }
      const catRes = await api.post('getKategoriKasWarung', { warungId: user?.warungId || "ALL" });
      if (catRes?.data) {
        setKategoriList(catRes.data);
      }
    } catch (err) {
      toast.error("Gagal memuat data buku kas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 10000); // 10s polling for realtime
    return () => clearInterval(interval);
  }, [user]);

  // Apply filters
  const filteredData = data.filter(item => {
    // 1. Period filter
    if (filterPeriod !== "all") {
      const itemDate = new Date(item.tanggal || item.Tanggal);
      const today = new Date();
      if (filterPeriod === "today") {
        if (itemDate.toDateString() !== today.toDateString()) return false;
      } else if (filterPeriod === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        if (itemDate < weekAgo) return false;
      } else if (filterPeriod === "month") {
        if (itemDate.getMonth() !== today.getMonth() || itemDate.getFullYear() !== today.getFullYear()) return false;
      } else if (filterPeriod === "year") {
        if (itemDate.getFullYear() !== today.getFullYear()) return false;
      } else if (filterPeriod === "custom") {
        if (filterStartDate) {
          const start = new Date(filterStartDate);
          start.setHours(0, 0, 0, 0);
          if (itemDate < start) return false;
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end) return false;
        }
      }
    }

    // 2. Type filter
    if (filterType !== "all") {
      if ((item.tipekas || item.TipeKas) !== filterType) return false;
    }

    // 3. Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const kat = (item.kategori || item.Kategori || "").toLowerCase();
      const ket = (item.keterangan || item.Keterangan || "").toLowerCase();
      if (!kat.includes(query) && !ket.includes(query)) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalMasuk = filteredData.filter(d => (d.tipekas || d.TipeKas) === 'MASUK').reduce((acc, curr) => acc + Number(curr.nominal || curr.Nominal || 0), 0);
  const totalKeluar = filteredData.filter(d => (d.tipekas || d.TipeKas) === 'KELUAR').reduce((acc, curr) => acc + Number(curr.nominal || curr.Nominal || 0), 0);
  const saldo = totalMasuk - totalKeluar;

  const handleSubmitKas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKategori || !formNominal || !formKeterangan) {
      toast.error("Mohon lengkapi form");
      return;
    }
    
    try {
      const payload = {
        warungId: user?.warungId,
        tanggal: formTanggal,
        tipeKas: formType,
        kategori: formKategori,
        keterangan: formKeterangan,
        nominal: Number(formNominal)
      };
      
      const res = await api.post('tambahKasWarung', payload);
      if (res.status === "error") throw new Error(res.message);
      
      toast.success("Berhasil mencatat kas");
      setShowForm(false);
      setFormKeterangan("");
      setFormNominal("");
      fetchData();
    } catch (err: any) {
      toast.error("Gagal mencatat kas");
    }
  };

  const handleAddKategori = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKategoriNama) return;
    
    try {
      const res = await api.post('tambahKategoriKasWarung', {
        warungId: user?.warungId,
        tipe: newKategoriTipe,
        nama: newKategoriNama
      });
      if (res.status === "error") throw new Error(res.message);
      
      toast.success("Kategori ditambahkan");
      setNewKategoriNama("");
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menambah kategori");
    }
  };

  const handleDeleteKategori = async (id: string) => {
    const confirmed = await useConfirmStore.getState().showConfirm({
      title: "HAPUS KATEGORI",
      message: "Yakin ingin menghapus kategori kas ini?",
    });
    if (!confirmed) return;
    try {
      await api.post('hapusKategoriKasWarung', { id });
      fetchData();
    } catch (err) {
      toast.error("Gagal menghapus");
    }
  };

  const handleDeleteKas = async (ids: string[]) => {
    const confirmed = await useConfirmStore.getState().showConfirm({
      title: "HAPUS DATA KAS",
      message: `Yakin ingin menghapus ${ids.length} data kas secara permanen?`,
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      for (const id of ids) {
        await api.post('hapusKasWarung', { id });
      }
      toast.success("Berhasil dihapus");
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      toast.error("Gagal menghapus kas");
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Buku Kas");

    // Title Row
    sheet.mergeCells("A1:E1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `BUKU KAS - ${user?.warungName || "WARUNG"} (Filter: ${filterPeriod.toUpperCase()})`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Headers
    const headers = ["Tanggal", "Tipe", "Kategori", "Keterangan", "Nominal (Rp)"];
    sheet.getRow(3).values = headers;
    sheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(3).alignment = { horizontal: 'center' };
    
    headers.forEach((_, index) => {
      const cell = sheet.getCell(3, index + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    // Columns width
    sheet.columns = [
      { width: 15 }, { width: 12 }, { width: 20 }, { width: 35 }, { width: 20 }
    ];

    // Data Rows
    filteredData.forEach((t, i) => {
      const row = sheet.addRow([
        t.tanggal || t.Tanggal,
        t.tipekas || t.TipeKas,
        t.kategori || t.Kategori,
        t.keterangan || t.Keterangan,
        Number(t.nominal || t.Nominal)
      ]);
      row.getCell(5).numFmt = '#,##0';
      
      // Color text based on Tipe
      const tipe = (t.tipekas || t.TipeKas || "").toUpperCase();
      if (tipe === "PEMASUKAN") {
        row.getCell(2).font = { color: { argb: 'FF27AE60' }, bold: true };
      } else {
        row.getCell(2).font = { color: { argb: 'FFE74C3C' }, bold: true };
      }
      
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });
    });

    // Summary Rows
    sheet.addRow([]);
    
    const addSummary = (label: string, value: number, bgColor: string) => {
      const r = sheet.addRow(["", "", "", label, value]);
      r.getCell(4).font = { bold: true };
      r.getCell(5).font = { bold: true };
      r.getCell(5).numFmt = '#,##0';
      r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      r.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    };

    addSummary("TOTAL MASUK", totalMasuk, "FFEAFAF1"); // Light Green
    addSummary("TOTAL KELUAR", totalKeluar, "FFFDEDEC"); // Light Red
    addSummary("SISA SALDO", saldo, "FFEBF5FB"); // Light Blue

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `BukuKas_${filterPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`BUKU KAS - ${user?.warungName || "WARUNG"}`, 14, 20);

    const tableColumn = ["Tanggal", "Tipe", "Kategori", "Keterangan", "Nominal (Rp)"];
    const tableRows: any[] = filteredData.map(t => [
      t.tanggal || t.Tanggal,
      t.tipekas || t.TipeKas,
      t.kategori || t.Kategori,
      t.keterangan || t.Keterangan,
      Number(t.nominal || t.Nominal).toLocaleString('id-ID')
    ]);

    // Insert summary into table
    tableRows.push([{ content: '', colSpan: 5, styles: { fillColor: [255, 255, 255] } }]); // Empty row separator
    tableRows.push([
      { content: '', colSpan: 3, styles: { fillColor: [255, 255, 255] } },
      { content: 'TOTAL MASUK', styles: { fontStyle: 'bold', textColor: [39, 174, 96] } },
      { content: `Rp ${totalMasuk.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [39, 174, 96] } }
    ]);
    tableRows.push([
      { content: '', colSpan: 3, styles: { fillColor: [255, 255, 255] } },
      { content: 'TOTAL KELUAR', styles: { fontStyle: 'bold', textColor: [231, 76, 60] } },
      { content: `Rp ${totalKeluar.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [231, 76, 60] } }
    ]);
    tableRows.push([
      { content: '', colSpan: 3, styles: { fillColor: [255, 255, 255] } },
      { content: 'SISA SALDO', styles: { fontStyle: 'bold', textColor: [41, 128, 185] } },
      { content: `Rp ${saldo.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [41, 128, 185] } }
    ]);

    autoTable(doc, {
      startY: 28,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { font: "helvetica", fontSize: 9 },
      willDrawCell: function (data) {
        if (data.row.index < filteredData.length) {
          if (data.column.index === 1) { // TipeKas column
            const tipe = String(data.cell.raw || "").toUpperCase();
            if (tipe === "PEMASUKAN") {
              doc.setTextColor(39, 174, 96);
            } else if (tipe === "PENGELUARAN") {
              doc.setTextColor(231, 76, 60);
            }
          }
        }
      }
    });

    doc.save(`BukuKas_${filterPeriod}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length && filteredData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(item => item.id));
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-border pb-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight">BUKU KAS</h1>
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">
            ARUS KAS OPERASIONAL {user?.warungName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowKategoriForm(true)}>
            <Settings className="w-4 h-4" /> KATEGORI
          </Button>
          <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setFormType("MASUK"); setShowForm(true); }}>
            <ArrowDownRight className="w-4 h-4" /> CATAT PEMASUKAN
          </Button>
          <Button variant="destructive" className="gap-2" onClick={() => { setFormType("KELUAR"); setShowForm(true); }}>
            <ArrowUpRight className="w-4 h-4" /> CATAT PENGELUARAN
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border-2 border-border bg-card p-6 flex flex-col gap-2">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">TOTAL PEMASUKAN</span>
          <span className="text-3xl font-black text-emerald-600">Rp {totalMasuk.toLocaleString('id-ID')}</span>
        </div>
        <div className="border-2 border-border bg-card p-6 flex flex-col gap-2">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">TOTAL PENGELUARAN</span>
          <span className="text-3xl font-black text-destructive">Rp {totalKeluar.toLocaleString('id-ID')}</span>
        </div>
        <div className="border-2 border-border bg-primary text-primary-foreground p-6 flex flex-col gap-2">
          <span className="font-mono text-xs text-primary-foreground/70 uppercase tracking-widest">SALDO KAS</span>
          <span className="text-3xl font-black">Rp {saldo.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-muted p-4 border-2 border-border">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-background border-2 border-border px-3 py-1.5">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select className="bg-transparent border-none outline-none text-sm font-mono uppercase cursor-pointer" value={filterPeriod} onChange={(e) => { setFilterPeriod(e.target.value); setCurrentPage(1); }}>
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini</option>
              <option value="week">Minggu Ini</option>
              <option value="month">Bulan Ini</option>
              <option value="year">Tahun Ini</option>
              <option value="custom">Pilih Tanggal</option>
            </select>
          </div>
          {filterPeriod === "custom" && (
            <div className="flex items-center gap-2 bg-background border-2 border-border px-3 py-1.5 text-sm font-mono">
              <span>Dari</span>
              <input type="date" className="bg-transparent border-none outline-none cursor-pointer" value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); setCurrentPage(1); }} />
              <span>Sampai</span>
              <input type="date" className="bg-transparent border-none outline-none cursor-pointer" value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); setCurrentPage(1); }} />
            </div>
          )}
          <select className="bg-background border-2 border-border px-3 py-2 text-sm font-mono uppercase cursor-pointer" value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}>
            <option value="all">Semua Tipe</option>
            <option value="MASUK">Hanya Pemasukan</option>
            <option value="KELUAR">Hanya Pengeluaran</option>
          </select>
          <input 
            type="text" 
            placeholder="Cari keterangan/kategori..." 
            className="bg-background border-2 border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary w-full md:w-auto"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {selectedIds.length > 0 && (
            <Button variant="destructive" className="gap-2" onClick={() => handleDeleteKas(selectedIds)} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              HAPUS ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
            <Download className="w-4 h-4" /> EXCEL
          </Button>
          <Button variant="secondary" className="gap-2" onClick={handleExportPDF}>
            <FileText className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="border-2 border-border bg-card p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="font-mono text-sm uppercase tracking-widest">Memuat Buku Kas...</span>
        </div>
      ) : (
        <div className="border-2 border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-sm">
              <thead className="bg-muted border-b-2 border-border">
                <tr>
                  <th className="p-3 w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4" 
                      checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-3 uppercase tracking-wider">TANGGAL</th>
                  <th className="p-3 uppercase tracking-wider">TIPE & KATEGORI</th>
                  <th className="p-3 uppercase tracking-wider">KETERANGAN</th>
                  <th className="p-3 uppercase tracking-wider text-right">NOMINAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedData.map((item) => {
                  const type = item.tipekas || item.TipeKas;
                  return (
                    <tr key={item.id} className="hover:bg-accent transition-colors">
                      <td className="p-3">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])}
                        />
                      </td>
                      <td className="p-3 font-bold">{item.tanggal || item.Tanggal}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${type === 'MASUK' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-rose-100 text-rose-700 border border-rose-300'}`}>
                            {type}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-300">
                            {item.kategori || item.Kategori}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">{item.keterangan || item.Keterangan}</td>
                      <td className={`p-3 text-right font-black ${type === 'MASUK' ? 'text-emerald-600' : 'text-destructive'}`}>
                        {type === 'MASUK' ? '+' : '-'} Rp {Number(item.nominal || item.Nominal).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground uppercase tracking-widest">
                      BELUM ADA DATA KAS
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 0 && (
            <div className="flex items-center justify-between p-4 border-t-2 border-border bg-muted/20">
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border-4 border-border w-full max-w-md shadow-2xl">
            <div className={`p-4 border-b-2 border-border ${formType === 'MASUK' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              <h2 className={`text-xl font-black uppercase ${formType === 'MASUK' ? 'text-emerald-800' : 'text-rose-800'}`}>
                CATAT {formType === 'MASUK' ? 'PEMASUKAN' : 'PENGELUARAN'} KAS
              </h2>
            </div>
            <form onSubmit={handleSubmitKas} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block font-mono text-sm uppercase mb-1 font-bold">Tanggal</label>
                <input type="date" className="w-full border-2 border-border p-2 font-mono text-sm focus:outline-none focus:border-primary" value={formTanggal} onChange={e => setFormTanggal(e.target.value)} required />
              </div>
              <div>
                <label className="block font-mono text-sm uppercase mb-1 font-bold">Kategori</label>
                <select className="w-full border-2 border-border p-2 font-mono text-sm focus:outline-none focus:border-primary" value={formKategori} onChange={e => setFormKategori(e.target.value)} required>
                  <option value="">-- Pilih Kategori --</option>
                  {kategoriList.filter(k => (k.tipe || k.Tipe) === formType).map(k => (
                    <option key={k.id} value={k.nama || k.Nama}>{k.nama || k.Nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-sm uppercase mb-1 font-bold">Nominal (Rp)</label>
                <input type="number" className="w-full border-2 border-border p-2 font-mono text-sm focus:outline-none focus:border-primary" placeholder="0" value={formNominal} onChange={e => setFormNominal(e.target.value)} required min="1" />
              </div>
              <div>
                <label className="block font-mono text-sm uppercase mb-1 font-bold">Keterangan / Deskripsi</label>
                <textarea className="w-full border-2 border-border p-2 font-mono text-sm focus:outline-none focus:border-primary" rows={3} placeholder="Contoh: Beli beras 5kg" value={formKeterangan} onChange={e => setFormKeterangan(e.target.value)} required />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>BATAL</Button>
                <Button type="submit">SIMPAN DATA</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Master Kategori Modal */}
      {showKategoriForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border-4 border-border w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b-2 border-border bg-muted">
              <h2 className="text-xl font-black uppercase text-foreground">MANAJEMEN KATEGORI KAS</h2>
            </div>
            
            <div className="p-4 border-b-2 border-border bg-card">
              <form onSubmit={handleAddKategori} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block font-mono text-xs uppercase mb-1 font-bold">Tipe Kategori</label>
                  <select className="w-full border-2 border-border p-2 font-mono text-sm focus:outline-none" value={newKategoriTipe} onChange={e => setNewKategoriTipe(e.target.value)}>
                    <option value="MASUK">PEMASUKAN</option>
                    <option value="KELUAR">PENGELUARAN</option>
                  </select>
                </div>
                <div className="flex-[2]">
                  <label className="block font-mono text-xs uppercase mb-1 font-bold">Nama Kategori</label>
                  <input type="text" className="w-full border-2 border-border p-2 font-mono text-sm focus:outline-none" placeholder="Cth: Bahan Baku" value={newKategoriNama} onChange={e => setNewKategoriNama(e.target.value)} required />
                </div>
                <Button type="submit" className="gap-2"><Plus className="w-4 h-4"/> TAMBAH</Button>
              </form>
            </div>

            <div className="overflow-y-auto p-4 flex-1">
              <table className="w-full text-left font-mono text-sm border-2 border-border">
                <thead className="bg-muted border-b-2 border-border">
                  <tr>
                    <th className="p-2 border-r-2 border-border">Tipe</th>
                    <th className="p-2 border-r-2 border-border">Kategori</th>
                    <th className="p-2 w-10 text-center">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {kategoriList.map(k => {
                    const type = k.tipe || k.Tipe;
                    return (
                      <tr key={k.id} className="border-b-2 border-border last:border-0 hover:bg-accent">
                        <td className="p-2 border-r-2 border-border font-bold">
                           <span className={type === 'MASUK' ? 'text-emerald-600' : 'text-destructive'}>{type}</span>
                        </td>
                        <td className="p-2 border-r-2 border-border">{k.nama || k.Nama}</td>
                        <td className="p-2 text-center">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteKategori(k.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {kategoriList.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground uppercase text-xs tracking-widest">Belum ada kategori</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t-2 border-border bg-muted flex justify-end">
              <Button variant="outline" onClick={() => setShowKategoriForm(false)}>TUTUP</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
