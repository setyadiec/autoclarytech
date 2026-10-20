// POST /api/kredit-saldo {wa, token} — sisa kredit milik akun (100% dari database). Bey, 20 Okt 2026.
import { konfigDb, rpc, autentikasi, terlaluSering } from './_akun.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.autoclarytech.com');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ status: 'error', message: 'Gunakan POST' }); return; }
  if (!konfigDb().siap) { res.status(503).json({ status: 'error', message: 'Layanan kredit belum aktif.' }); return; }
  if (terlaluSering(req, 'saldo', 60, 1)) { res.status(429).json({ status: 'error', message: 'Terlalu sering.' }); return; }

  const b = req.body || {};
  try {
    const akunId = await autentikasi(b.wa, b.token);
    if (!akunId) { res.status(401).json({ status: 'error', message: 'Akun tidak dikenali di perangkat ini.' }); return; }
    const saldo = await rpc('saldo_akun', { p_akun: akunId });
    res.status(200).json({ status: 'ok', saldo: Number(saldo) });
  } catch (e) {
    console.log('kredit-saldo gagal', String(e.message).slice(0, 100));
    res.status(502).json({ status: 'error', message: 'Layanan sedang sibuk. Coba lagi.' });
  }
}
