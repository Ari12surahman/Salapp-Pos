"use client";

import { useState, useEffect } from "react";
import { toast } from 'sonner';
import { Search, Plus, Filter, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";

export default function ProdukPage() {
  const user = useAuthStore(state => state.user);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [warungs, setWarungs] = useState<any[]>([]);
  const [kategoriData, setKategoriData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isKategoriModalOpen, setIsKategoriModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingKategori, setIsSubmittingKategori] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isEditKategori, setIsEditKategori] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    nama: "", kategori: "", modal: 0, jual: 0, stok: 0, barcode: "", warungId: ""
  });
  const [kategoriForm, setKategoriForm] = useState({
    id: "", nama: "", warungId: ""
  });

  const resetForm = () => {
    setFormData({ nama: "", kategori: "", modal: 0, jual: 0, stok: 0, barcode: "", warungId: user?.warungId && user.warungId !== 'ALL' ? user.warungId : "" });
    setIsEdit(false);
    setEditId(null);
  };

  const resetKategoriForm = () => {
    setKategoriForm({ id: "", nama: "", warungId: user?.warungId && user.warungId !== 'ALL' ? user.warungId : "" });
    setIsEditKategori(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleKategoriChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setKategoriForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddClick = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEditClick = (item: any) => {
    setFormData({
      nama: item.nama, kategori: item.kategori, 
      modal: item.modal, jual: item.jual, 
      stok: item.stok, barcode: item.barcode || "",
      warungId: item.warungid || item.WarungID || ""
    });
    setEditId(item.id);
    setIsEdit(true);
    setIsModalOpen(true);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('getProduk');
      if (res?.data) {
        const mapped = res.data.map((p: any) => ({
          ...p,
          modal: p.hargamodal !== undefined ? p.hargamodal : p.modal,
          jual: p.hargajual !== undefined ? p.hargajual : p.jual
        }));
        setData(mapped);
      }
      
      const resW = await api.get('getWarung');
      if (resW && resW.data) {
        setWarungs(resW.data);
      }
      
      const resK = await api.get('getKategori');
      if (resK && resK.data) {
        setKategoriData(resK.data);
      }
    } catch (err) {
      // Fallback for visual testing if DB is empty/failing
      setData([
        { id: "P001", warungId: "WR001", nama: "Nasi Kuning Telur", kategori: "Makanan", modal: 7000, jual: 10000, stok: 50, barcode: "1111", status: "Aktif" },
        { id: "P002", warungId: "WR002", nama: "Es Teh Manis", kategori: "Minuman", modal: 1500, jual: 3000, stok: 100, barcode: "2222", status: "Aktif" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus produk ini?")) return;
    
    try {
      await api.post('hapusProduk', { id });
      toast.success("Produk berhasil dihapus!");
      await fetchProducts();
    } catch (err) {
      toast.error("Gagal menghapus produk.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const endpoint = isEdit ? 'editProduk' : 'tambahProduk';
      const payload = isEdit ? { ...formData, id: editId } : formData;
      const res = await api.post(endpoint, payload);
      if (res && res.status === "error") throw new Error(res.message);
      
      toast.success(isEdit ? "Produk Berhasil Diubah!" : "Produk Berhasil Ditambahkan!");
      setIsModalOpen(false);
      resetForm();
      
      await fetchProducts();
    } catch (error: any) {
      toast.error((isEdit ? "Gagal mengubah produk. " : "Gagal menambahkan produk. ") + (error.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitKategori = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingKategori(true);
    try {
      const endpoint = isEditKategori ? 'editKategori' : 'tambahKategori';
      const res = await api.post(endpoint, kategoriForm);
      if (res && res.status === "error") throw new Error(res.message);
      
      toast.success(isEditKategori ? "Kategori Diubah!" : "Kategori Ditambahkan!");
      resetKategoriForm();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan kategori");
    } finally {
      setIsSubmittingKategori(false);
    }
  };

  const handleEditKategoriClick = (k: any) => {
    setKategoriForm({ id: k.id, nama: k.nama, warungId: k.warungid || k.WarungID || k.warungId || "" });
    setIsEditKategori(true);
  };

  const handleDeleteKategoriClick = async (id: string) => {
    if (!window.confirm("Hapus kategori ini?")) return;
    try {
      await api.post('hapusKategori', { id });
      toast.success("Kategori dihapus");
      fetchProducts();
    } catch (err: any) {
      toast.error("Gagal hapus kategori");
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredData = data.filter(p => {
    const matchesSearch = p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    const matchesWarung = !user?.warungId || user.warungId === 'ALL' || p.warungid === user.warungId || p.WarungID === user.warungId || p.warungId === user.warungId;
    return matchesSearch && matchesWarung;
  });

  const filteredKategori = kategoriData.filter(k => {
    const wId = k.warungid || k.WarungID || k.warungId;
    return !user?.warungId || user.warungId === 'ALL' || wId === user.warungId;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-border pb-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight">MANAJEMEN PRODUK</h1>
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">
            INVENTORY & CATALOG CONTROL
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Cari Nama / Barcode..." 
              className="pl-9 font-mono uppercase"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2" onClick={() => { resetKategoriForm(); setIsKategoriModalOpen(true); }}>
            <Filter className="w-4 h-4" /> KELOLA KATEGORI
          </Button>
          <Button className="gap-2" onClick={handleAddClick}>
            <Plus className="w-4 h-4" /> BARU
          </Button>
        </div>
      </header>

      <div className="border-2 border-border bg-card">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="font-mono text-sm uppercase tracking-widest">Memuat Data dari Database...</span>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-sm">
            <thead className="bg-muted border-b-2 border-border">
              <tr>
                <th className="p-3 uppercase tracking-wider">BARCODE</th>
                <th className="p-3 uppercase tracking-wider">WARUNG</th>
                <th className="p-3 uppercase tracking-wider">NAMA PRODUK</th>
                <th className="p-3 uppercase tracking-wider">KATEGORI</th>
                <th className="p-3 uppercase tracking-wider text-right">MODAL</th>
                <th className="p-3 uppercase tracking-wider text-right">JUAL</th>
                <th className="p-3 uppercase tracking-wider text-right">STOK</th>
                <th className="p-3 uppercase tracking-wider text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.map((item, idx) => (
                <tr key={`${item.id}-${idx}`} className="hover:bg-accent hover:text-accent-foreground transition-colors">
                  <td className="p-3 font-bold">{item.barcode}</td>
                  <td className="p-3 text-xs uppercase text-muted-foreground">{item.warungid || item.WarungID}</td>
                  <td className="p-3 font-sans uppercase font-bold">{item.nama}</td>
                  <td className="p-3 text-muted-foreground">{item.kategori}</td>
                  <td className="p-3 text-right">Rp {Number(item.modal || 0).toLocaleString('id-ID')}</td>
                  <td className="p-3 text-right text-primary font-bold">Rp {Number(item.jual || 0).toLocaleString('id-ID')}</td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-0.5 border border-current ${item.stok < 50 ? 'text-destructive border-destructive' : ''}`}>
                      {item.stok}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEditClick(item)} className="p-1 hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteClick(item.id)} className="p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground uppercase tracking-widest">
                    PRODUK TIDAK DITEMUKAN
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* MODAL TAMBAH/EDIT PRODUK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border-4 border-border w-full max-w-lg p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
            <h2 className="text-2xl font-black uppercase mb-4 tracking-tighter">
              {isEdit ? "EDIT PRODUK" : "TAMBAH PRODUK BARU"}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-widest">NAMA PRODUK</label>
                  <Input name="nama" value={formData.nama} onChange={handleInputChange} required className="uppercase" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-widest">CABANG / WARUNG</label>
                  <select 
                    name="warungId" 
                    value={formData.warungId} 
                    onChange={handleInputChange} 
                    required
                    disabled={!!(user?.warungId && user.warungId !== 'ALL')}
                    className="flex h-12 w-full border-2 border-border bg-background px-3 py-2 text-sm uppercase ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">-- Pilih Warung --</option>
                    {warungs.map((w: any, idx) => (
                      <option key={`${w.id}-${idx}`} value={w.id}>{w.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-widest">BARCODE</label>
                  <Input name="barcode" value={formData.barcode} onChange={handleInputChange} className="uppercase" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-widest">KATEGORI</label>
                  <select 
                    name="kategori" 
                    value={formData.kategori} 
                    onChange={handleInputChange} 
                    className="flex h-12 w-full border-2 border-border bg-background px-3 py-2 text-sm uppercase ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">-- PILIH KATEGORI --</option>
                    {filteredKategori.map((k: any, idx) => (
                      <option key={`${k.id}-${idx}`} value={k.nama}>{k.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-widest">HARGA MODAL</label>
                  <Input type="number" name="modal" value={formData.modal} onChange={handleInputChange} required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-widest">HARGA JUAL</label>
                  <Input type="number" name="jual" value={formData.jual} onChange={handleInputChange} required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-widest">STOK</label>
                  <Input type="number" name="stok" value={formData.stok} onChange={handleInputChange} required />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>BATAL</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "MENYIMPAN..." : "SIMPAN"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KELOLA KATEGORI */}
      {isKategoriModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border-4 border-border w-full max-w-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-black uppercase mb-4 tracking-tighter">KELOLA KATEGORI</h2>
            
            <div className="flex-1 overflow-y-auto mb-6 border-2 border-border">
              <table className="w-full text-left font-mono text-sm">
                <thead className="bg-muted border-b-2 border-border">
                  <tr>
                    <th className="p-3 uppercase tracking-wider">NAMA KATEGORI</th>
                    <th className="p-3 uppercase tracking-wider">WARUNG</th>
                    <th className="p-3 uppercase tracking-wider text-center w-24">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredKategori.map((k: any, idx) => (
                    <tr key={`${k.id}-${idx}`} className="hover:bg-accent hover:text-accent-foreground transition-colors">
                      <td className="p-3 font-bold uppercase">{k.nama}</td>
                      <td className="p-3 text-xs uppercase text-muted-foreground">{k.warungid || k.WarungID || k.warungId}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEditKategoriClick(k)} className="p-1 hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteKategoriClick(k.id)} className="p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors text-destructive"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredKategori.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-muted-foreground uppercase tracking-widest">
                        BELUM ADA KATEGORI
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <form onSubmit={submitKategori} className="flex flex-col gap-4 font-mono bg-muted/50 p-4 border-2 border-border">
              <h3 className="font-bold uppercase tracking-widest">{isEditKategori ? "EDIT KATEGORI" : "TAMBAH KATEGORI"}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-widest">NAMA KATEGORI</label>
                  <Input name="nama" value={kategoriForm.nama} onChange={handleKategoriChange} required className="uppercase" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-widest">CABANG / WARUNG</label>
                  <select 
                    name="warungId" 
                    value={kategoriForm.warungId} 
                    onChange={handleKategoriChange} 
                    required
                    disabled={!!(user?.warungId && user.warungId !== 'ALL')}
                    className="flex h-12 w-full border-2 border-border bg-background px-3 py-2 text-sm uppercase ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">-- Pilih Warung --</option>
                    {warungs.map((w: any, idx) => (
                      <option key={`${w.id}-${idx}`} value={w.id}>{w.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                {isEditKategori && (
                  <Button type="button" variant="outline" onClick={resetKategoriForm}>BATAL EDIT</Button>
                )}
                <Button type="submit" disabled={isSubmittingKategori}>
                  {isSubmittingKategori ? "MENYIMPAN..." : "SIMPAN"}
                </Button>
              </div>
            </form>

            <div className="flex justify-end mt-4">
              <Button type="button" variant="outline" onClick={() => { setIsKategoriModalOpen(false); resetKategoriForm(); }}>TUTUP</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
