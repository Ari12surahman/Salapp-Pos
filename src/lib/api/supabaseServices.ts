import { supabase } from '../supabase';

// Helper to convert PascalCase DB columns to lowercase keys
const mapKeysToLower = (data: any[]) => {
  return data.map(item => {
    const obj: any = {};
    Object.keys(item).forEach(key => {
      obj[key.toLowerCase()] = item[key];
    });
    return obj;
  });
};

export const supabaseServices = {
  getSantri: async () => {
    const { data, error } = await supabase.from('Data Santri').select('*');
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },

  getTabungan: async () => {
    const { data, error } = await supabase.from('Tabungan').select('*');
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },

  getWarung: async () => {
    const { data, error } = await supabase.from('Warung').select('*');
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },
  
  getProduk: async () => {
    const { data, error } = await supabase.from('Produk').select('*');
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },

  getKategori: async () => {
    const { data, error } = await supabase.from('Kategori').select('*');
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },

  getUsers: async () => {
    const { data, error } = await supabase.from('Users').select('*');
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },

  getRoles: async () => {
    const { data, error } = await supabase.from('Roles').select('*');
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },

  getPengaturan: async () => {
    const { data, error } = await supabase.from('Pengaturan').select('*');
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },

  getTransaksi: async () => {
    const { data, error } = await supabase.from('Transaksi').select('*');
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },

  getDashboard: async (payload: any) => {
    const warungId = payload?.warungId;
    
    // 1. Fetch Transaksi (Sort by Waktu DESC)
    let trxQuery = supabase.from('Transaksi').select('*').order('Waktu', { ascending: false });
    if (warungId && warungId !== 'ALL') trxQuery = trxQuery.eq('WarungID', warungId);
    const { data: trxData, error: trxError } = await trxQuery;
    if (trxError) return { status: 'error', message: trxError.message };

    // 2. Fetch Pencairan
    let penQuery = supabase.from('Pencairan').select('*');
    if (warungId && warungId !== 'ALL') penQuery = penQuery.eq('WarungID', warungId);
    const { data: penData } = await penQuery;

    // 3. Fetch Produk
    let prdQuery = supabase.from('Produk').select('*');
    if (warungId && warungId !== 'ALL') prdQuery = prdQuery.eq('WarungID', warungId);
    const { data: prdData } = await prdQuery;

    // 4. Fetch DetailTransaksi (For Top Products)
    let detailQuery = supabase.from('DetailTransaksi').select('*');
    // We can't directly filter DetailTransaksi by WarungID since it doesn't have it, 
    // but RLS will automatically filter it for us based on the user's role!
    // However, if user is ALL and selected a specific warung, we should manually filter by TrxID.
    const { data: detailData } = await detailQuery;

    let uangMasuk = 0;
    let uangKeluar = 0;
    let stokHabis = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const today = new Date().toDateString();

    const trxMapped = mapKeysToLower(trxData || []);
    const penMapped = mapKeysToLower(penData || []);
    const prdMapped = mapKeysToLower(prdData || []);
    const detailMapped = mapKeysToLower(detailData || []);

    // Transaksi filtering
    let filteredTrxIds = new Set();
    trxMapped.forEach((t: any) => {
      // Calculate daily income
      const d = new Date(t.waktu);
      if (d.toDateString() === today) {
        if (t.statusambil !== "Batal" && t.statusambil !== "Menunggu Diambil") {
          uangMasuk += Number(t.totalharga) || 0;
        }
      }
      filteredTrxIds.add(t.trxid);
    });

    // Pencairan filtering (Uang Keluar)
    penMapped.forEach((p: any) => {
      const d = new Date(p.waktupengajuan || p.waktuselesai);
      if (d.toDateString() === today && p.status === 'Selesai') {
        uangKeluar += Number(p.totaldana) || 0;
      }
    });

    // Stok Habis
    prdMapped.forEach((p: any) => {
      if (Number(p.stok) <= 0) stokHabis++;
    });

    // Keuntungan Bersih
    const keuntunganBersih = uangMasuk - uangKeluar;

    // Transaksi Terakhir (Top 5)
    const transaksiTerakhir = trxMapped.slice(0, 5);

    // Barang Paling Laris
    const productSales: Record<string, { nama: string, qty: number }> = {};
    detailMapped.forEach((d: any) => {
      // Only count details that belong to the filtered transactions (current warung context)
      if (filteredTrxIds.has(d.trxid)) {
        if (!productSales[d.namaproduk]) {
          productSales[d.namaproduk] = { nama: d.namaproduk, qty: 0 };
        }
        productSales[d.namaproduk].qty += Number(d.kuantitas) || 0;
      }
    });

    const barangLaris = Object.values(productSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      status: "success",
      data: {
        totalTrx: trxMapped.filter((t: any) => new Date(t.waktu).toDateString() === today).length,
        uangMasuk,
        uangKeluar,
        keuntunganBersih,
        stokHabis,
        transaksiTerakhir,
        barangLaris,
        totalWarung: prdData ? new Set(prdMapped.map(p => p.warungid)).size : 0
      }
    };
  },

  hapusWarung: async (payload: any) => {
    const id = typeof payload === 'string' ? payload : payload.id;
    const { error } = await supabase.from('Warung').delete().eq('ID', id);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },
  hapusProduk: async (payload: any) => {
    const id = typeof payload === 'string' ? payload : payload.id;
    const { error } = await supabase.from('Produk').delete().eq('ID', id);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },
  hapusKategori: async (payload: any) => {
    const id = typeof payload === 'string' ? payload : payload.id;
    const { error } = await supabase.from('Kategori').delete().eq('ID', id);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },

  tambahWarung: async (payload: any) => {
    const newId = "W" + new Date().getTime();
    const { error } = await supabase.from('Warung').insert({
      ID: newId, Nama: payload.nama, Lokasi: payload.lokasi, PJ: payload.pj, Status: payload.status
    });
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', id: newId };
  },

  editWarung: async (payload: any) => {
    const { error } = await supabase.from('Warung').update({
      Nama: payload.nama, Lokasi: payload.lokasi, PJ: payload.pj, Status: payload.status
    }).eq('ID', payload.id);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },

  tambahProduk: async (payload: any) => {
    const newId = "P" + new Date().getTime();
    const { error } = await supabase.from('Produk').insert({
      ID: newId, WarungID: payload.warungId, Nama: payload.nama, Kategori: payload.kategori,
      HargaModal: payload.hargaModal, HargaJual: payload.hargaJual, Stok: payload.stok,
      Barcode: payload.barcode || "", Status: payload.status || "Aktif"
    });
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },

  editProduk: async (payload: any) => {
    const { error } = await supabase.from('Produk').update({
      WarungID: payload.warungId, Nama: payload.nama, Kategori: payload.kategori,
      HargaModal: payload.hargaModal, HargaJual: payload.hargaJual, Stok: payload.stok,
      Barcode: payload.barcode || "", Status: payload.status || "Aktif"
    }).eq('ID', payload.id);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },

  tambahKategori: async (payload: any) => {
    const newId = "KAT" + new Date().getTime();
    const { error } = await supabase.from('Kategori').insert({
      ID: newId, Nama: payload.nama, WarungID: payload.warungId
    });
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', id: newId };
  },
  
  login: async (payload: any) => {
    const cleanUsername = payload.username.trim();
    const email = `${cleanUsername.toLowerCase().replace(/\s/g, '')}@sistemkeuangan.com`;
    
    // 1. Authenticate with Supabase Auth
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: payload.password,
    });
    
    if (authError || !authData.user) {
      // Fallback for older accounts that were created with .local
      const oldEmail = `${cleanUsername.toLowerCase().replace(/\s/g, '')}@sistemkeuangan.local`;
      const { data: fallbackData, error: fallbackError } = await supabase.auth.signInWithPassword({
        email: oldEmail,
        password: payload.password,
      });

      if (fallbackError || !fallbackData.user) {
        console.error("Login Error from Supabase Auth:", authError, fallbackError);
        return { status: 'error', message: "Username atau Password salah!" };
      }
      authData = fallbackData;
    }
    
    // 2. Fetch User Profile from public.Users
    const { data, error } = await supabase.from('Users').select('*').ilike('Username', cleanUsername);
    
    if (error || !data || data.length === 0) {
      console.error("Profile Fetch Error:", error || "User not found in public.Users");
      return { status: 'error', message: "Gagal mengambil profil user. Pastikan data user ada di tabel Users." };
    }
    
    const userRow = data[0];
    
    // 3. Fetch permissions from Roles
    let permissions = "pos"; // default
    if (userRow.Role) {
      const { data: roleData } = await supabase.from('Roles').select('Permissions').ilike('RoleName', userRow.Role);
      if (roleData && roleData.length > 0) permissions = roleData[0].Permissions;
    }
    
    const userObj = mapKeysToLower([userRow])[0];
    userObj.permissions = permissions;
    // Fix case issue for warungId since Zustand expects camelCase
    userObj.warungId = userObj.warungid;
    
    return {
      status: "success",
      user: userObj
    };
  },

  getPesananOnline: async (payload: any) => {
    let q = supabase.from('Transaksi').select('*').eq('Metode', 'Pesanan Online');
    if (payload?.warungId && payload.warungId !== 'ALL') q = q.eq('WarungID', payload.warungId);
    
    const { data, error } = await q;
    if (error) return { status: 'error', message: error.message };
    
    const orders = mapKeysToLower(data || []);
    if (orders.length > 0) {
      const trxIds = orders.map((o: any) => o.trxid);
      const { data: details } = await supabase.from('DetailTransaksi').select('*').in('TrxID', trxIds);
      if (details) {
        const detailsMapped = mapKeysToLower(details);
        orders.forEach((o: any) => {
          o.items = detailsMapped
            .filter((d: any) => d.trxid === o.trxid)
            .map((d: any) => ({
              nama: d.namaproduk,
              qty: d.kuantitas,
              harga: d.hargasatuan
            }));
        });
      }
    }
    
    return { status: 'success', data: orders };
  },

  updateStatusAmbil: async (payload: any) => {
    if (payload.trxIds && Array.isArray(payload.trxIds)) {
      const { error } = await supabase.from('Transaksi').update({ StatusAmbil: payload.status }).in('TrxID', payload.trxIds);
      if (error) return { status: 'error', message: error.message };
      return { status: 'success' };
    }
    const { error } = await supabase.from('Transaksi').update({ StatusAmbil: payload.status }).eq('TrxID', payload.trxId);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },

  hapusTransaksi: async (payload: any) => {
    if (!payload.trxIds || !payload.trxIds.length) return { status: 'success' };
    const { error } = await supabase.from('Transaksi').delete().in('TrxID', payload.trxIds);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },

  simpanTransaksiOffline: async (payload: any) => {
    const trxId = "TRX-" + new Date().getTime();
    const { error } = await supabase.from('Transaksi').insert({
      TrxID: trxId, Waktu: new Date().toISOString(), SantriID: payload.santriId, WarungID: payload.warungId || "UNKNOWN",
      TotalHarga: payload.total, Metode: payload.method || "Tunai", StatusAmbil: "Sudah Diambil", Catatan: "", StatusPencairan: "Belum Diajukan"
    });
    if (error) return { status: 'error', message: error.message };

    for (const item of payload.items) {
      await supabase.from('DetailTransaksi').insert({
        TrxID: trxId, ProdukID: item.id, NamaProduk: item.name, HargaSatuan: item.price, Kuantitas: item.quantity, Subtotal: item.price * item.quantity
      });
      const { data: p } = await supabase.from('Produk').select('Stok').eq('ID', item.id).single();
      if (p) {
        await supabase.from('Produk').update({ Stok: Number(p.Stok) - item.quantity }).eq('ID', item.id);
      }
    }

    if (payload.method === 'Tabungan') {
      await supabase.from('Tabungan').insert({
        id: `TB-${new Date().getTime()}`,
        tanggal: new Date().toISOString().split('T')[0],
        nis: payload.santriId,
        nama: payload.buyerName || 'Santri',
        jenis: 'Tarik',
        nominal: payload.total,
        keterangan: 'Belanja Kantin (POS)'
      });
    }

    return { status: 'success' };
  },

  getPencairanEligible: async (payload: any) => {
    let q = supabase.from('Transaksi').select('*').eq('StatusPencairan', 'Belum Diajukan').neq('StatusAmbil', 'Batal');
    if (payload?.warungId && payload.warungId !== 'ALL') q = q.eq('WarungID', payload.warungId);
    const { data, error } = await q;
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },
  getRiwayatPencairan: async (payload: any) => {
    let q = supabase.from('Pencairan').select('*');
    if (payload?.warungId && payload.warungId !== 'ALL') q = q.eq('WarungID', payload.warungId);
    const { data, error } = await q;
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },
  ajukanPencairan: async (payload: any) => {
    const idPencairan = "PC-" + new Date().getTime();
    await supabase.from('Pencairan').insert({
      IDPencairan: idPencairan, WarungID: payload.warungId, WaktuPengajuan: new Date().toISOString(), TotalDana: payload.totalDana, Status: "Menunggu"
    });
    await supabase.from('Transaksi').update({ StatusPencairan: 'Sedang Diajukan', IDPencairan: idPencairan }).in('TrxID', payload.trxIds);
    return { status: 'success' };
  },
  simpanPengaturan: async (payload: any) => {
    await supabase.from('Pengaturan').update({ Nilai: payload.domain }).eq('Kunci', 'pakasir_domain');
    await supabase.from('Pengaturan').update({ Nilai: payload.apikey }).eq('Kunci', 'pakasir_apikey');
    return { status: 'success' };
  },
  tambahUser: async (payload: any) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { status: 'error', message: e.message };
    }
  },
  editUser: async (payload: any) => {
    const { error } = await supabase.from('Users').update({
      Username: payload.username, Name: payload.name, Role: payload.role, WarungID: payload.warungId
    }).eq('id', payload.id);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },
  hapusUser: async (payload: any) => {
    const id = typeof payload === 'string' ? payload : payload.id;
    await supabase.from('Users').delete().eq('ID', id);
    return { status: 'success' };
  },
  tambahRole: async (payload: any) => {
    const newId = "R" + new Date().getTime();
    const { error } = await supabase.from('Roles').insert({
      id: newId, RoleName: payload.roleName, Permissions: payload.permissions
    });
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },
  editRole: async (payload: any) => {
    const { error } = await supabase.from('Roles').update({
      RoleName: payload.roleName, Permissions: payload.permissions
    }).eq('ID', payload.id);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },
  hapusRole: async (payload: any) => {
    const id = typeof payload === 'string' ? payload : payload.id;
    await supabase.from('Roles').delete().eq('ID', id);
    return { status: 'success' };
  },
  gantiPassword: async (payload: any) => {
    const { data, error } = await supabase.auth.updateUser({
      password: payload.newPassword
    });
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },
  
  // Kas Warung API
  getKasWarung: async (payload: any) => {
    const warungId = payload?.warungId;
    let q = supabase.from('KasWarung').select('*').order('Tanggal', { ascending: false });
    if (warungId && warungId !== 'ALL') q = q.eq('WarungID', warungId);
    const { data, error } = await q;
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },
  tambahKasWarung: async (payload: any) => {
    const { error } = await supabase.from('KasWarung').insert({
      WarungID: payload.warungId,
      Tanggal: payload.tanggal,
      TipeKas: payload.tipeKas,
      Kategori: payload.kategori,
      Keterangan: payload.keterangan,
      Nominal: payload.nominal
    });
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },
  hapusKasWarung: async (payload: any) => {
    const { error } = await supabase.from('KasWarung').delete().eq('id', payload.id);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },
  getKategoriKasWarung: async (payload: any) => {
    const warungId = payload?.warungId;
    let q = supabase.from('KategoriKasWarung').select('*');
    if (warungId && warungId !== 'ALL') q = q.eq('WarungID', warungId);
    const { data, error } = await q;
    if (error) return { status: 'error', message: error.message };
    return { status: 'success', data: mapKeysToLower(data) };
  },
  tambahKategoriKasWarung: async (payload: any) => {
    const { error } = await supabase.from('KategoriKasWarung').insert({
      WarungID: payload.warungId,
      Tipe: payload.tipe,
      Nama: payload.nama
    });
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  },
  hapusKategoriKasWarung: async (payload: any) => {
    const { error } = await supabase.from('KategoriKasWarung').delete().eq('id', payload.id);
    if (error) return { status: 'error', message: error.message };
    return { status: 'success' };
  }
};
