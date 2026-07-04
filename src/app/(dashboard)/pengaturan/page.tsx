"use client";

import { useState, useEffect } from "react";
import { toast } from 'sonner';
import { Settings, User, Store, Bell, Printer, Shield, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmStore } from "@/store/confirmStore";
import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/store/authStore";

const MENU_LIST = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pos", label: "Terminal POS" },
  { id: "pesanan-online", label: "Pesanan Online" },
  { id: "pencairan", label: "Pencairan Dana" },
  { id: "produk", label: "Produk & Stok" },
  { id: "santri", label: "Data Santri" },
  { id: "warung", label: "Kelola Warung" },
  { id: "topup", label: "Top Up Saldo" },
  { id: "laporan", label: "Laporan Harian" },
  { id: "cashflow", label: "Buku Kas" },
  { id: "pengaturan", label: "Pengaturan" }
];

export default function PengaturanPage() {
  const currentUser = useAuthStore((state: any) => state.user);
  const isAdmin = currentUser?.role === 'Super Admin';
  const [activeTab, setActiveTab] = useState(isAdmin ? "role" : "user");

  const [users, setUsers] = useState<any[]>([]);
  const [warungs, setWarungs] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reusable modal for both User and Role
  const [modalType, setModalType] = useState<"user" | "role">("user");

  // Pakasir Config State
  const [pakasirDomain, setPakasirDomain] = useState("");
  const [pakasirApiKey, setPakasirApiKey] = useState("");

  const [formData, setFormData] = useState({
    username: "", password: "", role: "", name: "", warungId: "Semua",
    roleName: "", permissions: [] as string[]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resUsers, resWarungs, resRoles, resPengaturan] = await Promise.all([
        api.get('getUsers'),
        api.get('getWarung'),
        api.get('getRoles'),
        api.get('getPengaturan')
      ]);
      if (resUsers?.data) setUsers(resUsers.data);
      if (resWarungs?.data) setWarungs(resWarungs.data);
      if (resRoles?.data) setRoles(resRoles.data);
      if (resPengaturan?.data) {
        const pData = resPengaturan.data;
        const dom = pData.find((p: any) => p.kunci === "PAKASIR_DOMAIN" || p.kunci === "pakasir_domain")?.nilai;
        const apiK = pData.find((p: any) => p.kunci === "PAKASIR_APIKEY" || p.kunci === "pakasir_apikey")?.nilai;
        if (dom) { setPakasirDomain(dom); localStorage.setItem("PAKASIR_DOMAIN", dom); }
        if (apiK) { setPakasirApiKey(apiK); localStorage.setItem("PAKASIR_APIKEY", apiK); }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Load config
    const savedDomain = localStorage.getItem("PAKASIR_DOMAIN");
    const savedApiKey = localStorage.getItem("PAKASIR_APIKEY");
    if (savedDomain) setPakasirDomain(savedDomain);
    if (savedApiKey) setPakasirApiKey(savedApiKey);
  }, []);

  const savePakasirConfig = async () => {
    localStorage.setItem("PAKASIR_DOMAIN", pakasirDomain);
    localStorage.setItem("PAKASIR_APIKEY", pakasirApiKey);
    try {
      await api.post('simpanPengaturan', { domain: pakasirDomain, apikey: pakasirApiKey });
      toast.success("Kredensial berhasil disimpan ke database dan browser!");
    } catch(e) {
      toast.error("Berhasil simpan di lokal, tapi gagal simpan ke database.");
    }
  };

  const resetForm = () => {
    setFormData({ 
      username: "", password: "", 
      role: isAdmin ? (roles[0]?.rolename || "Kasir") : "Kasir", 
      name: "", 
      warungId: isAdmin ? "Semua" : (currentUser?.warungId || "Semua"),
      roleName: "", permissions: [] 
    });
    setIsEdit(false);
    setEditId(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (menuId: string) => {
    setFormData(prev => {
      const perms = prev.permissions.includes(menuId) 
        ? prev.permissions.filter(p => p !== menuId)
        : [...prev.permissions, menuId];
      return { ...prev, permissions: perms };
    });
  };

  const handleAddClick = (type: "user" | "role") => {
    setModalType(type);
    resetForm();
    setIsModalOpen(true);
  };

  const getVal = (item: any, keys: string[]) => {
    for (const k of keys) {
      for (const itemKey in item) {
        if (itemKey.replace(/\s+/g, '').toLowerCase() === k.toLowerCase()) {
          return item[itemKey];
        }
      }
    }
    return "";
  };

  const handleEditClick = (type: "user" | "role", item: any) => {
    setModalType(type);
    if (type === "user") {
      setFormData(prev => ({
        ...prev,
        username: getVal(item, ['username']),
        password: getVal(item, ['password']),
        role: getVal(item, ['role']),
        name: getVal(item, ['name', 'nama']),
        warungId: getVal(item, ['warungid', 'warung']) || "Semua"
      }));
      setEditId(getVal(item, ['id', 'iduser']));
    } else {
      const permsString = getVal(item, ['permissions', 'akses', 'aksesmenu']);
      setFormData(prev => ({
        ...prev,
        roleName: getVal(item, ['rolename', 'nama', 'namarole']),
        permissions: permsString ? permsString.split(',').map((s:string) => s.trim()) : []
      }));
      setEditId(getVal(item, ['id', 'idrole']));
    }
    setIsEdit(true);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (type: "user" | "role", id: string) => {
    const confirmed = await useConfirmStore.getState().showConfirm({
      title: `HAPUS ${type.toUpperCase()}`,
      message: `Yakin ingin menghapus ${type} ini secara permanen?`,
    });
    if (!confirmed) return;
    try {
      await api.post(type === "user" ? 'hapusUser' : 'hapusRole', { id });
      toast.success("Berhasil dihapus!");
      fetchData();
    } catch (e) {
      toast.error("Gagal menghapus.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let endpoint = "";
      let payload: any = {};

      if (modalType === "user") {
        endpoint = isEdit ? 'editUser' : 'tambahUser';
        payload = {
          username: formData.username,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          warungId: formData.warungId
        };
      } else {
        endpoint = isEdit ? 'editRole' : 'tambahRole';
        payload = {
          roleName: formData.roleName,
          permissions: formData.permissions.join(',')
        };
      }

      if (isEdit) payload.id = editId;

      const res = await api.post(endpoint, payload);
      if (res && res.status === "error") throw new Error(res.message);
      
      toast.success(isEdit ? "Berhasil Diubah!" : "Berhasil Ditambahkan!");
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + (error.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-border pb-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
            {isAdmin ? "PENGATURAN" : "PENGGUNA"}
          </h1>
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">
            {isAdmin ? "SYSTEM CONFIGURATION" : "MANAJEMEN PENGGUNA"}
          </p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        {isAdmin && (
          <div className="w-full md:w-64 flex flex-col gap-2 shrink-0">
            <button 
              onClick={() => setActiveTab("role")}
              className={`flex items-center gap-3 px-4 py-3 font-bold uppercase transition-colors border-2 ${activeTab === "role" ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:border-foreground"}`}
            >
              <Shield className="w-4 h-4" /> Hak Akses
            </button>
            <button 
              onClick={() => setActiveTab("user")}
              className={`flex items-center gap-3 px-4 py-3 font-bold uppercase transition-colors border-2 ${activeTab === "user" ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:border-foreground"}`}
            >
              <User className="w-4 h-4" /> Pengguna
            </button>
            <button 
              onClick={() => setActiveTab("umum")}
              className={`flex items-center gap-3 px-4 py-3 font-bold uppercase transition-colors border-2 ${activeTab === "umum" ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:border-foreground"}`}
            >
              <Settings className="w-4 h-4" /> Umum
            </button>
            <button 
              onClick={() => setActiveTab("warung")}
              className={`flex items-center gap-3 px-4 py-3 font-bold uppercase transition-colors border-2 ${activeTab === "warung" ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:border-foreground"}`}
            >
              <Store className="w-4 h-4" /> Profil Warung
            </button>
            <button 
              onClick={() => setActiveTab("printer")}
              className={`flex items-center gap-3 px-4 py-3 font-bold uppercase transition-colors border-2 ${activeTab === "printer" ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:border-foreground"}`}
            >
              <Printer className="w-4 h-4" /> Struk & Printer
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 bg-card border-2 border-border p-6 min-h-[400px]">
          
          {/* TAB HAK AKSES */}
          {activeTab === "role" && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center border-b-2 border-border pb-2">
                <div>
                  <h2 className="text-xl font-black uppercase">Hak Akses Dinamis</h2>
                  <p className="text-muted-foreground font-mono text-sm">Atur menu apa saja yang bisa dilihat oleh setiap jabatan.</p>
                </div>
                <Button onClick={() => handleAddClick("role")} className="gap-2">
                  <Plus className="w-4 h-4" /> TAMBAH ROLE
                </Button>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {roles.length === 0 && <p className="text-muted-foreground italic font-mono text-sm">Tidak ada data Hak Akses.</p>}
                  {roles.map((r, i) => {
                    const id = getVal(r, ['id', 'idrole']);
                    const roleName = getVal(r, ['rolename', 'nama']);
                    const permsString = getVal(r, ['permissions', 'akses']);
                    const perms = permsString ? permsString.split(',').map((s:string) => s.trim()) : [];
                    
                    return (
                      <div key={id || i} className="border border-border p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-lg uppercase">{roleName}</h3>
                          <div className="flex items-center gap-2">
                            <Button onClick={() => handleEditClick("role", r)} variant="outline" size="sm" className="h-8 gap-2"><Edit className="w-3 h-3" /> EDIT</Button>
                            <Button onClick={() => handleDeleteClick("role", id)} variant="destructive" size="sm" className="h-8 gap-2"><Trash2 className="w-3 h-3" /> HAPUS</Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {MENU_LIST.map(m => {
                            const hasAccess = perms.includes(m.id);
                            return (
                              <span key={m.id} className={`text-xs px-2 py-1 font-mono uppercase ${hasAccess ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground line-through'}`}>
                                {m.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB PENGGUNA */}
          {activeTab === "user" && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center border-b-2 border-border pb-2">
                <div>
                  <h2 className="text-xl font-black uppercase">Manajemen Pengguna</h2>
                  <p className="text-muted-foreground font-mono text-sm">Kelola akun dan tetapkan hak aksesnya.</p>
                </div>
                <Button onClick={() => handleAddClick("user")} className="gap-2">
                  <Plus className="w-4 h-4" /> TAMBAH USER
                </Button>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-mono border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border">
                        <th className="text-left py-3 px-2 font-bold uppercase">NAMA</th>
                        <th className="text-left py-3 px-2 font-bold uppercase">USERNAME</th>
                        <th className="text-left py-3 px-2 font-bold uppercase">ROLE</th>
                        <th className="text-left py-3 px-2 font-bold uppercase">WARUNG</th>
                        <th className="text-right py-3 px-2 font-bold uppercase">AKSI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground italic">Belum ada pengguna</td>
                        </tr>
                      ) : users.filter(u => isAdmin ? true : getVal(u, ['warungid', 'warung']) === currentUser?.warungId).map((u, i) => {
                        const id = getVal(u, ['id', 'iduser']) || `U-${i}`;
                        const nama = getVal(u, ['name', 'nama']);
                        const username = getVal(u, ['username']);
                        const role = getVal(u, ['role']);
                        const wId = getVal(u, ['warungid', 'warung']);
                        const warungName = warungs.find(w => getVal(w, ['id', 'idwarung']) === wId)?.nama || wId || "Semua";

                        return (
                          <tr key={`${id}-${i}`} className="border-b border-border hover:bg-accent transition-colors">
                            <td className="py-3 px-2 uppercase font-bold">{nama}</td>
                            <td className="py-3 px-2">{username}</td>
                            <td className="py-3 px-2 uppercase text-xs">
                              <span className="bg-primary/20 text-primary px-2 py-1 rounded">{role}</span>
                            </td>
                            <td className="py-3 px-2">{warungName}</td>
                            <td className="py-3 px-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button onClick={() => handleEditClick("user", u)} variant="outline" size="icon" className="h-8 w-8"><Edit className="w-3 h-3" /></Button>
                                {role !== 'Super Admin' && <Button onClick={() => handleDeleteClick("user", id)} variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="w-3 h-3" /></Button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "umum" && (
            <div className="flex flex-col gap-6">
              <h2 className="text-xl font-black uppercase border-b-2 border-border pb-2">Pengaturan Umum</h2>
              <p className="text-muted-foreground font-mono text-sm">Konfigurasi dasar aplikasi SalApp.</p>
              
              <div className="flex flex-col gap-4 max-w-md">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Nama Institusi</label>
                  <input type="text" className="border-2 border-border p-2 bg-background font-mono" defaultValue="Pondok Pesantren" disabled />
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-2"></div>
              
              <h2 className="text-xl font-black uppercase border-b-2 border-border pb-2">Kredensial Pembayaran (Pakasir)</h2>
              <p className="text-muted-foreground font-mono text-sm">Disimpan secara lokal di browser kasir ini untuk keperluan cetak QRIS & VA.</p>
              
              <div className="flex flex-col gap-4 max-w-md">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Domain / Slug Pakasir</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: depodomain"
                    value={pakasirDomain}
                    onChange={(e) => setPakasirDomain(e.target.value)}
                    className="border-2 border-border p-2 bg-background font-mono" 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">API Key Pakasir</label>
                  <input 
                    type="password" 
                    placeholder="Contoh: xxx123"
                    value={pakasirApiKey}
                    onChange={(e) => setPakasirApiKey(e.target.value)}
                    className="border-2 border-border p-2 bg-background font-mono" 
                  />
                </div>
                <Button onClick={savePakasirConfig} className="mt-2 w-full">SIMPAN KREDENSIAL</Button>
              </div>
            </div>
          )}

          {activeTab === "warung" && (
            <div className="flex flex-col gap-6">
              <h2 className="text-xl font-black uppercase border-b-2 border-border pb-2">Profil Warung</h2>
              <p className="text-muted-foreground font-mono text-sm">Gunakan menu <strong>Kelola Warung</strong> di sidebar kiri untuk merubah data.</p>
            </div>
          )}

          {activeTab === "printer" && (
            <div className="flex flex-col gap-6">
              <h2 className="text-xl font-black uppercase border-b-2 border-border pb-2">Struk & Printer</h2>
              <p className="text-muted-foreground font-mono text-sm">Pengaturan struk thermal kasir.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto pt-20 pb-20">
          <form onSubmit={handleSubmit} className="bg-card border-2 border-border p-6 w-full max-w-md shadow-2xl relative my-auto">
            <h2 className="text-2xl font-black uppercase mb-6">
              {isEdit ? "Edit" : "Tambah"} {modalType === "user" ? "Pengguna" : "Hak Akses"}
            </h2>
            
            {modalType === "user" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Nama Lengkap</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="border-2 border-border p-2 bg-background font-mono uppercase" placeholder="JOHN DOE" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Username</label>
                  <input required type="text" name="username" value={formData.username} onChange={handleInputChange} className="border-2 border-border p-2 bg-background font-mono" placeholder="johndoe" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Password</label>
                  <input required type="text" name="password" value={formData.password} onChange={handleInputChange} className="border-2 border-border p-2 bg-background font-mono" placeholder="***" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Role / Jabatan</label>
                  <select name="role" value={formData.role} onChange={handleInputChange} disabled={!isAdmin} className="border-2 border-border p-2 bg-background font-mono uppercase disabled:opacity-50">
                    {roles.map((r, idx) => {
                      const rName = getVal(r, ['rolename', 'nama']) || `Role-${idx}`;
                      return <option key={idx} value={rName}>{rName}</option>
                    })}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Tugaskan ke Warung</label>
                  <select name="warungId" value={formData.warungId} onChange={handleInputChange} disabled={!isAdmin} className="border-2 border-border p-2 bg-background font-mono uppercase disabled:opacity-50">
                    <option value="Semua">Semua / Tidak Spesifik</option>
                    {warungs.map((w, idx) => {
                      const wId = getVal(w, ['id', 'idwarung']) || `WR-${idx}`;
                      const wNama = getVal(w, ['nama', 'namawarung']) || "Tanpa Nama";
                      return <option key={wId} value={wId}>{wNama}</option>
                    })}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-sm uppercase">Nama Jabatan (Role)</label>
                  <input required type="text" name="roleName" value={formData.roleName} onChange={handleInputChange} className="border-2 border-border p-2 bg-background font-mono uppercase" placeholder="KASIR SENIOR" />
                </div>
                <div className="flex flex-col gap-2 mt-4">
                  <label className="font-bold text-sm uppercase border-b-2 border-border pb-1">Menu yang diizinkan:</label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {MENU_LIST.map(menu => (
                      <label key={menu.id} className="flex items-center gap-3 p-2 border border-border hover:bg-accent cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={formData.permissions.includes(menu.id)}
                          onChange={() => handleCheckboxChange(menu.id)}
                          className="w-4 h-4"
                        />
                        <span className="font-mono text-sm uppercase">{menu.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>BATAL</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEdit ? "SIMPAN" : "TAMBAH"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
