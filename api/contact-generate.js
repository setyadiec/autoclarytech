import crypto from 'node:crypto';

// Vercel Serverless Function: /api/contact-generate
// Arsitektur cont-ACT AI Awan (fal.ai) — arahan Bapak & Bey 18-19 Okt 2026

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

// Konfigurasi Supabase untuk penyimpanan kuota persisten
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hdxyzwjdbqhanimfspcm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// In-memory cache & fallback jika Supabase lambat/offline
const kuotaClientMap = new Map();
let hitunganHarianGlobal = 0;
let tanggalHariIni = new Date().toISOString().slice(0, 10);

function hitungHashKunci(clientIp, userAgentSnippet) {
  return crypto.createHash('sha256').update(`${clientIp}::${userAgentSnippet}`).digest('hex').slice(0, 32);
}

async function ambilKuotaPersisten(kunci) {
  const dariMemori = kuotaClientMap.get(kunci) || 0;
  if (!SUPABASE_KEY) return dariMemori;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/contact_kuota?kunci=eq.${encodeURIComponent(kunci)}&select=hitung,tanggal`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) return dariMemori;
    const rows = await resp.json();
    if (rows && rows.length > 0) {
      const dbHitung = Number(rows[0].hitung) || 0;
      const nilaiFinal = Math.max(dariMemori, dbHitung);
      kuotaClientMap.set(kunci, nilaiFinal);
      return nilaiFinal;
    }
    return dariMemori;
  } catch (err) {
    return dariMemori;
  }
}

async function simpanKuotaPersisten(kunci, hitungBaru, tanggal) {
  kuotaClientMap.set(kunci, hitungBaru);
  if (!SUPABASE_KEY) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/contact_kuota`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        kunci: kunci,
        hitung: hitungBaru,
        tanggal: tanggal,
        terakhir_akses: new Date().toISOString()
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
  } catch (err) {
    // Non-blocking fallback
  }
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  // Reset hitungan harian jika berganti tanggal
  const skrgTanggal = new Date().toISOString().slice(0, 10);
  if (skrgTanggal !== tanggalHariIni) {
    tanggalHariIni = skrgTanggal;
    hitunganHarianGlobal = 0;
  }

  // Batas Pengaman Global: Maksimal 100 generate/hari agar saldo API Bapak aman
  const kunciGlobal = `global:${skrgTanggal}`;
  const totalHarian = await ambilKuotaPersisten(kunciGlobal);
  const BATAS_GLOBAL_HARIAN = 100;
  if (totalHarian >= BATAS_GLOBAL_HARIAN) {
    return res.status(429).json({
      status: 'error',
      message: 'Batas pemakaian harian studio AI publik telah tercapai (100 foto/hari). Silakan coba lagi besok atau daftarkan antrean kustom.'
    });
  }

  const {
    foto,
    namaProduk,
    kategori,
    keunggulan,
    suasana,
    clientId
  } = req.body || {};

  // Validasi input
  if (!foto || typeof foto !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'Foto produk kamera HP wajib diunggah (format JPG, PNG, atau WebP).'
    });
  }

  // Cek Kuota Klien Sisi Server (3x Gratis per IP + Perangkat secara Persisten di Supabase)
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] || req.socket.remoteAddress || '127.0.0.1');
  const userAgentSnippet = (req.headers['user-agent'] || 'generic').slice(0, 40);
  const serverClientKey = hitungHashKunci(clientIp, userAgentSnippet);

  const pemakaianSaatIni = await ambilKuotaPersisten(serverClientKey);
  const MAKS_KUOTA_GRATIS = 3;

  if (pemakaianSaatIni >= MAKS_KUOTA_GRATIS) {
    return res.status(403).json({
      status: 'quota_exceeded',
      message: 'Jatah 3x coba gratis untuk perangkat/jaringan ini telah selesai digunakan. Selesaikan misi media sosial atau daftarkan antrean produksi kustom untuk membuka akses berikutnya.',
      sisaKuota: 0
    });
  }

  const namaBersih = String(namaProduk || 'Produk Unggulan').trim().slice(0, 100);
  const kategoriBersih = String(kategori || 'umum').trim().toLowerCase();
  const keunggulanBersih = String(keunggulan || 'kualitas terbaik & terpercaya').trim().slice(0, 200);
  const suasanaBersih = String(suasana || 'Meja marmer hitam elegan dengan pencahayaan warm spotlight dramatis').trim().slice(0, 300);

  // Kunci API fal.ai dari Environment Serverless Vercel
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    // Mode Jujur: Laporkan bila kunci FAL_KEY di serverless Vercel belum disematkan oleh Bapak
    return res.status(503).json({
      status: 'key_pending',
      message: 'Layanan AI Awan cont-ACT sedang dalam sinkronisasi kredensial Vercel (FAL_KEY). Mohon hubungi admin atau gunakan simulator visual.'
    });
  }

  // Susun Prompt Foto Studio Komersial (Model fal-ai/flux-pro/kontext)
  const promptStudio = `High-end commercial advertising studio photography of ${namaBersih}, placed neatly on ${suasanaBersih}. Natural contact shadows, soft ambient warm rim lighting, clean reflective surface, sharp focus on packaging details, photorealistic 8k, authentic presentation, award-winning product showcase`;

  try {
    // Panggil Queue fal.ai
    const falEndpoint = 'https://queue.fal.run/fal-ai/flux-pro/kontext';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 detik batas timeout antrean awal

    const falResp = await fetch(falEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: promptStudio,
        image_url: foto,
        num_images: 1
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!falResp.ok) {
      const errText = await falResp.text();
      console.error('Fal.ai queue error:', falResp.status, errText);
      return res.status(502).json({
        status: 'error',
        message: 'Gagal menghubungkan ke antrean AI Cloud fal.ai: ' + falResp.status
      });
    }

    const falData = await falResp.json();

    // Catat pemakaian kuota persisten ke Supabase & memori
    await simpanKuotaPersisten(serverClientKey, pemakaianSaatIni + 1, skrgTanggal);
    await simpanKuotaPersisten(kunciGlobal, totalHarian + 1, skrgTanggal);
    const sisaKuota = Math.max(0, MAKS_KUOTA_GRATIS - (pemakaianSaatIni + 1));

    // Racik Naskah Copywriting Jualan & 10 Tagar Relevan via LLM Awan fal.ai
    const { caption, hashtags } = await racikNaskahLlm(FAL_KEY, namaBersih, kategoriBersih, keunggulanBersih, suasanaBersih);

    return res.status(200).json({
      status: 'queued',
      requestId: falData.request_id,
      statusUrl: falData.status_url,
      responseUrl: falData.response_url,
      sisaKuota: sisaKuota,
      caption: caption,
      hashtags: hashtags
    });

  } catch (err) {
    console.error('Error contact-generate:', err.message);
    return res.status(500).json({
      status: 'error',
      message: 'Kendala koneksi ke serverless AI studio: ' + err.message
    });
  }
}

// Integrasi LLM Awan fal.ai (fal-ai/any-llm) untuk copywriting presisi & 10 tagar relevan
async function racikNaskahLlm(falKey, nama, kategori, keunggulan, suasana) {
  const promptLlm = `Kamu adalah copywriter profesional Indonesia untuk promosi produk UMKM di Instagram, TikTok, dan WhatsApp.
Tugas: Buat naskah caption jualan medsos yang memikat, persuasif, membangkitkan minat pembeli, dan bikin laku jualan.
Data Produk Klien:
- Nama Produk: ${nama}
- Kategori Usaha: ${kategori}
- Keunggulan Utama: ${keunggulan}
- Suasana Foto Studio: ${suasana}

Instruksi Formula:
1. Hook emosional yang mengena dan relevan dengan produk.
2. Jelaskan manfaat nyata dan keunggulan spesifik produk tersebut (jangan generik).
3. Call to Action (CTA) pemesanan yang jelas.
4. Tepat 10 tagar (hashtag) yang relevan, tertarget, dan populer.

Format keluaran WAJIB persis seperti ini (tanpa basa-basi pembuka):
CAPTION:
[Isi caption lengkap di sini, gunakan emoji yang memikat pembeli]

HASHTAGS:
#tagar1 #tagar2 #tagar3 #tagar4 #tagar5 #tagar6 #tagar7 #tagar8 #tagar9 #tagar10`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 detik batas waktu LLM
    const resp = await fetch('https://fal.run/fal-ai/any-llm', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: promptLlm }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      const outputText = String(data.output || '');

      const capMatch = outputText.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i);
      const hashMatch = outputText.match(/HASHTAGS:\s*([\s\S]*?)$/i);

      let caption = capMatch ? capMatch[1].trim() : '';
      let hashtags = hashMatch ? hashMatch[1].trim() : '';

      if (caption && hashtags) {
        return { caption, hashtags };
      }
    }
  } catch (err) {
    console.warn('Fallback LLM awan:', err.message);
  }

  // Fallback cerdas jika LLM awan timeout
  return racikNaskahFallback(nama, kategori, keunggulan);
}

// Helper peracik copywriting jualan formula Hook Menarik + Manfaat + CTA
function racikNaskahFallback(nama, kategori, keunggulan) {
  let caption = '';
  let hashtags = '';

  if (kategori === 'kuliner') {
    caption = `Pilihan tepat untuk penikmat kuliner berkualitas! ${nama} hadir dengan cita rasa istimewa.\n\nDibuat dari bahan-bahan pilihan bermutu tinggi: ${keunggulan}. Sangat pas untuk menemani waktu kerja, kumpul keluarga, maupun hidangan spesial.\n\nPenawaran Terbatas Hari Ini:\nDapatkan harga promo khusus pemesanan sekarang. Silakan klik tautan di bio untuk informasi dan pemesanan!`;
    hashtags = `#kulinerindonesia #kulineran #cemilanenak #makananviral #jajanankekinian #racuntiktok #fypkuliner #foodies #enakbanget #reelskuliner`;
  } else if (kategori === 'skincare') {
    caption = `Rawat kesehatan kulit wajah Anda dengan perawatan yang tepat. Memperkenalkan ${nama}.\n\nDiformulasikan khusus untuk ${keunggulan}. Formulanya ringan di kulit, nyaman digunakan secara rutin, serta membantu menjaga kesegaran alami wajah.\n\nPromo Khusus Hari Ini:\nDapatkan penawaran istimewa untuk pembelian pekan ini. Silakan kunjungi tautan di profil sebelum masa promo berakhir.`;
    hashtags = `#skincareroutine #racunskincare #kulitglowing #skincarebpom #beautytips #fypindonesia #viralreels #cantikalami #perawatanwajah #racuntiktok`;
  } else if (kategori === 'fashion') {
    caption = `Tampil percaya diri dengan busana yang nyaman dan elegan: ${nama}.\n\nDirancang menggunakan material berkualitas yang jatuh rapi di badan: ${keunggulan}. Pilihan serasi baik untuk agenda formal maupun kegiatan santai harian.\n\nPersediaan Terbatas:\nAmankan ukuran dan varian pilihan Anda sekarang juga melalui tautan di profil.`;
    hashtags = `#ootdindonesia #fashionviral #outfitharian #racuntiktok #bajubagus #hijabstyle #reelsfashion #fypoutfit #racunshopee #styleinspo`;
  } else if (kategori === 'herbal') {
    caption = `Kesehatan adalah investasi terbaik untuk masa depan keluarga. Jaga stamina harian dengan ${nama}.\n\nKhasiat alami murni untuk mendukung daya tahan tubuh secara optimal: ${keunggulan}. Tanpa bahan tambahan yang merugikan, aman untuk konsumsi harian.\n\nPemesanan & Konsultasi:\nHubungi kami melalui tautan di profil untuk mendapatkan produk asli bergaransi.`;
    hashtags = `#hidupsehat #herbalalami #kesehatantubuh #suplemenalami #madumurni #tipssehat #herbalindonesia #fypkesehatan #sehatberkah #racunsehat`;
  } else {
    caption = `Solusi fungsional untuk menunjang aktivitas harian Anda: ${nama}.\n\nKualitas teruji, andal, dan ${keunggulan}. Dibuat secara presisi untuk memberikan kemudahan serta efisiensi maksimal.\n\nPromo Perdana:\nDapatkan penawaran harga terbaik khusus hari ini dengan mengunjungi tautan di profil.`;
    hashtags = `#produkviral #racuntiktok #barangunik #solusicerdas #fypindonesia #viralhariini #tokoonline #belanjaonline #murahberkualitas #reelsindonesia`;
  }

  return { caption, hashtags };
}
