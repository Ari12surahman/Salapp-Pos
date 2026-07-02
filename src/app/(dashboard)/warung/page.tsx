"use client";

import { useState, useEffect } from "react";
import { toast } from 'sonner';
import { Plus, Store, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmStore } from "@/store/confirmStore";
import { api } from "@/lib/api/axios";

export default function WarungPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nama: "", lokasi: "", pj: ""
  });

  const resetForm = () => {
    setFormData({ nama: "", lokasi: "", pj: "" });
    setIsEdit(false);
    setEditId(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddClick = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEditClick = (item: any) => {
    setFormData({
      nama: item.nama, lokasi: item.lokasi, pj: item.pj
    });
    setEditId(item.id);
    setIsEdit(true);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    const confirmed = await useConfirmStore.getState().showConfirm({
      title: "HAPUS WARUNG",
      message: "Apakah Anda yakin ingin menghapus warung ini secara permanen?",
    });
    if (!confirmed) return;
    
    try {
      await api.post('hapusWarung', { id });
      toast.success("Warung berhasil dihapus!");
      setLoading(true);
      const res = await api.get('getWarung');
      if (res?.data) setData(res.data);
    } catch (err) {
      toast.error("Gagal menghapus warung.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const endpoint = isEdit ? 'editWarung' : 'tambahWarung';
      const payload = isEdit ? { ...formData, id: editId } : formData;
      const res = await api.post(endpoint, payload);
      if (res && res.status === "error") throw new Error(res.message);
      
      toast.success(isEdit ? "Warung Berhasil Diubah!" : "Warung Berhasil Ditambahkan!");
      setIsModalOpen(false);
      resetForm();
      
      setLoading(true);
      const getRes = await api.get('getWarung');
      if (getRes?.data) setData(getRes.data);
    } catch (error: any) {
      toast.error((isEdit ? "Gagal mengubah warung. " : "Gagal menambahkan warung. ") + (error.message || ""));
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('getWarung')
      .then(res => {
        if (res?.data) setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        // Fallback for visual testing
        setData([
          { id: "WR001", nama: "Kantin Putra", lokasi: "Gedung A", pj: "Ustadz Budi", status: "Aktif" },
          { id: "WR002", nama: "Kantin Putri", lokasi: "Gedung B", pj: "Ustadzah Aisyah", status: "Aktif" },
        ]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-border pb-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight">DATA WARUNG</h1>
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">
            FACILITY & BRANCH LIST
          </p>
        </div>
        <Button className="gap-2" onClick={handleAddClick}>
          <Plus className="w-4 h-4" /> TAMBAH WARUNG
        </Button>
      </header>

      {loading ? (
        <div className="border-2 border-border bg-card p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="font-mono text-sm uppercase tracking-widest">Memuat Data Warung...</span>
        </div>
      ) : (
      <div className="industrial-grid grid-cols-1 md:grid-cols-2 gap-1 border-2 border-border bg-border">
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

          const id = getVal(['id', 'idwarung', 'kode']) || `WR-${idx}`;
          const nama = getVal(['nama', 'namawarung', 'warung']) || "Tanpa Nama";
          const lokasi = getVal(['lokasi', 'tempat']) || "-";
          const pj = getVal(['pj', 'penanggungjawab', 'pengelola']) || "-";
          const status = getVal(['status', 'aktif']) || "AKTIF";

          return (
          <div key={`${id}-${idx}`} className="bg-background p-6 flex flex-col gap-4 hover:bg-accent transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary text-primary-foreground border border-border">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl uppercase tracking-tighter">{nama}</h3>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{id}</p>
                </div>
              </div>
              <span className="font-mono text-[10px] uppercase bg-foreground text-background px-2 py-1">{status}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 font-mono text-sm mt-2">
              <div className="flex flex-col border-l-2 border-border pl-2">
                <span className="text-[10px] text-muted-foreground">LOKASI</span>
                <span className="uppercase">{lokasi}</span>
              </div>
              <div className="flex flex-col border-l-2 border-border pl-2">
                <span className="text-[10px] text-muted-foreground">PENANGGUNG JAWAB</span>
                <span className="uppercase">{pj}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t border-border">
              <Button onClick={() => handleEditClick({ id, nama, lokasi, pj, status })} variant="outline" size="sm" className="gap-2"><Edit className="w-3 h-3" /> EDIT</Button>
              <Button onClick={() => handleDeleteClick(id)} variant="destructive" size="sm" className="gap-2"><Trash2 className="w-3 h-3" /> HAPUS</Button>
            </div>
          </div>
          );
        })}
        {data.length === 0 && (
          <div className="bg-background col-span-1 md:col-span-2 p-8 text-center text-muted-foreground font-mono uppercase tracking-widest">
            TIDAK ADA DATA WARUNG
          </div>
        )}
      </div>
      )}

      {/* MODAL TAMBAH/EDIT WARUNG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border-4 border-border w-full max-w-lg p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
            <h2 className="text-2xl font-black uppercase mb-4 tracking-tighter">
              {isEdit ? "EDIT WARUNG" : "TAMBAH WARUNG BARU"}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-mono">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-widest">NAMA WARUNG</label>
                <Input name="nama" value={formData.nama} onChange={handleInputChange} required className="uppercase" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-widest">LOKASI GEDUNG/AREA</label>
                <Input name="lokasi" value={formData.lokasi} onChange={handleInputChange} required className="uppercase" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-widest">NAMA PENANGGUNG JAWAB</label>
                <Input name="pj" value={formData.pj} onChange={handleInputChange} required className="uppercase" />
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
    </div>
  );
}
