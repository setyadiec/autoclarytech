// POST /api/duitku-tagihan {paket, email?, nama?, wa?} — membuat tagihan Duitku (inquiry v2) dan mengembalikan paymentUrl. Bey, 20 Okt 2026.
// Nominal TIDAK PERNAH diambil dari klien: hanya kode paket -> tabel harga server (_duitku.js).
import { HARGA_PAKET, konfig, tandaTanganInquiry, buatOrderId } from './_duitku.js';
import { konfigDb, autentikasi, tulis } from './_akun.js';

const BATAS = new Map();   // anti-spam sederhana per IP: maks 6 tagihan / 10 menit per instance

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.autoclarytech.com');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ status: 'error', message: 'Gunakan POST' }); return; }
  const c = konfig();
  if (!c.siap) { res.status(503).json({ status: 'error', message: 'Pembayaran otomatis belum aktif. Gunakan transfer BRI + konfirmasi WA.' }); return; }

  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x');
  const kini = Date.now();
  const riwayat = (BATAS.get(ip) || []).filter(t => kini - t < 600000);
  if (riwayat.length >= 6) { res.status(429).json({ status: 'error', message: 'Terlalu sering. Coba lagi beberapa menit.' }); return; }
  riwayat.push(kini); BATAS.set(ip, riwayat);

  const b = req.body || {};
  const kodePaket = String(b.paket || '').toLowerCase();
  const paket = HARGA_PAKET[kodePaket];
  if (!paket) { res.status(400).json({ status: 'error', message: 'Paket tidak dikenal' }); return; }

  // wajib akun terdaftar: kredit hasil pembelian ditambahkan ke akun ini oleh callback
  if (!konfigDb().siap) { res.status(503).json({ status: 'error', message: 'Layanan kredit belum aktif.' }); return; }
  let akunId = null;
  try { akunId = await autentikasi(b.wa, b.token); } catch (e) { res.status(502).json({ status: 'error', message: 'Layanan sedang sibuk. Coba lagi.' }); return; }
  if (!akunId) { res.status(401).json({ status: 'error', message: 'Daftarkan nomor WhatsApp Anda dulu.' }); return; }

  const orderId = buatOrderId(kodePaket);
  try {
    await tulis('pembayaran', { order_id: orderId, akun_id: akunId, kode_paket: kodePaket, nominal: paket.rupiah });
  } catch (e) { res.status(502).json({ status: 'error', message: 'Tagihan gagal dicatat. Coba lagi.' }); return; }
  const surel = /^[^@\s]{1,64}@[^@\s]{1,120}$/.test(String(b.email || '')) ? String(b.email) : 'pembeli@autoclarytech.com';
  const nama = String(b.nama || 'Pembeli cont-ACT').replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 20) || 'Pembeli';
  const badan = {
    merchantCode: c.kode, paymentAmount: paket.rupiah, paymentMethod: String(b.metode || 'SP'), merchantOrderId: orderId,
    productDetails: paket.nama, email: surel, customerVaName: nama,
    callbackUrl: 'https://www.autoclarytech.com/api/duitku-callback',
    returnUrl: 'https://www.autoclarytech.com/cont-act?bayar=selesai',
    expiryPeriod: 60,
    signature: tandaTanganInquiry(c.kode, orderId, paket.rupiah, c.kunci)
  };
  try {
    const r = await fetch(c.inquiryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(badan), signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.paymentUrl) { res.status(502).json({ status: 'error', message: 'Gateway menolak: ' + String(j.Message || j.statusMessage || r.status).slice(0, 120) }); return; }
    res.status(200).json({ status: 'ok', orderId, paymentUrl: j.paymentUrl, reference: j.reference, nominal: paket.rupiah, paket: kodePaket, mode: c.produksi ? 'produksi' : 'sandbox' });
  } catch (e) {
    res.status(502).json({ status: 'error', message: 'Gateway tidak terjangkau' });
  }
}
