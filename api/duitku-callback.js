// POST /api/duitku-callback — callback pembayaran Duitku (x-www-form-urlencoded). Bey, 20 Okt 2026.
// Aturan: (1) tolak bila tanda tangan salah; (2) HANYA resultCode '00' = lunas; (3) cocokkan nominal dengan tabel harga SERVER;
// (4) idempoten per merchantOrderId; (5) selalu balas 200 untuk callback yang sah (Duitku mengulang sampai 5x bila tidak 200).
import { HARGA_PAKET, konfig, tandaTanganCallback, samaAman } from './_duitku.js';
import { konfigDb, rpc } from './_akun.js';

const sudahDiproses = new Map();   // cadangan memori HANYA bila database belum dikonfigurasi

function bacaForm(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ status: 'error', message: 'Gunakan POST' }); return; }
  const c = konfig();
  if (!c.siap) { res.status(503).json({ status: 'error', message: 'Konfigurasi pembayaran belum dipasang di server.' }); return; }

  const f = bacaForm(req);
  const { merchantCode, amount, merchantOrderId, resultCode, reference, signature } = f;
  if (!merchantCode || !amount || !merchantOrderId || !signature) { res.status(400).json({ status: 'error', message: 'Parameter kurang' }); return; }
  if (String(merchantCode) !== c.kode) { res.status(400).json({ status: 'error', message: 'Merchant tidak dikenal' }); return; }

  const hitung = tandaTanganCallback(c.kode, amount, merchantOrderId, c.kunci);
  if (!samaAman(hitung, signature)) { res.status(400).json({ status: 'error', message: 'Tanda tangan tidak sah' }); return; }

  const kodePaket = String(merchantOrderId).split('-')[1] || '';
  const paket = HARGA_PAKET[kodePaket];
  const nominal = Number(String(amount).replace(/[^0-9]/g, ''));
  const lunas = String(resultCode) === '00';
  const cocok = Boolean(paket) && nominal === paket.rupiah;

  const baris = {
    order_id: String(merchantOrderId).slice(0, 50), kode_paket: kodePaket, nominal, referensi: String(reference || '').slice(0, 60),
    lunas: lunas && cocok, hasil: String(resultCode || ''), nominal_cocok: cocok, diterima: new Date().toISOString()
  };
  // Database dikonfigurasi: fungsi atomik proses_pembayaran (idempoten per order_id) yang menambah kredit. Gagal -> 503 agar Duitku mengulang.
  if (konfigDb().siap) {
    let hasil;
    try {
      hasil = await rpc('proses_pembayaran', { p_order: baris.order_id, p_nominal: nominal, p_hasil: String(resultCode || ''), p_ref: baris.referensi, p_kredit: paket ? paket.kredit : 0 });
    } catch (e) {
      console.log('duitku-callback db GAGAL', baris.order_id, String(e.message).slice(0, 100));
      res.status(503).json({ status: 'error', message: 'Penyimpanan sementara gagal' });
      return;
    }
    console.log('duitku-callback', JSON.stringify({ order: baris.order_id, lunas: baris.lunas, cocok, db: hasil && hasil.status }));
    res.status(200).json({ status: 'ok' });
    return;
  }
  if (sudahDiproses.has(baris.order_id)) { res.status(200).json({ status: 'ok', catatan: 'sudah diproses' }); return; }
  sudahDiproses.set(baris.order_id, baris.lunas);
  console.log('duitku-callback', JSON.stringify({ order: baris.order_id, lunas: baris.lunas, cocok, simpan: 'database belum dikonfigurasi' }));
  res.status(200).json({ status: 'ok' });
}
