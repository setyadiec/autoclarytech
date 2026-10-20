// CONT-ACT V2 — pembantu akun & buku kredit (Supabase project cont-ACT). Bey, 20 Okt 2026.
// ATURAN: tidak ada kunci di berkas ini. ACT_SUPABASE_URL dan ACT_SUPABASE_KEY (service_role) HANYA dari environment server.
// Semua saldo/kredit hidup di database (tabel akun, buku_kredit, pembayaran); browser tidak pernah menyimpan atau mengubah saldo.
import crypto from 'node:crypto';

export function konfigDb() {
  const url = (process.env.ACT_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.ACT_SUPABASE_KEY || '';
  return { siap: Boolean(url && key), url, key };
}

async function panggil(metode, jalur, badan) {
  const c = konfigDb();
  if (!c.siap) throw new Error('database belum dikonfigurasi');
  const r = await fetch(c.url + jalur, {
    method: metode,
    headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: badan === undefined ? undefined : JSON.stringify(badan),
    signal: AbortSignal.timeout(8000)
  });
  const teks = await r.text();
  let j = null;
  try { j = teks ? JSON.parse(teks) : null; } catch { j = teks; }
  if (!r.ok) throw new Error('db ' + r.status + ' ' + String(teks).slice(0, 120));
  return j;
}

export const rpc = (nama, args) => panggil('POST', '/rest/v1/rpc/' + nama, args);
export const tulis = (tabel, baris) => panggil('POST', '/rest/v1/' + tabel, baris);
export const baca = (jalur) => panggil('GET', '/rest/v1/' + jalur);

// nomor WA -> 62812..., hanya angka; null bila tidak masuk akal
export function normalisasiWA(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  if (!d.startsWith('62') || d.length < 10 || d.length > 15) return null;
  return d;
}

export const hashToken = (t) => crypto.createHash('sha256').update(String(t || '')).digest('hex');
export const bikinToken = () => crypto.randomBytes(24).toString('base64url');

function samaAman(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// mengembalikan id akun bila (wa, token) cocok; selain itu null
export async function autentikasi(wa, token) {
  const nomor = normalisasiWA(wa);
  if (!nomor || !token) return null;
  const baris = await baca('akun?select=id,token_hash&wa=eq.' + encodeURIComponent(nomor) + '&limit=1');
  if (!Array.isArray(baris) || !baris.length) return null;
  return samaAman(baris[0].token_hash, hashToken(token)) ? baris[0].id : null;
}

// pembatas laju sederhana per IP (per instance): maks n kejadian / menit
const LAJU = new Map();
export function terlaluSering(req, kunci, maks, menit = 10) {
  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x');
  const k = kunci + ':' + ip;
  const kini = Date.now();
  const arr = (LAJU.get(k) || []).filter((t) => kini - t < menit * 60000);
  if (arr.length >= maks) return true;
  arr.push(kini);
  LAJU.set(k, arr);
  return false;
}
