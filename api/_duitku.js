// CONT-ACT V2 — bantuan Duitku (payment gateway). Bey, 20 Okt 2026.
// ATURAN: tidak ada kunci/kode merchant di berkas ini. Nilai hanya dari environment server (DUITKU_MERCHANT_CODE, DUITKU_API_KEY, DUITKU_MODE).
// Rumus tanda tangan mengikuti dokumen resmi Duitku (docs.duitku.com):
//   inquiry   : HMAC_SHA256(merchantCode + merchantOrderId + paymentAmount, apiKey) -> hex huruf kecil
//   callback  : HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
//   status    : HMAC_SHA256(merchantCode + merchantOrderId, apiKey)
import crypto from 'node:crypto';

export const HARGA_PAKET = {            // SATU-SATUNYA sumber harga (server). Klien hanya mengirim kode paket, tidak pernah nominal.
  video:    { rupiah: 19900, nama: 'Video Reels cont-ACT', kredit: 0 },
  coba:     { rupiah: 9900,  nama: 'Paket Coba 5 kredit', kredit: 5 },
  hemat:    { rupiah: 24900, nama: 'Paket Hemat 15 kredit', kredit: 15 },
  juragan:  { rupiah: 59900, nama: 'Paket Juragan 40 kredit', kredit: 40 },
  mingguan: { rupiah: 59900, nama: 'Langganan Mingguan 35 kredit', kredit: 35 },
  bulanan:  { rupiah: 179900, nama: 'Langganan Bulanan 140 kredit', kredit: 140 }
};

export function konfig() {
  const kode = process.env.DUITKU_MERCHANT_CODE || '';
  const kunci = process.env.DUITKU_API_KEY || '';
  const produksi = String(process.env.DUITKU_MODE || 'sandbox').toLowerCase() === 'produksi';
  return {
    siap: Boolean(kode && kunci), kode, kunci, produksi,
    inquiryUrl: produksi ? 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry' : 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry',
    statusUrl: produksi ? 'https://passport.duitku.com/webapi/api/merchant/transactionStatus' : 'https://sandbox.duitku.com/webapi/api/merchant/transactionStatus'
  };
}

export function hmacHex(teks, kunci) {
  return crypto.createHmac('sha256', kunci).update(teks).digest('hex');
}

export function tandaTanganInquiry(kode, orderId, jumlah, kunci) {
  return hmacHex(String(kode) + String(orderId) + String(jumlah), kunci);
}

export function tandaTanganCallback(kode, jumlah, orderId, kunci) {
  return hmacHex(String(kode) + String(jumlah) + String(orderId), kunci);
}

// Perbandingan waktu-konstan; mengembalikan false untuk panjang berbeda.
export function samaAman(a, b) {
  const x = Buffer.from(String(a || '').toLowerCase());
  const y = Buffer.from(String(b || '').toLowerCase());
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function buatOrderId(kodePaket) {
  return ('ACT-' + kodePaket + '-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex')).slice(0, 50);
}
