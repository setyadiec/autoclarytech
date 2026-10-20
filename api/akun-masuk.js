// POST /api/akun-masuk {wa} — mendaftarkan nomor WA (akun baru + 3 kredit gratis) dan mengembalikan TOKEN perangkat satu kali.
// Nomor yang sudah terdaftar TIDAK diberi token baru (mencegah pengambilalihan); verifikasi lewat OTP WA menyusul. Bey, 20 Okt 2026.
import { konfigDb, rpc, normalisasiWA, hashToken, bikinToken, terlaluSering } from './_akun.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.autoclarytech.com');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ status: 'error', message: 'Gunakan POST' }); return; }
  if (!konfigDb().siap) { res.status(503).json({ status: 'error', message: 'Layanan kredit belum aktif.' }); return; }
  if (terlaluSering(req, 'masuk', 8)) { res.status(429).json({ status: 'error', message: 'Terlalu sering. Coba lagi beberapa menit.' }); return; }

  const wa = normalisasiWA((req.body || {}).wa);
  if (!wa) { res.status(400).json({ status: 'error', message: 'Nomor WhatsApp tidak valid.' }); return; }

  const token = bikinToken();
  try {
    const h = await rpc('buat_akun', { p_wa: wa, p_token_hash: hashToken(token) });
    if (h && h.baru) { res.status(200).json({ status: 'ok', baru: true, token, saldo: h.saldo }); return; }
    res.status(409).json({ status: 'sudah_terdaftar', message: 'Nomor ini sudah terdaftar. Gunakan perangkat yang dipakai saat mendaftar, atau hubungi admin untuk verifikasi.' });
  } catch (e) {
    console.log('akun-masuk gagal', String(e.message).slice(0, 100));
    res.status(502).json({ status: 'error', message: 'Layanan sedang sibuk. Coba lagi.' });
  }
}
