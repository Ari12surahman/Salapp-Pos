import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hconlmrrerltnmryzdll.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjb25sbXJyZXJsdG5tcnl6ZGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODQ4NDIsImV4cCI6MjA5ODA2MDg0Mn0.uZfnUonT1eN06yyLhDWaYXe8qzoNLC2gJ6EPB8pkoGI';
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_CODE_MERCHANT = process.env.WIJAYAPAY_CODE_MERCHANT || 'WP6aeb77c146ef6';
const DEFAULT_API_KEY = process.env.WIJAYAPAY_API_KEY || '802e6a184e03142089590837a6';

export async function POST(request: Request) {
  console.log("=== INCOMING WIJAYAPAY WEBHOOK ===");

  try {
    const rawBody = await request.text();
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.warn("Gagal parse body JSON:", rawBody);
    }

    console.log("WijayaPay Webhook Payload:", JSON.stringify(payload, null, 2));

    // Payload WijayaPay berada di dalam objek data: { ref_id, total_dibayar, payment_methode, trx_reference, ... }
    const rawData = payload.data || payload;
    const invoiceNumber = rawData.ref_id || payload.ref_id || payload.order_id || payload.invoice_number || '';
    const statusPembayaran = String(payload.status || rawData.status || rawData.status_pembayaran || '').toLowerCase();
    const isSuccess = statusPembayaran === 'paid' || statusPembayaran === 'success' || statusPembayaran === 'settlement' || statusPembayaran === 'berhasil';
    const amount = Number(rawData.total_dibayar || rawData.total_bayar || rawData.nominal || payload.amount || 0);
    const channelName = rawData.payment_methode || rawData.payment_method || rawData.payment_name || rawData.code_payment || 'WijayaPay';
    const trxRef = rawData.trx_reference || '';

    // Verifikasi X-Signature jika tersedia (Header: X-Signature = md5(code_merchant + api_key + ref_id))
    const incomingSignature = request.headers.get('x-signature') || request.headers.get('X-Signature') || '';
    if (incomingSignature && invoiceNumber) {
      const expectedSignature = crypto.createHash('md5').update(DEFAULT_CODE_MERCHANT + DEFAULT_API_KEY + invoiceNumber).digest('hex');
      if (incomingSignature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.warn("Invalid X-Signature from WijayaPay:", incomingSignature, "Expected:", expectedSignature);
      }
    }

    if (!invoiceNumber) {
      console.warn("Webhook diterima tanpa ref_id / invoice number");
      return NextResponse.json({ status: true, message: "No ref_id provided" });
    }

    // 1. Ambil data order dari Supabase
    const { data: orderData } = await supabase
      .from('PakasirOrders')
      .select('*')
      .eq('order_id', invoiceNumber)
      .maybeSingle();

    const orderPayload = orderData?.payload || {};

    if (isSuccess) {
      console.log(`Pembayaran Berhasil untuk Order: ${invoiceNumber} Sebesar: Rp ${amount}`);

      // 2. Update status order menjadi COMPLETED
      await supabase
        .from('PakasirOrders')
        .update({ status: 'COMPLETED' })
        .eq('order_id', invoiceNumber);

      const orderType = orderData?.tipe || (invoiceNumber.startsWith('POS') ? 'POS' : invoiceNumber.startsWith('TB') ? 'TOPUP_TABUNGAN' : 'TAGIHAN_PORTAL');

      // --- A. TRANSAKSI KASIR POS / TITIP JAJAN ---
      if (orderType === 'POS') {
        const trxData = {
          TrxID: invoiceNumber,
          SantriID: orderPayload.santriId || null,
          TotalHarga: amount || orderPayload.total || 0,
          Waktu: new Date().toISOString(),
          Metode: `Transfer Online (${channelName})`,
          StatusPencairan: 'Belum Diajukan',
          StatusAmbil: orderPayload.statusAmbil || 'Sudah Diambil',
          WarungID: orderPayload.warungId || 'WRG-KANTIN',
          Catatan: `WijayaPay Ref: ${trxRef}`
        };

        await supabase.from('Transaksi').upsert([trxData], { onConflict: 'TrxID' });

        if (Array.isArray(orderPayload.items)) {
          const detailRows = orderPayload.items.map((item: any) => ({
            TrxID: invoiceNumber,
            ProdukID: item.id || item.produkId || '',
            NamaProduk: item.name || item.nama || item.namaProduk || '',
            HargaSatuan: item.price || item.harga || 0,
            Kuantitas: item.quantity || item.qty || 1,
            Subtotal: (item.price || item.harga || 0) * (item.quantity || item.qty || 1)
          }));
          await supabase.from('DetailTransaksi').upsert(detailRows);

          // Kurangi stok produk
          for (const item of orderPayload.items) {
            const pid = item.id || item.produkId;
            const qty = item.quantity || item.qty || 1;
            if (pid) {
              const { data: pData } = await supabase.from('Produk').select('Stok').eq('ID', pid).maybeSingle();
              if (pData) {
                const currentStock = Number(pData.Stok || 0);
                const newStock = Math.max(0, currentStock - qty);
                await supabase.from('Produk').update({ Stok: newStock }).eq('ID', pid);
              }
            }
          }
        }
      }
      // --- B. TOP UP TABUNGAN ---
      else if (orderType === 'TOPUP_TABUNGAN') {
        const nominalTopUp = orderPayload.bayarAmount || orderPayload.nominal || amount;
        const tabunganData = {
          id: `TAB-${Date.now()}`,
          nis: orderPayload.nis,
          nama: orderPayload.nama,
          tanggal: new Date().toISOString().split('T')[0],
          jenis: 'Setor',
          nominal: nominalTopUp,
          keterangan: `Top Up Tabungan Online (${channelName}) Ref: ${trxRef}`
        };
        await supabase.from('Tabungan').insert([tabunganData]);
      }
      // --- C. TAGIHAN PORTAL (SPP, DSP, GEDUNG, DLL) ---
      else if (orderType === 'TAGIHAN_PORTAL' || orderType === 'BAYAR_TAGIHAN' || orderType === 'BAYAR_BEBAS') {
        const tagihanList = orderPayload.selectedBulkItems || (orderPayload.tagihanData ? [orderPayload.tagihanData] : []);
        for (const tg of tagihanList) {
          if (!tg) continue;
          const sisa = Math.max(0, (tg.nominal || 0) - (tg.terbayar || 0));
          const amountToPay = orderPayload.isBulk ? sisa : (orderPayload.bayarAmount || orderPayload.amount || sisa);

          if (amountToPay <= 0) continue;

          const totalTerbayarBaru = (tg.terbayar || 0) + amountToPay;
          const statusTrx = totalTerbayarBaru < (tg.nominal || 0) ? 'Cicil' : 'Lunas';
          const sisaTagihan = Math.max(0, (tg.nominal || 0) - totalTerbayarBaru);

          // 1. Update Tagihan
          await supabase.from('Tagihan').update({
            status: statusTrx,
            terbayar: totalTerbayarBaru
          }).eq('id', tg.id);

          // 2. Insert Pembayaran
          const invId = `INV-WP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await supabase.from('Pembayaran').insert([{
            id: invId,
            tanggal: new Date().toISOString().split('T')[0],
            nis: tg.nis,
            nama: tg.nama,
            tagihan: tg.tagihan + ` (Via ${channelName})`,
            periode: tg.periode,
            nominal: amountToPay,
            status: statusTrx === 'Cicil' ? 'Cicilan' : 'Lunas',
            sisa: sisaTagihan,
            items: JSON.stringify([{ tagihan: tg.tagihan, periode: tg.periode, nominal: amountToPay }])
          }]);
        }
      }
    } else if (['expired', 'failed', 'cancel'].includes(statusPembayaran)) {
      await supabase.from('PakasirOrders').update({ status: 'FAILED' }).eq('order_id', invoiceNumber);
    }

    // Response wajib sesuai standar dokumentasi WijayaPay: { "status": true }
    return NextResponse.json({
      status: true,
      message: "Webhook processed successfully"
    });

  } catch (err: any) {
    console.error("Error processing WijayaPay Webhook:", err);
    return NextResponse.json({
      status: false,
      message: err.message
    }, { status: 500 });
  }
}

