"use client";

import { useEffect, useState } from "react";
import { toast } from 'sonner';
import { Search, Loader2, Download, FileText } from "lucide-react";
import ExcelJS from "exceljs";
import QRCode from "qrcode";
import { saveAs } from "file-saver";
import { api } from "@/lib/api/axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";

interface Santri {
  nis: string;
  nama: string;
  kelas: string;
  asrama: string;
  status: string;
  rfid?: string;
}

export default function SantriPage() {
  const [data, setData] = useState<Santri[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedSantri, setSelectedSantri] = useState<Santri | null>(null);
  const [randomId, setRandomId] = useState<string>("");
  const [printQRMode, setPrintQRMode] = useState(false);

  const SPREADSHEET_ID = "1jrUrg3DVS0migGJdWuzaRj4WJ65hS_ZSPG7y7bwPHe0";

  const generateConsistentRandom = (nis: string) => {
    let hash = 0;
    for (let i = 0; i < nis.length; i++) {
      hash = ((hash << 5) - hash) + nis.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash * 1234567) % 900000000 + 100000000).toString();
  };

  const handleDownloadBarcode = async () => {
    if (!selectedSantri) return;
    const container = document.getElementById("barcode-container");
    if (!container) return;
    
    try {
      const canvas = await html2canvas(container, { backgroundColor: "#ffffff" });
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `QR_${randomId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error("Gagal mendownload barcode");
    }
  };

  const handleExportExcel = async () => {
    try {
      toast.loading("Menyiapkan file Excel dengan QR Code...");
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Data Santri");

      worksheet.columns = [
        { header: "NIS", key: "nis", width: 15 },
        { header: "NAMA SANTRI", key: "nama", width: 25 },
        { header: "RFID UID", key: "rfid", width: 20 },
        { header: "KELAS", key: "kelas", width: 15 },
        { header: "ASRAMA", key: "asrama", width: 15 },
        { header: "STATUS", key: "status", width: 15 },
        { header: "KODE QR (9 DIGIT)", key: "qrNum", width: 22 },
        { header: "GAMBAR QR", key: "qrImg", width: 18 }
      ];

      for (let i = 0; i < filteredData.length; i++) {
        const s = filteredData[i];
        const qrNum = generateConsistentRandom(s.nis);
        
        const row = worksheet.addRow({
          nis: s.nis,
          nama: s.nama,
          rfid: s.rfid || "KOSONG",
          kelas: s.kelas,
          asrama: s.asrama,
          status: s.status,
          qrNum: qrNum
        });

        // Set row height specifically so it's taller than the QR image
        row.height = 90;
        
        // Center text vertically and horizontally
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'left' : 'center' };
        });

        try {
          const qrDataUrl = await QRCode.toDataURL(qrNum, { width: 100, margin: 0 });
          const imageId = workbook.addImage({
            base64: qrDataUrl,
            extension: "png"
          });
          
          worksheet.addImage(imageId, {
            tl: { col: 7.15, row: row.number - 1 + 0.15 }, // Adds slight padding
            ext: { width: 75, height: 75 }, // Slightly smaller to ensure padding
            editAs: 'oneCell' // Anchors image within the cell
          });
        } catch (e) {
          console.error("Gagal generate QR untuk", s.nis);
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Data_Santri_Lengkap_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.dismiss();
      toast.success("Berhasil mengekspor Data Santri beserta Gambar QR ke Excel");
    } catch (err) {
      toast.dismiss();
      toast.error("Gagal mengekspor data ke Excel");
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handlePrintAllQR = () => {
    setPrintQRMode(true);
    setTimeout(() => {
      window.print();
      setPrintQRMode(false);
    }, 500);
  };

  useEffect(() => {
    // Fetch Santri from the specific Spreadsheet ID as requested
    api.get('getSantri', { spreadsheetId: SPREADSHEET_ID })
      .then((res) => {
        if (res?.data) {
          setData(res.data);
        } else {
          // Dummy fallback for UI testing if backend is not wired yet
          setData([
            { nis: "21001", nama: "Ahmad Fulan", kelas: "12 IPA", asrama: "Al-Fatih", status: "Aktif", rfid: "04A123BC44" },
            { nis: "21002", nama: "Budi Santoso", kelas: "11 IPS", asrama: "Al-Ayyubi", status: "Aktif", rfid: "04B987XYZ" }
          ]);
        }
        setLoading(false);
      })
      .catch(() => {
        // Fallback dummy data if CORS/Network fails
        setData([
          { nis: "21001", nama: "Ahmad Fulan", kelas: "12 IPA", asrama: "Al-Fatih", status: "Aktif", rfid: "04A123BC44" },
          { nis: "21002", nama: "Budi Santoso", kelas: "11 IPS", asrama: "Al-Ayyubi", status: "Aktif", rfid: "04B987XYZ" }
        ]);
        setLoading(false);
      });
  }, []);

  const filteredData = data.filter(s => 
    s.nama.toLowerCase().includes(search.toLowerCase()) || 
    s.nis.includes(search) ||
    s.rfid?.includes(search)
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col gap-6 print:p-0 print:max-w-full">
      {/* NORMAL VIEW */}
      <div className={printQRMode ? "hidden" : "flex flex-col gap-6"}>
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-border pb-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight">DATA SANTRI</h1>
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1 print:hidden">
            SOURCE ID: {SPREADSHEET_ID.slice(0,8)}...{SPREADSHEET_ID.slice(-4)}
          </p>
          <p className="font-mono text-sm hidden print:block mt-1" suppressHydrationWarning>
            Dicetak pada: {new Date().toLocaleString('id-ID')}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full md:w-auto print:hidden">
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Cari NIS / Nama / RFID..." 
                className="pl-9 font-mono uppercase"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <Button variant="secondary">SYNC</Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportExcel} className="flex-1 font-mono font-bold bg-green-600 hover:bg-green-700 text-white gap-2 text-xs md:text-sm">
              <Download className="w-4 h-4" /> XLSX
            </Button>
            <Button onClick={handlePrintPDF} className="flex-1 font-mono font-bold bg-red-600 hover:bg-red-700 text-white gap-2 text-xs md:text-sm">
              <FileText className="w-4 h-4" /> CETAK TABEL
            </Button>
            <Button onClick={handlePrintAllQR} className="flex-1 font-mono font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs md:text-sm">
              <FileText className="w-4 h-4" /> CETAK QR
            </Button>
          </div>
        </div>
      </header>

      <div className="border-2 border-border bg-card">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="font-mono text-sm uppercase tracking-widest">Memuat Data dari Spreadsheet...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-sm">
              <thead className="bg-muted border-b-2 border-border">
                <tr>
                  <th className="p-3 uppercase tracking-wider">NIS</th>
                  <th className="p-3 uppercase tracking-wider">NAMA SANTRI</th>
                  <th className="p-3 uppercase tracking-wider">RFID UID</th>
                  <th className="p-3 uppercase tracking-wider">KELAS</th>
                  <th className="p-3 uppercase tracking-wider">ASRAMA</th>
                  <th className="p-3 uppercase tracking-wider text-center">STATUS</th>
                  <th className="p-3 uppercase tracking-wider text-center">QR CODE</th>
                  <th className="p-3 uppercase tracking-wider text-right print:hidden">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedData.map((item, index) => (
                  <tr key={index} className="hover:bg-accent hover:text-accent-foreground transition-colors">
                    <td className="p-3 font-bold">{item.nis}</td>
                    <td className="p-3 font-sans uppercase font-bold">{item.nama}</td>
                    <td className="p-3 text-muted-foreground">{item.rfid || 'KOSONG'}</td>
                    <td className="p-3">{item.kelas}</td>
                    <td className="p-3">{item.asrama}</td>
                    <td className="p-3 text-center">
                      <span className="bg-primary text-primary-foreground px-2 py-0.5 text-[10px] uppercase tracking-widest print:bg-transparent print:text-black print:border print:border-black">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-2 text-center align-middle">
                      <div className="inline-flex flex-col items-center bg-white p-1 border border-black">
                        <QRCodeSVG value={generateConsistentRandom(item.nis)} size={48} />
                        <span className="text-[10px] font-black font-mono mt-1 tracking-widest">{generateConsistentRandom(item.nis)}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right print:hidden">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedSantri(item); setRandomId(generateConsistentRandom(item.nis)); }} className="font-mono text-xs h-8">
                        KARTU QR
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground uppercase tracking-widest">
                      TIDAK ADA DATA SANTRI DITEMUKAN
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {totalPages > 1 && !loading && (
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
      </div>

      {/* PRINT QR VIEW */}
      {printQRMode && (
        <div className="hidden print:grid grid-cols-4 gap-4 w-full bg-white text-black p-4">
          {filteredData.map(s => {
            const qrVal = generateConsistentRandom(s.nis);
            return (
              <div key={s.nis} className="border-4 border-black p-4 flex flex-col items-center justify-center break-inside-avoid">
                <QRCodeSVG value={qrVal} size={100} />
                <p className="font-mono text-lg font-black mt-2 tracking-widest">{qrVal}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* BARCODE MODAL */}
      {selectedSantri && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border-4 border-border w-full max-w-sm flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
            <div className="bg-primary text-primary-foreground p-4 flex justify-between items-center border-b-4 border-border">
              <h2 className="text-xl font-black uppercase tracking-tighter">KARTU SANTRI</h2>
              <button onClick={() => setSelectedSantri(null)} className="font-bold text-xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 bg-white flex flex-col items-center border-b-4 border-border">
              <div id="barcode-container" className="flex flex-col items-center bg-white p-6 gap-4">
                <QRCodeSVG value={randomId} size={200} />
                <p className="font-mono text-3xl font-black text-black tracking-widest">{randomId}</p>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2">
              <Button onClick={handleDownloadBarcode} className="w-full h-12 text-base font-bold gap-2">
                <Download className="w-5 h-5" /> DOWNLOAD QR CODE
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
