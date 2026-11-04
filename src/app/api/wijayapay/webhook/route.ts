import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hconlmrrerltnmryzdll.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjb25sbXJyZXJsdG5tcnl6ZGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODQ4NDIsImV4cCI6MjA5ODA2MDg0Mn0.uZfnUonT1eN06yyLhDWaYXe8qzoNLC2gJ6EPB8pkoGI';
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_CODE_MERCHANT = process.env.WIJAYAPAY_CODE_MERCHANT || 'WP6aeb77c146ef6';
const DEFAULT_API_KEY = process.env.WIJAYAPAY_API_KEY || '802e6a184e03142089590837a6';

export async function POST(request: Request) {
  console.log("=== INCOMING WIJAYAPAY WEBHOOK (POS) ===");

  try {
    const rawBody = await request.text();
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.warn("Gagal parse body JSON:", rawBody);
    }

    console.log("WijayaPay Webhook Payload:", JSON.stringify(payload, null, 2));

    const invoiceNumber = payload.ref_id || payload.order_id || payload.invoice_number || '';
    const statusPembayaran = String(payload.status_pembayaran || payload.status || '').toLowerCase();
    const isSuccess = statusPembayaran === 'paid' || statusPembayaran === 'success' || statusPembayaran === 'settlement' || statusPembayaran === 'berhasil';
    const amount = Number(payload.total_bayar || payload.total_dibayar || payload.nominal || payload.amount || 0);
    const channelName = payload.payment_method || payload.payment_name || payload.code_payment || 'WijayaPay';
    const trxRef = payload.trx_reference || '';

    // Verifikasi X-Signature jika tersedia
    const incomingSignature = request.headers.get('x-signature') || '';
    if (incomingSignature && invoiceNumber) {
      const expectedSignature = crypto.createHash('md5').update(DEFAULT_CODE_MERCHANT + DEFAULT_API_KEY + invoiceNumber).digest('hex');
      if (incomingSignature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.warn("Invalid X-Signature from WijayaPay:", incomingSignature, "Expected:", expectedSignature);
      }
    }

    if (!invoiceNumber) {
      console.warn("Webhook diterima tanpa ref_id / invoice number");
      return NextResponse.json({ success: true, message: "No ref_id provided" });
    }

    // 1. Ambil data order dari Supabase
    const { data: orderData } = await supabase
      .from('PakasirOrders')
      .select('*')
      .eq('order_id', invoiceNumber)
      .maybeSingle();

    const orderPayload = orderData?.payload || {};

    if (isSuccess) {
      console.log(`Pembayaran Berhasil untuk Order POS: ${invoiceNumber} Sebesar: Rp ${amount}`);

      // 2. Update status order menjadi COMPLETED
      await supabase
        .from('PakasirOrders')
        .update({ status: 'COMPLETED' })
        .eq('order_id', invoiceNumber);

      // --- TRANSAKSI KASIR POS ---
      const trxData = {
        TrxID: invoiceNumber,
        SantriID: orderPayload.santriId || null,
        TotalHarga: amount || orderPayload.total || 0,
        WaktuTransaksi: new Date().toISOString(),
        Metode: `Transfer Online (${channelName})`,
        StatusPencairan: 'Belum Diajukan',
        StatusAmbil: 'Sudah Diambil',
        Catatan: `WijayaPay Ref: ${trxRef}`
      };

      await supabase.from('Transaksi').upsert([trxData], { onConflict: 'TrxID' });

      if (Array.isArray(orderPayload.items)) {
        const detailRows = orderPayload.items.map((item: any) => ({
          TrxID: invoiceNumber,
          ProdukID: item.id || item.produkId,
          NamaProduk: item.name || item.namaProduk,
          HargaSatuan: item.price || item.harga,
          Kuantitas: item.quantity || item.qty || 1,
          Subtotal: (item.price || item.harga) * (item.quantity || item.qty || 1)
        }));
        await supabase.from('DetailTransaksi').upsert(detailRows);

        // Kurangi stok produk
        for (const item of orderPayload.items) {
          const pid = item.id || item.produkId;
          const qty = item.quantity || item.qty || 1;
          if (pid) {
            const { data: pData } = await supabase.from('Produk').select('Stok').eq('ProdukID', pid).single();
            if (pData) {
              const currentStock = Number(pData.Stok || 0);
              const newStock = Math.max(0, currentStock - qty);
              await supabase.from('Produk').update({ Stok: newStock }).eq('ProdukID', pid);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully"
    });

  } catch (err: any) {
    console.error("Error processing WijayaPay Webhook (POS):", err);
    return NextResponse.json({
      success: false,
      message: err.message
    }, { status: 500 });
  }
}

