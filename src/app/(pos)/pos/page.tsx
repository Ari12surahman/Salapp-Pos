"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from 'sonner';
import Link from "next/link";
import { Search, ArrowLeft, Trash2, CreditCard, Receipt, Loader2, Filter, QrCode, X, CheckCircle2, FileText, Download, LogOut, Camera, RefreshCw, ShoppingBag, ArrowUpRight , Copy } from "lucide-react";
import { usePosStore, Product } from "@/store/posStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateID, formatDateTimeID } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { api } from "@/lib/api/axios";
import { QRCodeSVG } from "qrcode.react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { CameraScanner } from "@/components/ui/CameraScanner";
import { useAudio } from "@/hooks/useAudio";
import { useSyncStore } from "@/store/useSyncStore";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";

export default function PosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart: originalClearCart, getCartTotal } = usePosStore();
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-produk-pos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Produk' }, (payload) => {
        // Invalidate cache immediately when Produk changes
        queryClient.invalidateQueries({ queryKey: ['products'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  const [buyerId, setBuyerId] = useState("");
  const [buyerData, setBuyerData] = useState<{nama: string, saldo: number} | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showTempPrint, setShowTempPrint] = useState(false);
  const [scannerOpen, setScannerOpen] = useState<{ isOpen: boolean, target: 'product' | 'santri' }>({ isOpen: false, target: 'product' });

  const { playBeep, playDing, playError } = useAudio();
  const { addPending } = useSyncStore();
  const [cashAmount, setCashAmount] = useState<string>("");
  const [changeAmount, setChangeAmount] = useState<number>(0);

  const { data: santriMasterData, isLoading: santriLoading, refetch: refetchSantri, isFetching: isFetchingSantri } = useQuery({
    queryKey: ['santriMaster'],
    queryFn: () => api.get('getSantri', { params: { spreadsheetId: "1jrUrg3DVS0migGJdWuzaRj4WJ65hS_ZSPG7y7bwPHe0" } }).then(res => res.data),
  });

  const { data: tabunganMasterData, refetch: refetchTabungan, isFetching: isFetchingTabungan } = useQuery({
    queryKey: ['tabunganMaster'],
    queryFn: () => api.get('getTabungan').then(res => res.data),
  });

  const { pendingQueue, removePending } = useSyncStore();
  
  useEffect(() => {
    const handleOnline = async () => {
      if (pendingQueue.length > 0) {
        toast.info(`Menyinkronkan ${pendingQueue.length} transaksi offline...`);
        let successCount = 0;
        for (const trx of pendingQueue) {
          try {
            await api.post('simpanTransaksi', trx.payload);
            removePending(trx.id);
            successCount++;
          } catch (err) {
            console.error("Gagal sync transaksi", trx.id);
          }
        }
        if (successCount > 0) toast.success(`${successCount} transaksi offline tersinkronisasi!`);
      }
    };

    window.addEventListener('online', handleOnline);
    if (navigator.onLine && pendingQueue.length > 0) {
      handleOnline();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [pendingQueue, removePending]);

  const handleLogout = () => {
    localStorage.removeItem("userPermissions");
    if (useAuthStore.getState().logout) useAuthStore.getState().logout();
    router.push("/login");
  };

  // Checkout Alert State
  const [checkoutAlert, setCheckoutAlert] = useState<{ show: boolean, type: 'success' | 'error', title: string, message: string, nama?: string } | null>(null);
  
  const showCheckoutAlert = (type: 'success' | 'error', title: string, message: string, nama?: string) => {
    setCheckoutAlert({ show: true, type, title, message, nama });
    setTimeout(() => {
      setCheckoutAlert(null);
    }, 2500);
  };

  // Pakasir State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [pakasirData, setPakasirData] = useState<{ 
    step: string, 
    qrString: string | null, 
    loading: boolean, 
    url: string, 
    isPaid: boolean, 
    checkoutUrl: string,
    isSandbox?: boolean
  }>({ 
    step: 'CHOOSE_METHOD', 
    qrString: null, 
    loading: false, 
    url: '', 
    isPaid: false, 
    checkoutUrl: '',
    isSandbox: false
  });
  const [pakasirTimeLeft, setPakasirTimeLeft] = useState(900);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let timer: any;
    if ((pakasirData.step === 'SHOW_QR' || pakasirData.step === 'SHOW_VA') && pakasirTimeLeft > 0) {
      timer = setInterval(() => {
        setPakasirTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (pakasirTimeLeft <= 0 && (pakasirData.step === 'SHOW_QR' || pakasirData.step === 'SHOW_VA')) {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [pakasirData.step, pakasirTimeLeft]);

  // Closing State
  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [closingData, setClosingData] = useState<any>(null);
  const [closingLoading, setClosingLoading] = useState(false);
  
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingBuyer, setPendingBuyer] = useState<any>(null);

  const clearCart = () => {
    originalClearCart();
    setBuyerId("");
    setBuyerData(null);
    setPaymentModalOpen(false);
    setPakasirData({ step: 'CHOOSE_METHOD', qrString: null, loading: false, url: '', isPaid: false, checkoutUrl: '' });
    if (pollingRef.current) clearInterval(pollingRef.current);
  };
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading: loadingProducts, refetch: refetchProducts, isFetching: isFetchingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('getProduk').then(res => {
      if (res?.data) {
        return res.data
          .filter((p: any) => !user?.warungId || user.warungId === 'ALL' || p.warungid === user.warungId || p.WarungID === user.warungId)
          .map((p: any) => ({
            id: p.id,
            name: p.nama,
            price: p.hargajual !== undefined ? p.hargajual : p.jual,
            stock: p.stok,
            barcode: p.barcode?.toString(),
            category: p.kategori,
            warungId: p.warungid || p.WarungID
          }));
      }
      return [];
    }).catch(() => [
      { id: "P001", name: "Nasi Kuning Telur", price: 10000, stock: 50, category: "Makanan", barcode: "1111" },
      { id: "P002", name: "Es Teh Manis", price: 3000, stock: 100, category: "Minuman", barcode: "2222" },
      { id: "P003", name: "Kitab Safinah", price: 25000, stock: 20, category: "Kitab", barcode: "3333" },
    ])
  });

  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const productsRef = useRef<any[]>([]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan jika user sedang mengetik di dalam input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const currentTime = Date.now();
      // Reset buffer jika jeda antar ketikan lebih dari 100ms (berarti diketik manual oleh manusia)
      if (currentTime - lastKeyTimeRef.current > 100) {
        barcodeBufferRef.current = "";
      }
      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter') {
        const barcode = barcodeBufferRef.current;
        if (barcode.length >= 3) {
          e.preventDefault(); // Mencegah action bawaan browser
          e.stopPropagation(); // Mencegah event turun ke element tombol di bawahnya (capture phase)
          
          const exactProduct = productsRef.current.find((p: any) => p.barcode === barcode);
          if (exactProduct) {
            addToCart(exactProduct);
            playBeep();
            toast.success(`${exactProduct.name} ditambahkan via scanner`);
          } else {
            playError();
            toast.error("Barcode tidak ditemukan: " + barcode);
          }
        }
        barcodeBufferRef.current = "";
        return;
      }

      // Hindari mendaftarkan tombol khusus (Shift, CapsLock, dll)
      if (e.key.length === 1) {
        // Jika sedang scan, hilangkan fokus dari tombol apapun yang sedang aktif agar aman dari klik tidak sengaja
        if (document.activeElement instanceof HTMLElement && !(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement)) {
          document.activeElement.blur();
        }
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [addToCart, playBeep, playError]);

  const filteredProducts = products.filter((p: any) => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode?.includes(search)
  );

  const checkSantri = async (overrideId?: string) => {
    const idToCheck = overrideId || buyerId;
    if (!idToCheck) {
      toast.warning("Scan RFID terlebih dahulu!");
      return;
    }
    
    try {
      if (santriMasterData) {
        const foundSantri = santriMasterData.find((s: any) => String(s.nis) === String(idToCheck) || String(s.uid) === String(idToCheck));
        
        if (foundSantri) {
          let saldo = 0;
          if (tabunganMasterData && Array.isArray(tabunganMasterData)) {
            const sNisClean = String(foundSantri.nis).replace(/^0+/, '');
            const foundTabunganRows = tabunganMasterData.filter((t: any) => 
              String(t.NIS || t.nis).replace(/^0+/, '') === sNisClean
            );
            saldo = foundTabunganRows.reduce((sum: number, t: any) => {
              const nom = Number(t.Nominal || t.nominal || t.Saldo || t.saldo || 0);
              const jenis = String(t.Jenis || t.jenis || 'Setor').toLowerCase();
              return jenis === 'tarik' ? sum - nom : sum + nom;
            }, 0);
          }

          setBuyerData({ nama: foundSantri.nama, saldo: saldo });
          setBuyerId(String(foundSantri.nis));
          
          if (saldo >= getCartTotal()) {
            // Saldo cukup, tampilkan modal PIN
            setPendingBuyer(foundSantri);
            setEnteredPin("");
            setPinModalOpen(true);
            setPaymentModalOpen(false); // Tutup modal pembayaran
            playDing();
          } else {
            playError();
            showCheckoutAlert('error', 'SALDO TIDAK MENCUKUPI', `Saldo Saat Ini: Rp ${saldo.toLocaleString('id-ID')}`, foundSantri.nama);
          }
        } else {
          toast.error("Santri tidak ditemukan di master data!");
          setBuyerData(null);
          playError();
        }
      } else {
        toast.error("Data master santri belum siap. Tunggu sebentar.");
      }
    } catch (err) {
      toast.error("Gagal mengecek data santri");
      playError();
    }
  };

  const handlePinInput = (num: string) => {
    if (enteredPin.length < 6) {
      setEnteredPin(prev => prev + num);
    }
  };

  const verifyPinLocal = () => {
    if (!pendingBuyer) return;
    
    // Cek PIN di database, jika kosong gunakan default NIS
    const correctPin = pendingBuyer.pin ? String(pendingBuyer.pin) : String(pendingBuyer.nis);
    
    if (enteredPin === correctPin) {
      // PIN Benar
      const saldo = buyerData?.saldo || 0;
      showCheckoutAlert('success', 'PEMBAYARAN BERHASIL', `Saldo Sisa: Rp ${(saldo - getCartTotal()).toLocaleString('id-ID')}`, pendingBuyer.nama);
      processCheckout('Tabungan', String(pendingBuyer.nis));
      setPinModalOpen(false);
      setPendingBuyer(null);
      setEnteredPin("");
    } else {
      // PIN Salah
      toast.error("PIN Salah!");
      playError();
      setEnteredPin("");
    }
  };

  // Keyboard listener untuk PIN Modal
  useEffect(() => {
    if (!pinModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinInput(e.key);
      } else if (e.key === 'Backspace') {
        setEnteredPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (enteredPin.length >= 4) {
          verifyPinLocal();
        }
      } else if (e.key === 'Escape') {
        setPinModalOpen(false);
        setPendingBuyer(null);
        setEnteredPin("");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinModalOpen, enteredPin, pendingBuyer, buyerData]);

  const processCheckout = async (method = 'Tunai', specificBuyerId?: string) => {
    setIsProcessing(true);
    try {
      const activeSantriId = specificBuyerId || buyerId || "GUEST";
      let fcmToken = null;
      let buyerName = buyerData?.nama || "GUEST";
      let exactNis = activeSantriId;

      if (santriMasterData && activeSantriId !== "GUEST") {
        const santri = santriMasterData.find((s: any) => String(s.nis).replace(/^0+/, '') === String(activeSantriId).replace(/^0+/, ''));
        if (santri) {
          fcmToken = santri.fcm_token;
          buyerName = santri.nama || buyerName;
          exactNis = santri.nis;
        }
      }

      const payload = {
        santriId: exactNis,
        warungId: (user?.warungId === 'ALL' && cart.length > 0) ? (cart[0].warungId || 'ALL') : (user?.warungId || "UNKNOWN"),
        method: method,
        total: getCartTotal(),
        items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, quantity: c.quantity })),
        fcmToken: fcmToken,
        buyerName: buyerName
      };
      
      let isOffline = false;
      try {
        const res = await api.post('simpanTransaksi', payload);
        if (res.status === "error" || (res.data && res.data.status === "error")) {
          throw new Error((res.data && res.data.message) || res.message || "Gagal menyimpan transaksi");
        }
        setLastTransaction({ ...payload, trxId: res.data?.trxId, waktu: formatDateTimeID(new Date()), method });
        
        if (method === 'Tabungan') {
          if (buyerData) {
            setBuyerData((prev: any) => prev ? { ...prev, saldo: prev.saldo - getCartTotal() } : prev);
          }
          if (typeof refetchTabungan === 'function') {
            refetchTabungan();
          }
        }
      } catch (err: any) {
        if (!navigator.onLine || err.message === "Network Error" || err.message === "Failed to fetch" || err.message?.includes("fetch")) {
          toast.warning("Koneksi terputus. Disimpan ke antrean offline.");
          addPending(payload);
          isOffline = true;
          setLastTransaction({ ...payload, trxId: "OFFLINE-" + Date.now(), waktu: formatDateTimeID(new Date()), method });
        } else {
          throw err;
        }
      }

      playDing();
      setShowPrint(true);
      clearCart();
    } catch (err: any) {
      playError();
      toast.error("Gagal: " + (err.message || "Terjadi kesalahan server"));
    } finally {
      setIsProcessing(false);
    }
  };

  const printTemporaryBill = () => {
    if (cart.length === 0) {
      toast.warning("Keranjang kosong!");
      return;
    }
    setShowTempPrint(true);
  };

  const pollPakasirStatus = (orderId: string, amount: number) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    pollingRef.current = setInterval(async () => {
      try {
        const savedDomain = localStorage.getItem("PAKASIR_DOMAIN") || "depodomain";
        const savedApiKey = localStorage.getItem("PAKASIR_APIKEY") || "xxx123";

        const payload = { slug: savedDomain, amount, orderId, apiKey: savedApiKey };
        const res = await fetch('/api/pakasir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pollPakasirStatus', data: payload })
        }).then(r => r.json());
        
        const statusStr = (res?.transaction?.status || res?.payment?.status || res?.status || '').toLowerCase();
        if (['completed', 'success', 'settlement', 'paid', 'lunas'].includes(statusStr) || res?.data?.status === 'Lunas') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPakasirData(prev => ({ ...prev, isPaid: true, step: 'PAID' }));
          
          // Auto checkout
          await processCheckout(paymentMethod);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000);
  };

  const generatePakasir = async (type: string) => {
    setPakasirData(prev => ({ ...prev, loading: true }));
    try {
      // Retrieve credentials from localStorage
      const savedDomain = localStorage.getItem("PAKASIR_DOMAIN") || "depodomain";
      const savedApiKey = localStorage.getItem("PAKASIR_APIKEY") || "xxx123";

      // Unique Order ID
      const orderId = `POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const amount = getCartTotal();
      
      const dbPayload = {
        orderId,
        santriId: buyerId || pendingBuyer?.nis || null,
        buyerName: buyerData?.nama || pendingBuyer?.nama || "Guest",
        total: amount,
        method: type,
        slug: savedDomain,
        apiKey: savedApiKey,
        warungId: (user?.warungId === 'ALL' && cart.length > 0) ? (cart[0].warungId || 'ALL') : (user?.warungId || "UNKNOWN"),
        items: cart.map((c: any) => ({ id: c.id, name: c.name, price: c.price, quantity: c.quantity }))
      };

      await supabase.from('PakasirOrders').insert([{
        order_id: orderId,
        tipe: 'POS',
        status: 'PENDING',
        payload: dbPayload
      }]);

      const payload = { slug: savedDomain, method: type, amount, orderId, apiKey: savedApiKey };
      
      const response = await fetch('/api/pakasir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'requestPakasirPayment', data: payload })
      }).then(r => r.json());
      const res = typeof response === 'string' ? JSON.parse(response) : response;

      if (res?.status === 'success' || res?.checkout_url || (res?.data && (res?.data?.status === 'success' || res?.data?.payment_number)) || res?.payment || res?.payment_number) {
        const paymentData = res?.payment || res?.data || res;
        const checkoutUrl = paymentData.checkout_url || paymentData.url;
        const qrString = paymentData.payment_number || paymentData.qr_string || null;
        
        // Detect sandbox mode from the QR string response or VA dummy number
        const isSandboxServer = qrString && (qrString.toUpperCase().includes('SANDBOX') || qrString === '123123123');
        setPakasirTimeLeft(900);
        setPakasirData({
          step: type === 'qris' ? 'SHOW_QR' : 'SHOW_VA',
          qrString,
          url: paymentData.url || checkoutUrl,
          loading: false,
          isPaid: false,
          checkoutUrl,
          isSandbox: isSandboxServer
        });
        pollPakasirStatus(orderId, amount);
      } else {
        toast.warning(res?.message || res?.error || res?.data?.message || res?.data?.error || "API Pakasir belum disetting (Mode Sandbox Aktif)"); console.error("Pakasir API Error:", res);
        setPakasirData({
          step: type === 'qris' ? 'SHOW_QR' : 'SHOW_VA',
          qrString: type === 'qris' ? 'SANDBOX-QR-' + Date.now() : '1234567890 (SANDBOX)',
          url: 'https://sandbox.pakasir.com/simulate',
          loading: false,
          isPaid: false,
          checkoutUrl: 'https://sandbox.pakasir.com/simulate',
          isSandbox: true
        });
      }
    } catch (err: any) {
      toast.error("Error menghubungi Pakasir: " + err.message);
      setPakasirData(prev => ({ ...prev, loading: false }));
    }
  };

  const handlePayClick = () => {
    if (cart.length === 0) return;
    
    // Reset state bayar
    setBuyerData(null);
    setBuyerId("");
    setPakasirData({ step: 'CHOOSE_METHOD', qrString: null, loading: false, url: '', isPaid: false, checkoutUrl: '' });
    setPaymentModalOpen(true);
  };

  const handleClosing = async () => {
    setClosingModalOpen(true);
    setClosingLoading(true);
    try {
      const res = await api.get('getTransaksi');
      if (res && res.data) {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
        
        let totalTunai = 0;
        let totalQris = 0;
        let totalVa = 0;
        let totalTabungan = 0;
        let count = 0;

        res.data.forEach((trx: any) => {
          // Check if same warung
          const wId = trx.warungid || trx.WarungID;
          if (user?.warungId !== 'ALL' && wId !== user?.warungId) return;

          // Check if today
          let trxDate = "";
          const wStr = String(trx.waktu || trx.Waktu);
          let parsedDate = new Date(wStr);
          if (parsedDate.toString() === "Invalid Date" && wStr.includes('/')) {
            const datePart = wStr.split(',')[0]; // "14/6/2026"
            const parts = datePart.split('/'); // ["14", "6", "2026"]
            if (parts.length === 3) {
              parsedDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            }
          }
          if (parsedDate.toString() !== "Invalid Date") {
            trxDate = parsedDate.toLocaleDateString('en-CA');
          }

          if (trxDate === today) {
            count++;
            const total = Number(trx.totalharga || trx.TotalHarga || 0);
            const method = String(trx.metode || trx.Metode || "Tunai").toLowerCase();
            
            if (method.includes('qris')) totalQris += total;
            else if (method.includes('va') || method.includes('virtual')) totalVa += total;
            else if (method.includes('tabungan')) totalTabungan += total;
            else totalTunai += total;
          }
        });

        setClosingData({
          date: formatDateID(new Date()),
          count,
          totalTunai,
          totalQris,
          totalVa,
          totalTabungan,
          grandTotal: totalTunai + totalQris + totalVa + totalTabungan
        });
      }
    } catch (err) {
      toast.error("Gagal mengambil data transaksi harian.");
    } finally {
      setClosingLoading(false);
    }
  };

  const handleExportClosingCSV = () => {
    if (!closingData) return;
    
    const htmlTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Rekap Tutup Kasir</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; }
        th, td { border: 1px solid #000000; padding: 8px; font-size: 14px; }
        .header { background-color: #22c55e; color: #ffffff; font-size: 18px; font-weight: bold; text-align: center; }
        .label { font-weight: bold; background-color: #f3f4f6; }
        .val { text-align: right; }
        .grand-total-label { font-weight: bold; background-color: #e5e7eb; font-size: 16px; }
        .grand-total-val { font-weight: bold; background-color: #e5e7eb; font-size: 16px; text-align: right; color: #166534; }
      </style>
      </head>
      <body>
        <table>
          <tr><th colspan="2" class="header">LAPORAN TUTUP KASIR</th></tr>
          <tr><td class="label" width="150">Tanggal</td><td class="val" width="150">${closingData.date}</td></tr>
          <tr><td class="label">Total Transaksi</td><td class="val">${closingData.count}</td></tr>
          <tr><td class="label">Pendapatan Tunai</td><td class="val">Rp ${closingData.totalTunai.toLocaleString('id-ID')}</td></tr>
          <tr><td class="label">Pendapatan QRIS</td><td class="val">Rp ${closingData.totalQris.toLocaleString('id-ID')}</td></tr>
          <tr><td class="label">Virtual Account</td><td class="val">Rp ${closingData.totalVa.toLocaleString('id-ID')}</td></tr>
          <tr><td class="label">Potong Tabungan</td><td class="val">Rp ${closingData.totalTabungan.toLocaleString('id-ID')}</td></tr>
          <tr><td class="grand-total-label">GRAND TOTAL</td><td class="grand-total-val">Rp ${closingData.grandTotal.toLocaleString('id-ID')}</td></tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Tutup_Kasir_${new Date().toLocaleDateString('en-CA')}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex w-full h-full relative">
      {/* LEFT & CENTER: PRODUCTS SECTION */}
      <div className="flex-1 flex flex-col bg-background border-r border-border min-w-0 print:hidden">
        {/* Topbar POS */}
        <header className="h-14 border-b border-border flex items-center px-2 lg:px-4 justify-between bg-card gap-2">
          <div className="flex items-center gap-2 lg:gap-4 shrink-0">
            <Link href="/" className="p-2 border border-border hover:bg-accent hover:text-accent-foreground transition-colors rounded-md">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-black text-lg lg:text-xl tracking-tighter uppercase hidden sm:block">TERMINAL KASIR</h1>
          </div>
          <div className="flex items-center gap-2 flex-1 lg:max-w-md justify-end">
            <div className="relative w-full max-w-xs lg:max-w-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Scan Barcode / Cari (F2)" 
                className="pl-9 pr-9 bg-background uppercase font-mono"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim();
                    if (val !== '') {
                      const exactBarcode = products.find((p: any) => p.barcode === val);
                      if (exactBarcode) {
                        if (Number(exactBarcode.stock) > 0) {
                          addToCart(exactBarcode);
                          playBeep();
                          setSearch("");
                        } else {
                          toast.error("Stok habis!");
                          playError();
                        }
                        return;
                      }
                      
                      const currentFiltered = products.filter((p: any) => 
                        p.name?.toLowerCase().includes(val.toLowerCase()) || 
                        p.barcode?.includes(val)
                      );

                      if (currentFiltered.length === 1) {
                        const p = currentFiltered[0];
                        if (Number(p.stock) > 0) {
                          addToCart(p);
                          playBeep();
                          setSearch("");
                        } else {
                          toast.error("Stok habis!");
                          playError();
                        }
                        return;
                      }
                      if (currentFiltered.length > 1) {
                        toast.warning("Ada beberapa produk yang mirip. Silakan klik produk yang dimaksud.");
                      } else {
                        toast.error("Produk tidak ditemukan!");
                        playError();
                      }
                    }
                  }
                }}
                autoFocus
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={() => setScannerOpen({ isOpen: true, target: 'product' })}
              >
                <Camera className="w-4 h-4" />
              </Button>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              className="shrink-0"
              onClick={() => {
                refetchProducts();
                refetchSantri();
                refetchTabungan();
                toast.info("Menyinkronkan data terbaru...");
              }}
              disabled={isFetchingProducts || isFetchingSantri || isFetchingTabungan}
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingProducts || isFetchingSantri || isFetchingTabungan ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="icon" className="shrink-0"><Filter className="w-4 h-4" /></Button>
            <Button variant="secondary" onClick={handleClosing} className="font-bold hidden lg:flex">
              TUTUP KASIR
            </Button>
            <Button variant="secondary" size="icon" onClick={handleClosing} className="lg:hidden shrink-0">
              <FileText className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="icon" onClick={handleLogout} className="shrink-0 group relative">
              <LogOut className="w-4 h-4" />
              <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform bg-foreground text-background px-2 py-1 text-xs font-mono">LOGOUT</span>
            </Button>
          </div>
        </header>

        {/* Product Grid */}
        <main className="flex-1 overflow-y-auto p-4 bg-muted/30 pb-28 lg:pb-4 relative">
          {loadingProducts ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <span className="font-mono text-sm uppercase tracking-widest">MEMUAT PRODUK...</span>
            </div>
          ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filteredProducts.map((product: any) => (
              <div 
                key={product.id}
                onClick={() => { 
                  if (Number(product.stock) > 0) {
                    addToCart(product); 
                    playBeep(); 
                  } else {
                    toast.error("Stok habis!");
                    playError();
                  }
                }}
                className={`p-4 cursor-pointer hover:bg-primary hover:text-primary-foreground group transition-colors flex flex-col h-32 justify-between relative overflow-hidden ${Number(product.stock) === 0 ? "opacity-60 bg-muted cursor-not-allowed" : "bg-background"}`}
              >
                {Number(product.stock) <= 5 && Number(product.stock) > 0 && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1 rounded animate-pulse">SISA {product.stock}</div>
                )}
                {Number(product.stock) === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50 backdrop-blur-[1px]">
                    <span className="bg-red-600 text-white font-black px-3 py-1 rotate-[-15deg] border-2 border-white shadow-lg text-sm">HABIS</span>
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <span className="font-mono text-[10px] uppercase border border-current px-1 z-0">{product.category}</span>
                  <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary-foreground/70 z-0">STK:{product.stock}</span>
                </div>
                <div className="z-0">
                  <h3 className="font-bold leading-tight mb-1">{product.name}</h3>
                  <p className="font-mono text-sm">Rp {Number(product.price || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
            ))}
          </div>
          )}
        </main>
      </div>

      {/* RIGHT: CART SECTION (DESKTOP) */}
      <aside className="hidden lg:flex w-96 flex-col bg-background shrink-0 print:hidden border-l border-border">
        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border text-muted-foreground font-mono text-sm uppercase">
              Keranjang Kosong
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex flex-col border border-border p-3 gap-2">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm uppercase">{item.name}</span>
                  <button onClick={() => removeFromCart(item.id)} className="text-destructive hover:bg-destructive/10 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center border border-border">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-2 py-1 bg-muted hover:bg-accent font-mono"
                    >-</button>
                    <span className="px-3 py-1 font-mono text-sm">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-2 py-1 bg-muted hover:bg-accent font-mono"
                    >+</button>
                  </div>
                  <span className="font-mono font-bold">Rp {Number((item.price || 0) * item.quantity).toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer / Checkout */}
        <div className="border-t-2 border-border p-4 bg-card flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="font-bold uppercase tracking-widest text-sm text-muted-foreground">TOTAL</span>
            <span className="text-3xl font-black tracking-tighter">
              Rp {Number(getCartTotal() || 0).toLocaleString('id-ID')}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 w-full gap-2" onClick={clearCart}>
              <Trash2 className="w-4 h-4" /> Batal
            </Button>
            <Button variant="secondary" className="h-12 w-full gap-2" onClick={printTemporaryBill}>
              <Receipt className="w-4 h-4" /> Cetak
            </Button>
          </div>
          <Button 
            className="h-14 w-full text-lg gap-2" 
            disabled={cart.length === 0 || isProcessing}
            onClick={handlePayClick}
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />} 
            {isProcessing ? "MEMPROSES..." : "BAYAR (F12)"}
          </Button>
        </div>
      </aside>

      {/* MOBILE FLOATING CART BAR */}
      {cart.length > 0 && !mobileCartOpen && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 bg-primary text-primary-foreground rounded-2xl shadow-2xl z-40 p-4 flex items-center justify-between" onClick={() => setMobileCartOpen(true)}>
          <div className="flex items-center gap-3">
            <div className="bg-primary-foreground/20 w-10 h-10 flex items-center justify-center rounded-xl relative">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-primary">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase opacity-80">Total Belanja</span>
              <span className="font-black text-lg leading-tight">Rp {Number(getCartTotal()).toLocaleString('id-ID')}</span>
            </div>
          </div>
          <div className="bg-primary-foreground/20 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm">
            Lihat <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* MOBILE CART BOTTOM SHEET */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-bottom-full duration-300">
          <div className="p-4 border-b border-border bg-card flex justify-between items-center sticky top-0 z-10">
            <h2 className="font-black text-xl tracking-tighter uppercase">KERANJANG</h2>
            <Button variant="ghost" size="icon" onClick={() => setMobileCartOpen(false)} className="w-10 h-10 rounded-full">
              <X className="w-6 h-6" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-muted/20 pb-4">
            {/* Cart Items */}
            <div className="p-4 flex flex-col gap-3">
              {cart.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mb-3 opacity-20" />
                  <span className="font-bold text-sm uppercase">Keranjang Kosong</span>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex flex-col border border-border bg-card rounded-xl p-4 shadow-sm gap-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-sm leading-tight flex-1">{item.name}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-destructive bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground transition-colors p-2 rounded-lg shrink-0 w-10 h-10 flex items-center justify-center">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-10 h-10 flex items-center justify-center bg-background rounded-md shadow-sm font-bold active:scale-95"
                        >-</button>
                        <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-md shadow-sm font-bold active:scale-95"
                        >+</button>
                      </div>
                      <span className="font-black text-lg tracking-tighter">Rp {Number((item.price || 0) * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Fixed Footer */}
          <div className="border-t border-border bg-card p-4 pb-8 flex flex-col gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold uppercase text-muted-foreground text-sm">TOTAL</span>
              <span className="text-3xl font-black tracking-tighter text-primary">
                Rp {Number(getCartTotal() || 0).toLocaleString('id-ID')}
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="h-14 flex-1 rounded-xl font-bold" onClick={() => { clearCart(); setMobileCartOpen(false); }}>
                <Trash2 className="w-5 h-5 mr-2" /> BATAL
              </Button>
              <Button variant="secondary" className="h-14 flex-1 rounded-xl font-bold" onClick={printTemporaryBill}>
                <Receipt className="w-5 h-5 mr-2" /> CETAK
              </Button>
            </div>
            
            <Button 
              className="h-16 w-full text-lg gap-2 rounded-xl font-black" 
              disabled={cart.length === 0 || isProcessing}
              onClick={() => { handlePayClick(); setMobileCartOpen(false); }}
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />} 
              {isProcessing ? "MEMPROSES..." : "BAYAR SEKARANG"}
            </Button>
          </div>
        </div>
      )}

      {/* MODAL PILIH PEMBAYARAN */}
      {pinModalOpen && pendingBuyer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-canvas w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center border-b border-whisper">
              <h2 className="text-xl font-bold text-ink mb-1">Masukkan PIN</h2>
              <p className="text-sm text-steel">Tabungan: {pendingBuyer.nama}</p>
              
              <div className="flex justify-center gap-3 my-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-full ${i < enteredPin.length ? 'bg-blue-600' : 'bg-whisper'}`}></div>
                ))}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50">
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button key={num} onClick={() => handlePinInput(String(num))} className="h-14 rounded-xl bg-white border border-whisper text-xl font-semibold text-ink shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
                    {num}
                  </button>
                ))}
                <button onClick={() => {
                  setPinModalOpen(false);
                  setPendingBuyer(null);
                  setEnteredPin("");
                }} className="h-14 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 active:scale-95 transition-all">
                  Batal
                </button>
                <button onClick={() => handlePinInput("0")} className="h-14 rounded-xl bg-white border border-whisper text-xl font-semibold text-ink shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
                  0
                </button>
                <button onClick={() => setEnteredPin(prev => prev.slice(0, -1))} className="h-14 rounded-xl bg-amber-50 text-amber-600 font-medium hover:bg-amber-100 active:scale-95 transition-all flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 4-14 8 14 8V4Z"/><path d="M7 12h14"/></svg>
                </button>
              </div>
              
              <button 
                onClick={verifyPinLocal} 
                disabled={enteredPin.length < 4}
                className={`w-full mt-4 h-12 rounded-xl font-bold flex items-center justify-center transition-all ${enteredPin.length >= 4 ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' : 'bg-whisper text-steel cursor-not-allowed'}`}
              >
                KONFIRMASI
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-card border-4 border-border w-full max-w-md flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => {
                setPaymentModalOpen(false);
                if (pollingRef.current) clearInterval(pollingRef.current);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="p-6 border-b-4 border-border text-center">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">PILIH PEMBAYARAN</h2>
              <div className="text-4xl font-black tracking-tighter text-primary">
                Rp {Number(getCartTotal() || 0).toLocaleString('id-ID')}
              </div>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              {pakasirData.step === 'CHOOSE_METHOD' && (
                <>
                  <Button 
                    className="h-16 text-lg font-bold flex justify-between px-6" 
                    variant="outline"
                    onClick={() => { setPaymentMethod('Tunai'); setPakasirData({ ...pakasirData, step: 'CASH_INPUT' }); }}
                  >
                    <span>BAYAR TUNAI</span>
                    <CreditCard className="w-6 h-6" />
                  </Button>
                  <Button 
                    className="h-16 text-lg font-bold flex justify-between px-6 bg-green-600 hover:bg-green-700 text-white border-green-800" 
                    onClick={() => { setPaymentMethod('Tabungan'); setPakasirData({ ...pakasirData, step: 'SCAN_TABUNGAN' }); }}
                  >
                    <span>BAYAR PAKAI TABUNGAN</span>
                    <Receipt className="w-6 h-6" />
                  </Button>
                  <Button 
                    className="h-16 text-lg font-bold flex justify-between px-6 bg-blue-600 hover:bg-blue-700 text-white border-blue-800" 
                    onClick={() => { setPaymentMethod('QRIS'); generatePakasir('qris'); }}
                    disabled={pakasirData.loading}
                  >
                    <span>{pakasirData.loading && paymentMethod === 'QRIS' ? "MEMPROSES..." : "BAYAR QRIS"}</span>
                    <QrCode className="w-6 h-6" />
                  </Button>
                  <Button 
                    className="h-16 text-lg font-bold flex justify-between px-6 bg-orange-600 hover:bg-orange-700 text-white border-orange-800" 
                    onClick={() => { setPaymentMethod('VA'); setPakasirData({ ...pakasirData, step: 'CHOOSE_VA' }); }}
                    disabled={pakasirData.loading}
                  >
                    <span>VIRTUAL ACCOUNT</span>
                    <CreditCard className="w-6 h-6" />
                  </Button>
                </>
              )}

              {pakasirData.step === 'CHOOSE_VA' && (
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-2">
                  <div className="flex items-center justify-between mb-2 border-b border-border pb-2">
                    <h3 className="font-bold text-lg">Pilih Bank VA</h3>
                    <Button variant="ghost" size="sm" onClick={() => setPakasirData({ ...pakasirData, step: 'CHOOSE_METHOD' })}>Kembali</Button>
                  </div>
                  
                  {[
                    { id: 'bni_va', name: 'BNI VA', color: 'text-orange-600' },
                    { id: 'bri_va', name: 'BRI VA', color: 'text-blue-700' },
                    { id: 'cimb_niaga_va', name: 'CIMB Niaga VA', color: 'text-red-600' },
                    { id: 'permata_va', name: 'Permata VA', color: 'text-emerald-600' },
                    { id: 'sampoerna_va', name: 'Sahabat Sampoerna VA', color: 'text-red-500' },
                    { id: 'bnc_va', name: 'BNC VA', color: 'text-yellow-500' },
                    { id: 'maybank_va', name: 'Maybank VA', color: 'text-yellow-600' },
                    { id: 'atm_bersama_va', name: 'ATM Bersama VA', color: 'text-blue-500' },
                    { id: 'artha_graha_va', name: 'Artha Graha VA', color: 'text-blue-800' }
                  ].map((bank) => (
                    <Button 
                      key={bank.id}
                      variant="outline" 
                      className="h-14 text-md font-bold flex justify-between px-4 border-2 hover:bg-slate-50"
                      onClick={() => generatePakasir(bank.id)}
                      disabled={pakasirData.loading}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className={`w-5 h-5 ${bank.color}`} />
                        <span>{bank.name}</span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400" />
                    </Button>
                  ))}
                </div>
              )}

              {pakasirData.step === 'SCAN_TABUNGAN' && (
                <div className="flex flex-col gap-4">
                  <p className="font-bold uppercase tracking-widest text-center">SCAN RFID</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input 
                        type="text"
                        style={{ WebkitTextSecurity: 'disc' } as any}
                        autoComplete="off"
                        placeholder="Scan RFID..." 
                        className="font-mono uppercase text-sm pr-10 h-14 rounded-xl" 
                        value={buyerId}
                        onChange={(e) => setBuyerId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                            checkSantri();
                          }
                        }}
                        autoFocus
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-12 w-12 text-muted-foreground hover:text-primary rounded-lg"
                        onClick={() => setScannerOpen({ isOpen: true, target: 'santri' })}
                      >
                        <Camera className="w-6 h-6" />
                      </Button>
                    </div>
                    <Button variant={buyerId ? "default" : "outline"} className="h-14 px-6 rounded-xl font-bold" onClick={() => checkSantri()}>
                      CEK
                    </Button>
                  </div>

                  {buyerData ? (
                    <div className={`p-4 rounded-xl border-2 font-mono ${buyerData.saldo >= getCartTotal() ? 'bg-green-100 text-green-800 border-green-500 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 border-red-500 dark:bg-red-900/30 dark:text-red-400'}`}>
                      <p className="text-sm uppercase font-bold">{buyerData.nama}</p>
                      <p className="text-xl font-black mt-1">Saldo: Rp {buyerData.saldo.toLocaleString('id-ID')}</p>
                      {buyerData.saldo < getCartTotal() && (
                        <p className="text-sm mt-2 font-bold text-red-600">SALDO TIDAK MENCUKUPI!</p>
                      )}
                    </div>
                  ) : (
                    <div className="border-4 border-dashed border-muted p-8 flex flex-col items-center text-center w-full justify-center opacity-50 mt-4 rounded-xl">
                      <CreditCard className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                      <p className="text-xl font-black text-muted-foreground uppercase tracking-tighter">MENUNGGU SCAN</p>
                      <p className="text-sm font-mono text-muted-foreground mt-2">
                        Silakan scan RFID santri
                      </p>
                    </div>
                  )}

                  <Button 
                    className="h-16 text-xl font-bold bg-green-600 hover:bg-green-700 text-white mt-2"
                    disabled={!buyerData || buyerData.saldo < getCartTotal() || isProcessing}
                    onClick={() => {
                      processCheckout('Tabungan');
                      setPaymentModalOpen(false);
                    }}
                  >
                    {isProcessing ? "MEMPROSES..." : "KONFIRMASI POTONG SALDO"}
                  </Button>
                  <Button variant="ghost" onClick={() => setPakasirData({ ...pakasirData, step: 'CHOOSE_METHOD' })}>
                    KEMBALI
                  </Button>
                </div>
              )}

              {pakasirData.step === 'CASH_INPUT' && (
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2 mb-2">
                    <Button variant="outline" className="flex-1 font-mono text-xs" onClick={() => setCashAmount(getCartTotal().toString())}>PAS</Button>
                    <Button variant="outline" className="flex-1 font-mono text-xs" onClick={() => setCashAmount("20000")}>20K</Button>
                    <Button variant="outline" className="flex-1 font-mono text-xs" onClick={() => setCashAmount("50000")}>50K</Button>
                    <Button variant="outline" className="flex-1 font-mono text-xs" onClick={() => setCashAmount("100000")}>100K</Button>
                  </div>
                  <Input 
                    type="number" 
                    value={cashAmount} 
                    onChange={(e) => setCashAmount(e.target.value)} 
                    placeholder="Uang yang diterima..."
                    className="h-16 text-2xl font-black text-center font-mono"
                    autoFocus
                  />
                  {Number(cashAmount) >= getCartTotal() ? (
                    <div className="p-4 bg-green-100 text-green-800 text-center rounded-lg border-2 border-green-500 mb-2 font-mono dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                      <p className="text-sm uppercase font-bold">KEMBALIAN</p>
                      <p className="text-3xl font-black tracking-tighter">Rp {(Number(cashAmount) - getCartTotal()).toLocaleString('id-ID')}</p>
                    </div>
                  ) : (
                    cashAmount !== "" && (
                      <div className="p-4 bg-red-100 text-red-800 text-center rounded-lg border-2 border-red-500 mb-2 font-mono dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                        <p className="text-sm uppercase font-bold">UANG KURANG</p>
                      </div>
                    )
                  )}
                  <Button 
                    className="h-16 text-xl font-bold bg-green-600 hover:bg-green-700 text-white"
                    disabled={Number(cashAmount) < getCartTotal() || isProcessing}
                    onClick={() => {
                      setChangeAmount(Number(cashAmount) - getCartTotal());
                      processCheckout('Tunai');
                      setPaymentModalOpen(false);
                    }}
                  >
                    {isProcessing ? "MEMPROSES..." : "SELESAIKAN"}
                  </Button>
                  <Button variant="ghost" onClick={() => setPakasirData({ ...pakasirData, step: 'CHOOSE_METHOD' })}>
                    KEMBALI
                  </Button>
                </div>
              )}

              {pakasirData.step === 'SHOW_QR' && (
                <div className="flex flex-col items-center gap-4 text-center">
                  <p className="font-bold uppercase tracking-widest">{paymentMethod} GENERATED</p>
                  
                  {pakasirTimeLeft > 0 ? (
                    <>
                      <p className="text-sm font-bold text-red-600 mb-1">
                        Selesaikan pembayaran sebelum waktu habis: {Math.floor(pakasirTimeLeft / 60)}:{(pakasirTimeLeft % 60).toString().padStart(2, '0')}
                      </p>
                      <p className="text-xs font-bold text-red-600 text-center px-4 mb-4">
                        ⚠️ Mohon JANGAN tutup halaman ini atau keluar dari aplikasi sebelum pembayaran selesai.
                      </p>
                      
                      {pakasirData.qrString ? (
                        <div className="flex flex-col items-center">
                          <div className="p-4 bg-white rounded-lg border-4 border-border relative mb-4">
                            <QRCodeSVG value={pakasirData.qrString} size={200} id="qris-svg" />
                            {pakasirData.isSandbox && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/80 font-bold text-red-600 text-xl rotate-[-20deg] border-4 border-red-600">
                                SANDBOX MODE
                              </div>
                            )}
                          </div>
                          <Button variant="outline" className="mb-4" onClick={() => {
                            const svg = document.getElementById('qris-svg');
                            if (svg) {
                              const svgData = new XMLSerializer().serializeToString(svg);
                              const canvas = document.createElement("canvas");
                              const ctx = canvas.getContext("2d");
                              const img = new Image();
                              img.onload = () => {
                                canvas.width = img.width;
                                canvas.height = img.height;
                                ctx?.drawImage(img, 0, 0);
                                const a = document.createElement("a");
                                a.download = "QRIS.png";
                                a.href = canvas.toDataURL("image/png");
                                a.click();
                              };
                              img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                            }
                          }}>
                            <Download className="w-4 h-4 mr-2" /> Download QRIS
                          </Button>
                        </div>
                      ) : pakasirData.url ? (
                        <a href={pakasirData.url} target="_blank" className="text-blue-500 underline font-bold" rel="noreferrer">
                          Buka Halaman Pembayaran
                        </a>
                      ) : null}
                      
                      <p className="text-sm text-muted-foreground animate-pulse flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Menunggu Pembayaran...
                      </p>
                    </>
                  ) : (
                    <p className="text-base font-bold text-red-600 mb-4">Waktu Pembayaran Habis!</p>
                  )}

                  {/* TOMBOL SIMULASI SANDBOX */}
                  {pakasirData.isSandbox && (
                    <Button 
                      variant="destructive" 
                      className="mt-2 w-full animate-pulse border-2 border-red-800"
                      onClick={() => {
                        if (pollingRef.current) clearInterval(pollingRef.current);
                        setPakasirData(prev => ({ ...prev, isPaid: true, step: 'PAID' }));
                        processCheckout(paymentMethod);
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      SIMULASI LUNAS (SANDBOX)
                    </Button>
                  )}

                  

                  <Button variant="outline" className="w-full font-bold uppercase tracking-widest mt-2" onClick={() => { if(pollingRef.current) clearInterval(pollingRef.current); setPakasirData({ ...pakasirData, step: 'CHOOSE_METHOD' }); }}>
                    BATAL / KEMBALI
                  </Button>
                </div>
              )}

              {pakasirData.step === 'SHOW_VA' && (
                <div className="flex flex-col items-center gap-4 text-center">
                  <p className="font-bold uppercase tracking-widest">{paymentMethod} GENERATED</p>
                  
                  {pakasirTimeLeft > 0 ? (
                    <>
                      <p className="text-sm font-bold text-red-600 mb-1">
                        Selesaikan pembayaran sebelum waktu habis: {Math.floor(pakasirTimeLeft / 60)}:{(pakasirTimeLeft % 60).toString().padStart(2, '0')}
                      </p>
                      <p className="text-xs font-bold text-red-600 text-center px-4 mb-4">
                        ⚠️ Mohon JANGAN tutup halaman ini atau keluar dari aplikasi sebelum pembayaran selesai.
                      </p>

                      {pakasirData.qrString && (
                        <div className="w-full bg-canvas border border-whisper rounded-xl p-6">
                          <p className="text-xs font-semibold text-steel uppercase mb-1">Nomor Virtual Account</p>
                          <div className="text-3xl font-mono font-bold text-ink tracking-wider break-all">{pakasirData.qrString}</div>
                        </div>
                      )}

                      <div className="flex w-full gap-2 mt-2">
                        <Button variant="secondary" className="flex-1 font-bold" onClick={() => {
                            navigator.clipboard.writeText(pakasirData.qrString || '');
                            toast.success("Nomor VA disalin");
                        }}>
                          <Copy className="w-4 h-4 mr-2" /> Salin VA
                        </Button>
                        <Button variant="secondary" className="flex-1 font-bold" onClick={() => {
                            navigator.clipboard.writeText(getCartTotal().toString());
                            toast.success("Nominal disalin");
                        }}>
                          <Copy className="w-4 h-4 mr-2" /> Salin Nominal
                        </Button>
                      </div>
                      
                      {pakasirData.url && (
                        <a href={pakasirData.url} target="_blank" className="text-blue-500 underline font-bold" rel="noreferrer">
                          Buka Halaman Pembayaran
                        </a>
                      )}
                      
                      <p className="text-sm text-muted-foreground animate-pulse flex items-center gap-2 mt-4">
                        <Loader2 className="w-4 h-4 animate-spin" /> Menunggu Pembayaran...
                      </p>
                    </>
                  ) : (
                    <p className="text-base font-bold text-red-600 mb-4">Waktu Pembayaran Habis!</p>
                  )}

                  {/* TOMBOL SIMULASI SANDBOX */}
                  {pakasirData.isSandbox && (
                    <Button 
                      onClick={() => {
                        if (pollingRef.current) clearInterval(pollingRef.current);
                        setPakasirData(prev => ({ ...prev, isPaid: true, step: 'PAID' }));
                        processCheckout(paymentMethod);
                      }}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-bold tracking-widest mt-2"
                    >
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      SIMULASI LUNAS (SANDBOX)
                    </Button>
                  )}

                  <Button variant="outline" className="w-full font-bold uppercase tracking-widest mt-2" onClick={() => { if(pollingRef.current) clearInterval(pollingRef.current); setPakasirData({ ...pakasirData, step: 'CHOOSE_METHOD' }); }}>
                    BATAL / KEMBALI
                  </Button>
                </div>
              )}

              {pakasirData.step === 'PAID' && (
                <div className="flex flex-col items-center gap-4 text-center text-green-600 py-8">
                  <CheckCircle2 className="w-20 h-20" />
                  <h3 className="text-2xl font-black uppercase tracking-tighter">LUNAS!</h3>
                  <p className="text-muted-foreground text-black dark:text-white">Memproses struk...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL TRANSAKSI BERHASIL & STRUK */}
      {lastTransaction && (
        <>
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              size: 58mm auto;
              margin: 0;
            }
          }
        `}} />
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-2 sm:p-4 print:p-0 print:bg-white print:block">
          
          {/* Kontainer Modal di layar (Sembunyi saat diprint) */}
          <div className="bg-card border-4 border-border w-[95%] sm:w-full max-w-sm max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] print:hidden">
            <div className="bg-primary text-primary-foreground p-4 text-center border-b-4 border-border">
              <h2 className="text-xl font-black uppercase tracking-tighter">TRANSAKSI BERHASIL</h2>
              <p className="font-mono text-sm opacity-90 font-bold">Kembalian: Rp {changeAmount.toLocaleString('id-ID')}</p>
            </div>
            
            {/* Preview Struk di layar */}
            <div className="p-4 sm:p-6 bg-white text-black flex justify-center border-b-4 border-border overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              {/* === KONTEN STRUK THERMAL (Digunakan untuk Preview dan Print) === */}
              <div id="struk-thermal" className="font-mono text-xs w-full max-w-[58mm] mx-auto">
                <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                  <h1 className="font-bold text-base uppercase">{user?.warungName || "KANTIN PONDOK"}</h1>
                  <p className="text-[10px]">Pondok Pesantren</p>
                  <p className="text-[10px]">================================</p>
                </div>
                
                <div className="text-[10px] mb-2 flex justify-between">
                  <div>
                    <p>Trx: {lastTransaction.trxId}</p>
                    <p>{lastTransaction.waktu}</p>
                  </div>
                  <div className="text-right">
                    <p>Kasir: Admin</p>
                  </div>
                </div>

                <div className="border-b border-dashed border-black pb-2 mb-2">
                  {lastTransaction.items.map((item: any, idx: number) => (
                    <div key={idx} className="mb-1">
                      <p className="font-bold">{item.name}</p>
                      <div className="flex justify-between pl-2">
                        <span>{item.quantity} x {Number(item.price || 0).toLocaleString('id-ID')}</span>
                        <span>{Number((item.quantity || 1) * (item.price || 0)).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between font-bold text-sm mb-1">
                  <span>TOTAL</span>
                  <span>Rp {Number(lastTransaction.total || 0).toLocaleString('id-ID')}</span>
                </div>
                {lastTransaction.method === 'Tunai' && (
                  <>
                    <div className="flex justify-between font-mono text-[10px]">
                      <span>DITERIMA</span>
                      <span>Rp {(Number(lastTransaction.total || 0) + changeAmount).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[10px] mb-4">
                      <span>KEMBALI</span>
                      <span>Rp {changeAmount.toLocaleString('id-ID')}</span>
                    </div>
                  </>
                )}

                <div className="text-center text-[10px] mt-4">
                  <p>Terima kasih atas kunjungannya!</p>
                  <p>Barang yang sudah dibeli tidak</p>
                  <p>dapat ditukar/dikembalikan.</p>
                  <p className="mt-2">- SALAPP POS -</p>
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="p-4 flex flex-col gap-2">
              <Button onClick={() => window.print()} className="w-full h-12 gap-2 text-base font-bold">
                <Receipt className="w-5 h-5" /> CETAK STRUK
              </Button>
              <Button onClick={() => setLastTransaction(null)} variant="outline" className="w-full h-12 text-base font-bold">
                SELESAI TRANSAKSI
              </Button>
            </div>
          </div>

          {/* Versi Cetak Khusus (Hanya muncul saat diprint, menyembunyikan modal hitamnya) */}
          <div className="hidden print:block fixed inset-0 bg-white text-black p-0 m-0 z-[100] font-mono text-xs w-full max-w-[58mm] mx-auto">
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
              <h1 className="font-bold text-base uppercase">{user?.warungName || "KANTIN PONDOK"}</h1>
              <p className="text-[10px]">Pondok Pesantren</p>
              <p className="text-[10px]">================================</p>
            </div>
            
            <div className="text-[10px] mb-2 flex justify-between">
              <div>
                <p>Trx: {lastTransaction.trxId}</p>
                <p>{lastTransaction.waktu}</p>
              </div>
              <div className="text-right">
                <p>Kasir: Admin</p>
              </div>
            </div>

            <div className="border-b border-dashed border-black pb-2 mb-2">
              {lastTransaction.items.map((item: any, idx: number) => (
                <div key={idx} className="mb-1">
                  <p className="font-bold">{item.name}</p>
                  <div className="flex justify-between pl-2">
                    <span>{item.quantity} x {Number(item.price || 0).toLocaleString('id-ID')}</span>
                    <span>{Number((item.quantity || 1) * (item.price || 0)).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-bold text-sm mb-1">
              <span>TOTAL</span>
              <span>Rp {Number(lastTransaction.total || 0).toLocaleString('id-ID')}</span>
            </div>
            {lastTransaction.method === 'Tunai' && (
              <>
                <div className="flex justify-between font-mono text-[10px]">
                  <span>DITERIMA</span>
                  <span>Rp {(Number(lastTransaction.total || 0) + changeAmount).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-mono text-[10px] mb-4">
                  <span>KEMBALI</span>
                  <span>Rp {changeAmount.toLocaleString('id-ID')}</span>
                </div>
              </>
            )}

            <div className="text-center text-[10px] mt-4">
              <p>Terima kasih atas kunjungannya!</p>
              <p>Barang yang sudah dibeli tidak</p>
              <p>dapat ditukar/dikembalikan.</p>
              <p className="mt-2">- SALAPP POS -</p>
            </div>
          </div>
        </div>
        </>
      )}

      {/* MODAL BILL SEMENTARA */}
      {showTempPrint && (
        <>
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              size: 58mm auto;
              margin: 0;
            }
          }
        `}} />
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-2 sm:p-4 print:p-0 print:bg-white print:block">
          
          {/* Kontainer Modal di layar (Sembunyi saat diprint) */}
          <div className="bg-card border-4 border-border w-full max-w-sm flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] print:hidden">
            <div className="bg-secondary text-secondary-foreground p-4 text-center border-b-4 border-border relative">
              <button 
                onClick={() => setShowTempPrint(false)}
                className="absolute top-2 right-2 text-secondary-foreground hover:opacity-70"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-black uppercase tracking-tighter">BILL SEMENTARA</h2>
            </div>
            
            {/* Preview Struk di layar */}
            <div className="p-6 bg-white text-black flex justify-center border-b-4 border-border max-h-[50vh] overflow-y-auto">
              <div className="font-mono text-xs w-[58mm] mx-auto">
                <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                  <h1 className="font-bold text-base uppercase">{user?.warungName || "KANTIN PONDOK"}</h1>
                  <p className="text-[10px]">BILL SEMENTARA</p>
                  <p className="text-[10px]">================================</p>
                </div>
                
                <div className="border-b border-dashed border-black pb-2 mb-2">
                  {cart.map((item: any, idx: number) => (
                    <div key={idx} className="mb-1">
                      <p className="font-bold">{item.name}</p>
                      <div className="flex justify-between pl-2">
                        <span>{item.quantity} x {Number(item.price || 0).toLocaleString('id-ID')}</span>
                        <span>{Number((item.quantity || 1) * (item.price || 0)).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between font-bold text-sm mb-4">
                  <span>TOTAL SEMENTARA</span>
                  <span>Rp {Number(getCartTotal() || 0).toLocaleString('id-ID')}</span>
                </div>

                <div className="text-center text-[10px]">
                  <p>Harap bayar di Kasir</p>
                  <p className="mt-2">- SALAPP POS -</p>
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="p-4 flex flex-col gap-2">
              <Button onClick={() => window.print()} className="w-full h-12 gap-2 text-base font-bold">
                <Receipt className="w-5 h-5" /> CETAK KERTAS
              </Button>
              <Button onClick={() => setShowTempPrint(false)} variant="outline" className="w-full h-12 text-base font-bold">
                TUTUP
              </Button>
            </div>
          </div>

          {/* Versi Cetak Khusus (Hanya muncul saat diprint) */}
          <div className="hidden print:block fixed inset-0 bg-white text-black p-0 m-0 z-[100] font-mono text-xs w-full max-w-[58mm] mx-auto">
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
              <h1 className="font-bold text-base uppercase">{user?.warungName || "KANTIN PONDOK"}</h1>
              <p className="text-[10px]">BILL SEMENTARA</p>
              <p className="text-[10px]">================================</p>
            </div>
            
            <div className="border-b border-dashed border-black pb-2 mb-2">
              {cart.map((item: any, idx: number) => (
                <div key={idx} className="mb-1">
                  <p className="font-bold">{item.name}</p>
                  <div className="flex justify-between pl-2">
                    <span>{item.quantity} x {Number(item.price || 0).toLocaleString('id-ID')}</span>
                    <span>{Number((item.quantity || 1) * (item.price || 0)).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-bold text-sm mb-4">
              <span>TOTAL SEMENTARA</span>
              <span>Rp {Number(getCartTotal() || 0).toLocaleString('id-ID')}</span>
            </div>

            <div className="text-center text-[10px]">
              <p>Harap bayar di Kasir</p>
              <p className="mt-2">- SALAPP POS -</p>
            </div>
          </div>
        </div>
        </>
      )}

      {/* MODAL TUTUP KASIR */}
      {closingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-card border-4 border-border w-full max-w-md flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] relative">
            <button 
              onClick={() => setClosingModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="p-6 border-b-4 border-border text-center">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">REKAP TUTUP KASIR</h2>
              <p className="font-mono text-sm">{closingData?.date || "Memuat..."}</p>
            </div>
            
            <div className="p-6 flex flex-col gap-4 bg-muted/30">
              {closingLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mb-4" />
                  <p className="font-mono text-sm uppercase">Merekap Data...</p>
                </div>
              ) : closingData ? (
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-dashed border-border pb-2">
                    <span className="font-mono uppercase">Total Transaksi</span>
                    <span className="font-bold">{closingData.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono uppercase">Pendapatan Tunai</span>
                    <span className="font-bold text-green-600 dark:text-green-400">Rp {closingData.totalTunai.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono uppercase">Pendapatan QRIS</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">Rp {closingData.totalQris.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono uppercase">Virtual Account</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">Rp {closingData.totalVa.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono uppercase">Potong Tabungan</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">Rp {closingData.totalTabungan.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-border pt-4 mt-2">
                    <span className="font-black uppercase tracking-widest text-lg">GRAND TOTAL</span>
                    <span className="font-black text-2xl">Rp {closingData.grandTotal.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground font-mono">Gagal memuat rekap</p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 mt-4 print:hidden">
                <Button 
                  className="w-full sm:flex-1 h-12 gap-2 text-sm font-bold bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleExportClosingCSV}
                  disabled={closingLoading || !closingData}
                >
                  <Download className="w-4 h-4" /> EXPORT EXCEL
                </Button>
                <Button 
                  className="w-full sm:flex-1 h-12 gap-2 text-sm font-bold"
                  onClick={() => window.print()}
                  disabled={closingLoading || !closingData}
                >
                  <FileText className="w-4 h-4" /> CETAK Z-REPORT
                </Button>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-12 text-base font-bold print:hidden"
                onClick={() => setClosingModalOpen(false)}
              >
                KEMBALI KE POS
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT VERSION TUTUP KASIR (Z-REPORT THERMAL FORMAT) */}
      {closingModalOpen && closingData && (
        <div className="hidden print:block fixed inset-0 bg-white text-black p-0 m-0 z-[100] font-mono text-xs w-[58mm]">
          <div className="text-center border-b border-dashed border-black pb-2 mb-2 mt-4">
            <h1 className="font-bold text-base uppercase">{user?.warungName || "KANTIN PONDOK"}</h1>
            <p className="text-[10px]">Z-REPORT (TUTUP KASIR)</p>
            <p className="text-[10px]">{closingData.date}</p>
            <p className="text-[10px]">================================</p>
          </div>
          
          <table className="w-full text-left text-[10px] mb-4">
            <tbody>
              <tr><td className="py-1">Total Trx</td><td className="text-right font-bold">{closingData.count}</td></tr>
              <tr><td className="py-1">Tunai</td><td className="text-right">Rp {closingData.totalTunai.toLocaleString('id-ID')}</td></tr>
              <tr><td className="py-1">QRIS</td><td className="text-right">Rp {closingData.totalQris.toLocaleString('id-ID')}</td></tr>
              <tr><td className="py-1">VA</td><td className="text-right">Rp {closingData.totalVa.toLocaleString('id-ID')}</td></tr>
              <tr><td className="py-1">Tabungan</td><td className="text-right">Rp {closingData.totalTabungan.toLocaleString('id-ID')}</td></tr>
              <tr><td colSpan={2} className="py-1 text-center">--------------------------------</td></tr>
              <tr><td className="py-1 font-bold">GRAND TOTAL</td><td className="text-right font-bold text-sm">Rp {closingData.grandTotal.toLocaleString('id-ID')}</td></tr>
            </tbody>
          </table>
          <div className="text-center text-[10px] mt-4">
            <p>================================</p>
            <p className="font-bold">Kasir: {user?.name || "System"}</p>
            <p>{formatDateTimeID(new Date())}</p>
            <p className="mt-4">- SALAPP POS -</p>
          </div>
        </div>
      )}

      {scannerOpen.isOpen && (
        <CameraScanner 
          onClose={() => setScannerOpen(prev => ({ ...prev, isOpen: false }))}
          onScan={(text) => {
            const target = scannerOpen.target;
            setScannerOpen({ isOpen: false, target });
            if (target === 'product') {
              setSearch(text);
              const exactProduct = products.find((p: any) => p.barcode === text);
              if (exactProduct) {
                addToCart(exactProduct);
                playBeep();
                toast.success(`${exactProduct.name} ditambahkan`);
              } else {
                playError();
                toast.error("Barcode produk tidak ditemukan");
              }
            } else if (target === 'santri') {
              setBuyerId(text);
              checkSantri(text);
            }
          }}
        />
      )}

      {/* MODAL CHECKOUT ALERT (INDUSTRIAL THEME) */}
      {checkoutAlert?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className={`w-full max-w-xl border-4 flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:shadow-[12px_12px_0px_0px_rgba(255,255,255,1)] ${checkoutAlert.type === 'success' ? 'border-green-600 bg-card' : 'border-red-600 bg-card'}`}>
            <div className={`p-6 border-b-4 flex items-center justify-center gap-4 ${checkoutAlert.type === 'success' ? 'bg-green-600 border-green-600 text-white' : 'bg-red-600 border-red-600 text-white'}`}>
              {checkoutAlert.type === 'success' ? <CheckCircle2 className="w-12 h-12" /> : <X className="w-12 h-12" />}
              <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">{checkoutAlert.title}</h2>
            </div>
            
            <div className="p-8 flex flex-col items-center text-center gap-6">
              {checkoutAlert.nama && (
                <div className="flex flex-col items-center w-full">
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 border-b-2 border-border pb-1 w-full text-center">IDENTITAS SANTRI</span>
                  <p className="text-3xl font-black uppercase tracking-tight">{checkoutAlert.nama}</p>
                </div>
              )}
              
              <div className="flex flex-col items-center w-full mt-2">
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 border-b-2 border-border pb-1 w-full text-center">STATUS SALDO</span>
                <p className={`text-4xl font-mono font-bold tracking-tighter ${checkoutAlert.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {checkoutAlert.message}
                </p>
              </div>
            </div>
            
            <div className={`border-t-4 p-2 flex justify-between items-center font-mono text-[10px] uppercase ${checkoutAlert.type === 'success' ? 'border-green-600 bg-green-600/10' : 'border-red-600 bg-red-600/10'}`}>
              <span className="animate-pulse font-bold">» AUTO_CLOSING_ROUTINE_ACTIVE...</span>
              <span className="opacity-50">SYS_REV 1.0 // POS_TERMINAL</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
