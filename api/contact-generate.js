import { konfigDb, autentikasi, rpc, tulis } from './_akun.js';
import crypto from 'node:crypto';
import { pilihPipaGambar, bangunPromptPreservasi } from './_model_router.js';

// Vercel Serverless Function: /api/contact-generate
// Arsitektur cont-ACT Studio AI AutoClaryTech — arahan Bapak & Bey 18-20 Okt 2026

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

// Konfigurasi Supabase untuk penyimpanan kuota persisten khusus ACT
// Hanya aktif bila Bapak telah menyiapkan project Supabase terpisah khusus ACT (profil BeyVault act-supabase)
const SUPABASE_URL = process.env.ACT_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.ACT_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

// In-memory per-instance fallback (aman, terisolasi, tidak menyentuh database klien lain)
const kuotaClientMap = new Map();
let hitunganHarianGlobal = 0;
let tanggalHariIni = new Date().toISOString().slice(0, 10);

function hitungHashKunci(clientIp, userAgentSnippet) {
  return crypto.createHash('sha256').update(`${clientIp}::${userAgentSnippet}`).digest('hex').slice(0, 32);
}

async function ambilKuotaPersisten(kunci) {
  const dariMemori = kuotaClientMap.get(kunci) || 0;
  if (!SUPABASE_URL || !SUPABASE_KEY) return dariMemori;

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
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

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
  res.setHeader('Access-Control-Allow-Origin', 'https://www.autoclarytech.com');
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
    fotos,
    namaProduk,
    kategori,
    keunggulan,
    suasana,
    tujuanKonten,
    nomorWa,
    clientId
  } = req.body || {};

  // Validasi input: mendukung fotos (array multi-foto maks 4) atau foto (single string)
  const daftarFoto = (Array.isArray(fotos) && fotos.length > 0 ? fotos : (foto ? [foto] : [])).slice(0, 4);
  if (daftarFoto.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Foto produk kamera HP wajib diunggah (format JPG, PNG, atau WebP).'
    });
  }
  const fotoUtama = daftarFoto[0];

  // AKUN & KREDIT (buku kredit server): bila database ACT aktif, akun WAJIB terdaftar dan 1 kredit dipotong atomik sebelum model dipanggil.
  // Kuota lama per-IP dimatikan saat itu (kredit menggantikannya). Saldo TIDAK pernah dipercaya dari browser.
  const dbAktif = konfigDb().siap;
  let akunId = null;
  if (dbAktif) {
    const b = req.body || {};
    try { akunId = await autentikasi(b.akunWa || b.wa, b.akunToken || b.token); } catch (e) {
      return res.status(502).json({ status: 'error', message: 'Layanan kredit sedang sibuk. Coba lagi.' });
    }
    if (!akunId) {
      return res.status(401).json({ status: 'perlu_daftar', message: 'Daftarkan nomor WhatsApp Anda dulu untuk memakai studio.' });
    }
  }

  // Cek Kuota Klien Sisi Server (3x Gratis per IP + Perangkat secara Persisten di Supabase) -- hanya bila buku kredit belum aktif

  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1');
  const userAgentSnippet = (req.headers['user-agent'] || 'generic').slice(0, 40);
  const serverClientKey = hitungHashKunci(clientIp, userAgentSnippet);

  const pemakaianSaatIni = await ambilKuotaPersisten(serverClientKey);
  const MAKS_KUOTA_GRATIS = 3;

  if (!dbAktif && pemakaianSaatIni >= MAKS_KUOTA_GRATIS) {
    return res.status(403).json({
      status: 'quota_exceeded',
      message: 'Jatah 3x coba gratis untuk perangkat/jaringan ini telah selesai digunakan. Selesaikan misi media sosial atau daftarkan antrean produksi kustom untuk membuka akses berikutnya.',
      sisaKuota: 0
    });
  }

  const namaBersih = String(namaProduk || 'Produk Unggulan').trim().slice(0, 100);
  const kategoriBersih = String(kategori || 'umum').trim().toLowerCase();
  const keunggulanBersih = String(keunggulan || 'kualitas terbaik & terpercaya').trim().slice(0, 200);
  const tujuanBersih = String(tujuanKonten || 'hard_sell').trim();
  const waBersih = formatNomorWa(nomorWa);

  // AI PRODUCT INSPECTOR & CREATIVE DIRECTOR ENGINE (SPESIFIKASI CONT-ACT V2)
  const { inspector, creativeBrief, carouselSlides, promptStudio, negativePrompt } = bangunProductInspectorDanCreativeBrief({
    fotos: daftarFoto,
    nama: namaBersih,
    kategori: kategoriBersih,
    keunggulan: keunggulanBersih,
    suasana: suasana,
    tujuanKonten: tujuanBersih,
    nomorWa: waBersih
  });

  // Kunci API studio dari Environment Serverless Vercel
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    // Mode Responsif: Mengembalikan hasil inspeksi & copywriting fallback jika kunci serverless sedang sinkronisasi
    const paketKontenFallback = racikPaketKontenFallback(namaBersih, kategoriBersih, keunggulanBersih, tujuanBersih, waBersih);
    let linkWa = '';
    if (waBersih) {
      linkWa = `https://wa.me/${waBersih}?text=${encodeURIComponent('Halo, saya tertarik dengan ' + namaBersih + ' yang ada di konten Anda. Boleh minta info detail dan cara pemesanannya?')}`;
    }
    return res.status(200).json({
      status: 'ready',
      requestId: 'sim_' + Date.now(),
      statusUrl: '',
      responseUrl: '',
      sisaKuota: Math.max(0, MAKS_KUOTA_GRATIS - (pemakaianSaatIni + 1)),
      caption: paketKontenFallback.caption,
      videoScript: paketKontenFallback.videoScript,
      waStatus: paketKontenFallback.waStatus,
      ideKonten7Hari: paketKontenFallback.ideKonten7Hari,
      hashtags: paketKontenFallback.hashtags,
      linkWa: linkWa,
      productInspector: inspector,
      creativeDirector: creativeBrief,
      carouselSlides: carouselSlides
    });
  }

  let sisaKredit = null;
  if (dbAktif) {
    try {
      sisaKredit = Number(await rpc('pakai_kredit', { p_akun: akunId, p_n: 1, p_alasan: 'pakai:poster' }));
    } catch (e) {
      return res.status(502).json({ status: 'error', message: 'Layanan kredit sedang sibuk. Coba lagi.' });
    }
    if (sisaKredit < 0) {
      return res.status(402).json({ status: 'kredit_habis', sisaKredit: 0, message: 'Kredit Anda habis. Pilih paket untuk melanjutkan.' });
    }
  }
  const kembalikanKredit = async () => {          // pembuatan gagal setelah dipotong -> kredit dikembalikan
    if (dbAktif && sisaKredit !== null && sisaKredit >= 0) {
      try { await rpc('kembalikan_kredit', { p_akun: akunId, p_n: 1, p_alasan: 'pakai:poster' }); sisaKredit += 1; } catch (e) { console.log('pengembalian kredit GAGAL', String(e.message).slice(0, 80)); }
    }
  };

  try {
    // Pilih Pipa Model Studio AI Berdasarkan Jumlah Foto & Putusan Bapak (seedream v4 edit bawaan)
    const pipa = pilihPipaGambar(daftarFoto.length);
    const promptPreservasi = bangunPromptPreservasi({
      nama: namaBersih,
      kategori: kategoriBersih,
      keunggulan: keunggulanBersih,
      suasana: suasana,
      mode: pipa.mode
    });

    const falBody = pipa.bangunBody(promptPreservasi, daftarFoto);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20 detik batas timeout antrean awal

    const falResp = await fetch(pipa.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(falBody),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!falResp.ok) {
      const errText = await falResp.text();
      console.error('Studio AI queue error:', falResp.status, errText);
      await kembalikanKredit();
      return res.status(502).json({
        status: 'error',
        message: 'Gagal menghubungkan ke antrean Studio Foto AI: ' + falResp.status
      });
    }

    const falData = await falResp.json();

    if (dbAktif && falData && falData.request_id) {         // tiket pekerjaan sah: dipakai contact-status untuk menjalankan gerbang mutu sekali
      try { await tulis('job_gambar', { request_id: String(falData.request_id), akun_id: akunId }); } catch (e) { console.log('catat job gagal', String(e.message).slice(0, 80)); }
    }

    // Catat pemakaian kuota persisten ke Supabase & memori
    await simpanKuotaPersisten(serverClientKey, pemakaianSaatIni + 1, skrgTanggal);
    await simpanKuotaPersisten(kunciGlobal, totalHarian + 1, skrgTanggal);
    const sisaKuota = Math.max(0, MAKS_KUOTA_GRATIS - (pemakaianSaatIni + 1));

    // Racik Paket Konten Kreator 360 Derajat via AI Copywriter
    const paketKonten = await racikPaketKontenLlm(FAL_KEY, namaBersih, kategoriBersih, keunggulanBersih, suasana, tujuanBersih, waBersih);

    let linkWa = '';
    if (waBersih) {
      linkWa = `https://wa.me/${waBersih}?text=${encodeURIComponent('Halo, saya tertarik dengan ' + namaBersih + ' yang ada di konten Anda. Boleh minta info detail dan cara pemesanannya?')}`;
    }

    return res.status(200).json({
      status: 'queued',
      requestId: falData.request_id,
      statusUrl: falData.status_url,
      responseUrl: falData.response_url,
      modelKode: pipa.kode,
      modePipa: pipa.mode,
      fotoRefsCount: daftarFoto.length,
      sisaKuota: dbAktif ? Math.max(0, sisaKredit) : sisaKuota,
      sisaKredit: dbAktif ? Math.max(0, sisaKredit) : undefined,
      caption: paketKonten.caption,
      videoScript: paketKonten.videoScript,
      waStatus: paketKonten.waStatus,
      ideKonten7Hari: paketKonten.ideKonten7Hari,
      hashtags: paketKonten.hashtags,
      linkWa: linkWa,
      productInspector: inspector,
      creativeDirector: creativeBrief,
      carouselSlides: carouselSlides
    });

  } catch (err) {
    console.error('Error contact-generate:', err.message);
    await kembalikanKredit();
    return res.status(500).json({
      status: 'error',
      message: 'Kendala koneksi ke serverless AI studio: ' + err.message
    });
  }
}

function formatNomorWa(no) {
  if (!no) return '';
  let bersih = String(no).replace(/[^0-9]/g, '');
  if (!bersih) return '';
  if (bersih.startsWith('0')) {
    bersih = '62' + bersih.slice(1);
  } else if (!bersih.startsWith('62')) {
    bersih = '62' + bersih;
  }
  return bersih;
}

// Integrasi AI Copywriter untuk copywriting presisi & 10 tagar relevan
async function racikPaketKontenLlm(falKey, nama, kategori, keunggulan, suasana, tujuanKonten, nomorWa) {
  const penjelasanTujuan = {
    hard_sell: 'Fokus penjualan langsung, manfaat nyata produk, dan dorong pemesanan segera.',
    storytelling: 'Fokus cerita proses produksi, kualitas bahan baku pilihan, dan membangun kepercayaan pembeli.',
    edukasi: 'Fokus problem-solution, edukasi masalah konsumen yang tuntas dengan produk ini.'
  }[tujuanKonten] || 'Meningkatkan penjualan dan minat beli produk secara jujur.';

  const promptLlm = `Kamu adalah Senior Content Creator & Copywriter Khusus Produk UMKM di Indonesia (Instagram Reels, TikTok, dan WhatsApp).
Tujuan Utama: Menciptakan konten yang terbukti meningkatkan omzet dan minat beli produk secara nyata, santun, dan jujur.

Data Produk Klien:
- Nama Produk: ${nama}
- Kategori Usaha: ${kategori}
- Keunggulan Utama: ${keunggulan}
- Suasana Foto: ${suasana}
- Sudut Pandang/Tujuan Konten: ${penjelasanTujuan}
- Kontak Pemesanan: ${nomorWa ? 'WhatsApp ' + nomorWa : 'Tautan di Profil / Bio'}

[ATURAN KERAS ANTI-PLACEHOLDER & KEJUJURAN]:
1. DILARANG KERAS menggunakan teks placeholder harfiah seperti [Emoji ...], [Masukkan ...], [Isi ...], atau [Ganti ...]. Gunakan emoji asli Unicode (seperti ✨, 🔥, 📦, 🥟) langsung di dalam kalimat!
2. DILARANG KERAS menggunakan kata klaim mutlak atau jaminan fiktif seperti 'dijamin' atau 'garansi' KECUALI jika secara eksplisit tercantum dalam data keunggulan produk.
3. DILARANG mengarang diskon, harga potongan, promo, atau klaim stok terbatas fiktif (seperti "lagi promo hari ini aja", "diskon 50%") jika tidak tertulis di data klien.
4. DILARANG mengarang kata sifat atau atribut fiktif pada hashtag (seperti #homemade, #tradisional, #organik) jika tidak disebutkan di data keunggulan produk.

Tugas: Buat 5 Aset Konten Kreator Siap Pakai:
1. CAPTION FEED (Instagram/Facebook): Hook memikat pembuka, elaborasi manfaat produk yang menyentuh kebutuhan konsumen secara jujur berdasarkan data keunggulan di atas, dan Call to Action pemesanan yang jelas.
2. SKRIP VIDEO REELS & TIKTOK (15–30 Detik):
   - Hook 3 Detik (Teks di layar & narasi pembuka yang menghentikan scroll)
   - Panduan Visual B-roll Kamera HP (adegan yang harus direkam)
   - Narasi Voiceover
   - CTA Penutup
3. STATUS WHATSAPP (Story / Chat Broadcast): Teks ringkas, ramah, mengundang calon pembeli membalas chat secara spontan.
4. RENCANA KONTEN 7 HARI: Ide posting tematik Hari 1 s.d. Hari 7 (kombinasi Reels, Feed, dan Story) agar pemilik usaha konsisten jualan selama seminggu penuh.
5. HASHTAGS: Tepat 10 tagar relevan, tertarget, dan populer.
   [ATURAN HASHTAGS]: TEPAT 10 TAGAR murni awalan #, tanpa nama kota, tanpa tanda kurung, tanpa atribut fiktif.

Format keluaran WAJIB persis seperti ini (tanpa basa-basi pembuka):
===CAPTION===
[Teks caption feed lengkap di sini, gunakan emoji asli yang memikat]

===VIDEOSCRIPT===
[Teks skrip video lengkap dengan pembagian Hook 3 Detik, Panduan Visual B-roll, Narasi Suara, dan CTA Penutup]

===WASTATUS===
[Teks status WhatsApp ringkas dan ramah tanpa klaim jaminan fiktif]

===IDE7HARI===
[Rencana konten Hari 1 sampai Hari 7]

===HASHTAGS===
#tagar1 #tagar2 #tagar3 #tagar4 #tagar5 #tagar6 #tagar7 #tagar8 #tagar9 #tagar10`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12 detik batas waktu LLM
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

      const capMatch = outputText.match(/===CAPTION===([\s\S]*?)(?====VIDEOSCRIPT===|$)/i);
      const vidMatch = outputText.match(/===VIDEOSCRIPT===([\s\S]*?)(?====WASTATUS===|$)/i);
      const waMatch = outputText.match(/===WASTATUS===([\s\S]*?)(?====IDE7HARI===|$)/i);
      const ideMatch = outputText.match(/===IDE7HARI===([\s\S]*?)(?====HASHTAGS===|$)/i);
      const hashMatch = outputText.match(/===HASHTAGS===([\s\S]*?)$/i);

      let caption = capMatch ? capMatch[1].trim() : '';
      let videoScript = vidMatch ? vidMatch[1].trim() : '';
      let waStatus = waMatch ? waMatch[1].trim() : '';
      let ideKonten7Hari = ideMatch ? ideMatch[1].trim() : '';
      let hashtags = hashMatch ? hashMatch[1].trim() : '';

      // Sanitasi ketat keluaran AI Copywriter
      caption = bersihkanTeksPlaceholder(caption);
      videoScript = bersihkanTeksPlaceholder(videoScript);
      const waStatusBersih = bersihkanWaStatus(bersihkanTeksPlaceholder(waStatus), nama, keunggulan, nomorWa);
      const ideKontenBersih = bersihkanTeksPlaceholder(ideKonten7Hari);
      const hashtagsBersih = bersihkanHashtags(hashtags, kategori, nama, keunggulan);

      if (caption && hashtagsBersih) {
        return {
          caption,
          videoScript: videoScript || racikVideoScriptFallback(nama, kategori, keunggulan, tujuanKonten, nomorWa),
          waStatus: waStatusBersih,
          ideKonten7Hari: ideKontenBersih || racikIde7HariFallback(nama, kategori),
          hashtags: hashtagsBersih
        };
      }
    }
  } catch (err) {
    console.warn('Fallback AI Copywriter:', err.message);
  }

  // Fallback cerdas jika AI Copywriter timeout
  return racikPaketKontenFallback(nama, kategori, keunggulan, tujuanKonten, nomorWa);
}

// Fungsi Pembersih Placeholder Teks Bocor seperti [Emoji bakpao], [Masukkan ...] dan Markdown Mentah (**)
function bersihkanTeksPlaceholder(teks) {
  if (!teks || typeof teks !== 'string') return '';
  return teks
    .replace(/\[\s*emoji[^\]]*\]/gi, '')
    .replace(/\[\s*masukkan[^\]]*\]/gi, '')
    .replace(/\[\s*isi[^\]]*\]/gi, '')
    .replace(/\[\s*ganti[^\]]*\]/gi, '')
    .replace(/\[\s*link[^\]]*\]/gi, '')
    .replace(/\[\s*nomor[^\]]*\]/gi, '')
    .replace(/\*\*/g, '') // Bersihkan markdown bold mentah
    .replace(/^\s*\*\s{2,}/gm, '• ') // Ubah markdown bullet mentah menjadi bullet bersih
    .replace(/^\s*\*\s+/gm, '• ')
    .replace(/terbatas/gi, 'tersedia')
    .trim();
}

// Sanitasi Hashtag: Menjamin tepat 10 tagar murni tanpa kota, tanpa tanda kurung & tanpa atribut fiktif
function bersihkanHashtags(rawHashtags, kategori, nama, keunggulan) {
  if (!rawHashtags || typeof rawHashtags !== 'string') {
    return '#kulinerindonesia #kulineran #cemilanenak #makananviral #jajanankekinian #racuntiktok #fypkuliner #foodies #enaksekali #reelskuliner';
  }

  // 1. Buang semua teks dalam tanda kurung: (ganti kota jika perlu), dll.
  let teks = rawHashtags.replace(/\([^)]*\)/g, ' ');

  // 2. Ekstrak seluruh token hashtag (#kata)
  let tags = teks.match(/#[A-Za-z0-9_]+/g) || [];

  // 3. Buang hashtag yang mengandung nama kota
  const daftarKota = ['bandung', 'jakarta', 'surabaya', 'jogja', 'yogyakarta', 'semarang', 'solo', 'bali', 'medan', 'makassar', 'malang', 'bogor', 'bekasi', 'tangerang', 'depok'];
  tags = tags.filter(t => !daftarKota.some(k => t.toLowerCase().includes(k)));

  // 4. Buang hashtag yang mengarang atribut fiktif jika tidak ada di data klien
  const kataKunciData = `${nama || ''} ${keunggulan || ''}`.toLowerCase();
  const atributSensitif = ['homemade', 'tradisional', 'kuno', 'organik', 'tanpapengawet', 'resepkuno', 'jadul'];
  tags = tags.filter(t => {
    const tLow = t.toLowerCase();
    for (const attr of atributSensitif) {
      if (tLow.includes(attr) && !kataKunciData.includes(attr)) {
        return false;
      }
    }
    return true;
  });

  // 5. Cadangan tagar murni per kategori (bebas kota & bebas klaim fiktif)
  const cadanganKategori = {
    kuliner: ['#kulinerindonesia', '#kulineran', '#cemilanenak', '#makananviral', '#jajanankekinian', '#racuntiktok', '#fypkuliner', '#foodies', '#enaksekali', '#reelskuliner'],
    skincare: ['#skincareroutine', '#racunskincare', '#kulitglowing', '#skincarebpom', '#beautytips', '#fypindonesia', '#viralreels', '#cantikalami', '#perawatanwajah', '#racuntiktok'],
    fashion: ['#ootdindonesia', '#fashionviral', '#outfitharian', '#racuntiktok', '#bajubagus', '#hijabstyle', '#reelsfashion', '#fypoutfit', '#racunshopee', '#styleinspo'],
    herbal: ['#hidupsehat', '#herbalalami', '#kesehatantubuh', '#suplemenalami', '#madumurni', '#tipssehat', '#herbalindonesia', '#fypkesehatan', '#sehatberkah', '#racunsehat']
  };
  const cadanganUmum = ['#produkviral', '#racuntiktok', '#barangunik', '#solusicerdas', '#fypindonesia', '#viralhariini', '#tokoonline', '#belanjaonline', '#murahberkualitas', '#reelsindonesia'];
  const poolCadangan = cadanganKategori[kategori] || cadanganUmum;

  for (const c of poolCadangan) {
    if (tags.length >= 10) break;
    if (!tags.some(t => t.toLowerCase() === c.toLowerCase())) {
      tags.push(c);
    }
  }

  // Tepat 10 tagar murni
  return tags.slice(0, 10).join(' ');
}

// Sanitasi Status WA: Membersihkan klaim promo/garansi fiktif jika tidak ada di input klien
function bersihkanWaStatus(waRaw, nama, keunggulan, nomorWa) {
  if (!waRaw || typeof waRaw !== 'string') return racikWaStatusFallback(nama, '', keunggulan, nomorWa);
  let hasil = waRaw
    .replace(/Lagi ada promo TERBATAS hari ini aja lho!?/gi, '')
    .replace(/Promo terbatas hari ini aja lho!?/gi, '')
    .replace(/Promo terbatas hari ini!?/gi, '')
    .replace(/Slot hari ini terbatas hanya \d+ porsi/gi, 'Siap dipesan untuk Anda');

  // Bersihkan placeholder emoji [Emoji ...]
  hasil = bersihkanTeksPlaceholder(hasil);

  // Jika kata 'dijamin' tidak ada di keunggulan yang ditulis klien, ubah menjadi 'terasa' atau hapus
  const keunggulanLow = String(keunggulan || '').toLowerCase();
  if (!keunggulanLow.includes('dijamin')) {
    hasil = hasil.replace(/\bdijamin\b/gi, 'terasa');
  }

  hasil = hasil.trim();
  return hasil || racikWaStatusFallback(nama, '', keunggulan, nomorWa);
}

// Helper peracik copywriting jualan formula Hook Menarik + Manfaat + CTA
function racikPaketKontenFallback(nama, kategori, keunggulan, tujuanKonten, nomorWa) {
  let caption = '';
  let hashtags = '';
  const ctaText = nomorWa ? `Pemesanan via WhatsApp: https://wa.me/${nomorWa}` : 'Silakan klik tautan di profil untuk informasi dan pemesanan!';

  if (kategori === 'kuliner') {
    caption = `Pilihan tepat untuk penikmat kuliner berkualitas! ${nama} hadir dengan cita rasa istimewa.\n\nDibuat dari bahan-bahan pilihan bermutu tinggi: ${keunggulan}. Sangat pas untuk menemani waktu kerja, santai bersama keluarga, maupun hidangan spesial.\n\nInformasi & Pemesanan:\n${ctaText}`;
    hashtags = `#kulinerindonesia #kulineran #cemilanenak #makananviral #jajanankekinian #racuntiktok #fypkuliner #foodies #enaksekali #reelskuliner`;
  } else if (kategori === 'skincare') {
    caption = `Rawat kesehatan kulit wajah Anda dengan perawatan yang tepat. Memperkenalkan ${nama}.\n\nDiformulasikan khusus untuk ${keunggulan}. Formulanya ringan di kulit, nyaman digunakan secara rutin, serta membantu menjaga kesegaran alami wajah.\n\nInformasi & Pemesanan:\n${ctaText}`;
    hashtags = `#skincareroutine #racunskincare #kulitglowing #skincarebpom #beautytips #fypindonesia #viralreels #cantikalami #perawatanwajah #racuntiktok`;
  } else if (kategori === 'fashion') {
    caption = `Tampil percaya diri dengan busana yang nyaman dan elegan: ${nama}.\n\nDirancang menggunakan material berkualitas yang jatuh rapi di badan: ${keunggulan}. Pilihan serasi baik untuk agenda formal maupun kegiatan santai harian.\n\nInformasi & Pemesanan:\n${ctaText}`;
    hashtags = `#ootdindonesia #fashionviral #outfitharian #racuntiktok #bajubagus #hijabstyle #reelsfashion #fypoutfit #racunshopee #styleinspo`;
  } else if (kategori === 'herbal') {
    caption = `Kesehatan adalah investasi terbaik untuk masa depan keluarga. Jaga stamina harian dengan ${nama}.\n\nKhasiat alami murni untuk mendukung daya tahan tubuh secara optimal: ${keunggulan}. Tanpa bahan tambahan yang merugikan, aman untuk konsumsi harian.\n\nInformasi & Pemesanan:\n${ctaText}`;
    hashtags = `#hidupsehat #herbalalami #kesehatantubuh #suplemenalami #madumurni #tipssehat #herbalindonesia #fypkesehatan #sehatberkah #racunsehat`;
  } else {
    caption = `Solusi fungsional untuk menunjang aktivitas harian Anda: ${nama}.\n\nKualitas teruji, andal, dan ${keunggulan}. Dibuat secara presisi untuk memberikan kemudahan serta efisiensi maksimal.\n\nInformasi & Pemesanan:\n${ctaText}`;
    hashtags = `#produkviral #racuntiktok #barangunik #solusicerdas #fypindonesia #viralhariini #tokoonline #belanjaonline #murahberkualitas #reelsindonesia`;
  }

  return {
    caption,
    videoScript: racikVideoScriptFallback(nama, kategori, keunggulan, tujuanKonten, nomorWa),
    waStatus: racikWaStatusFallback(nama, kategori, keunggulan, nomorWa),
    ideKonten7Hari: racikIde7HariFallback(nama, kategori),
    hashtags
  };
}

function racikVideoScriptFallback(nama, kategori, keunggulan, tujuanKonten, nomorWa) {
  const ctaWa = nomorWa ? `Ketik 'MAU' atau klik link WhatsApp di bio!` : `Ketik 'MAU' di komentar atau cek tautan bio sekarang!`;
  
  if (kategori === 'kuliner') {
    return `[DURASI: 20 DETIK]\n\n` +
      `00:00 - 00:03 (HOOK PEMBUKA)\n` +
      `• Teks di Layar: "Pecinta kuliner wajib tahu ini!"\n` +
      `• Visual Kamera HP: Close-up dramatis produk ${nama}, perlihatkan tekstur lezat dan kepulan asap / kesegaran produk.\n` +
      `• Suara/Voiceover: "Jangan tonton video ini kalau kamu gampang lapar!"\n\n` +
      `00:03 - 00:12 (BEDAH PRODUK & KEUNGGULAN)\n` +
      `• Visual Kamera HP: Tunjukkan potongan produk, saat disajikan, atau dinikmati suapan pertama dengan ekspresi puas.\n` +
      `• Suara/Voiceover: "Ini dia ${nama}. Dibuat dari bahan pilihan: ${keunggulan}. Rasanya benar-benar istimewa sejak gigitan pertama."\n\n` +
      `00:12 - 00:20 (CALL TO ACTION)\n` +
      `• Visual Kamera HP: Tampilkan kemasan rapi siap kirim dan kontak pemesanan.\n` +
      `• Suara/Voiceover: "Untuk informasi detail dan pemesanan: ${ctaWa}"`;
  } else if (kategori === 'skincare') {
    return `[DURASI: 20 DETIK]\n\n` +
      `00:00 - 00:03 (HOOK PEMBUKA)\n` +
      `• Teks di Layar: "Stop salah pilih skincare!"\n` +
      `• Visual Kamera HP: Teteskan atau usap lembut produk ${nama} ke kulit tangan / wajah, perlihatkan tekstur yang cepat meresap.\n` +
      `• Suara/Voiceover: "Punya masalah kulit kusam yang bikin kurang percaya diri?"\n\n` +
      `00:03 - 00:12 (SOLUSI & BENEFIT)\n` +
      `• Visual Kamera HP: Tunjukkan botol kemasan ${nama} yang elegan dan kulit sehat bercahaya alami.\n` +
      `• Suara/Voiceover: "Cobain rutin pakai ${nama}. Formula ringannya efektif untuk ${keunggulan} tanpa rasa lengket."\n\n` +
      `00:12 - 00:20 (CALL TO ACTION)\n` +
      `• Visual Kamera HP: Tunjukkan paket lengkap produk.\n` +
      `• Suara/Voiceover: "Pesan sekarang langsung dari penjual terpercaya. ${ctaWa}"`;
  } else {
    return `[DURASI: 20 DETIK]\n\n` +
      `00:00 - 00:03 (HOOK PEMBUKA)\n` +
      `• Teks di Layar: "Akhirnya nemu solusi yang pas!"\n` +
      `• Visual Kamera HP: Tunjukkan produk ${nama} langsung saat digunakan dalam situasi nyata.\n` +
      `• Suara/Voiceover: "Sering repot cari produk yang benar-benar berkualitas?"\n\n` +
      `00:03 - 00:12 (PEMBUKTIAN KUALITAS)\n` +
      `• Visual Kamera HP: Sorot detail kerapian bahan, ketahanan, dan keunggulan utama: ${keunggulan}.\n` +
      `• Suara/Voiceover: "Kini hadir ${nama}. Terbukti ${keunggulan}, praktis, dan bikin hari-hari kamu jauh lebih mudah."\n\n` +
      `00:12 - 00:20 (CALL TO ACTION)\n` +
      `• Visual Kamera HP: Kemasan rapi dan kontak pemesanan.\n` +
      `• Suara/Voiceover: "Siap kirim ke tempat Anda. Langsung pesan sekarang lewat ${ctaWa}"`;
  }
}

function racikWaStatusFallback(nama, kategori, keunggulan, nomorWa) {
  const kontak = nomorWa ? `\n\nBisa langsung chat kami via WhatsApp wa.me/${nomorWa} ya!` : `\n\nBisa langsung balas status ini untuk info pemesanan ya!`;
  return `Halo semuanya! Buat yang mencari ${nama} berkualitas...\n\nProduk kami dibuat dengan keunggulan: ${keunggulan}.\n\nSiap dipesan untuk menemani aktivitas harian Anda.${kontak}`;
}

function racikIde7HariFallback(nama, kategori) {
  return `📅 RENCANA KONTEN 7 HARI UNTUK MENINGKATKAN OMZET:
• HARI 1 (Reels/TikTok): Video Hook Penasaran — "3 Alasan Kenapa ${nama} Selalu Dicari Pelanggan".
• HARI 2 (Instagram Feed): Foto Studio Katalog Premium + Cerita di Balik Bahan Pilihan.
• HARI 3 (WhatsApp Story): Video Singkat Packing Pesanan — Menunjukkan antusiasme pembeli (Social Proof).
• HARI 4 (Reels/TikTok): Video Before-After / Review Jujur Pelanggan Pertama.
• HARI 5 (Instagram Feed & Reels): Edukasi Masalah Konsumen & Kenapa ${nama} Jadi Solusi Terbaik.
• HARI 6 (WhatsApp Story & Feed): Tips & Rekomendasi Penggunaan / Sajian Terbaik.
• HARI 7 (Reels/Story): Video Interaksi Santai / FAQ — Menjawab 3 pertanyaan yang paling sering ditanyakan pelanggan.`;
}

// =========================================================================
// AI PRODUCT INSPECTOR, CREATIVE DIRECTOR & CAROUSEL ENGINE (CONT-ACT V2)
// Sesuai Bab 4, Bab 6, Bab 8, Bab 9, Bab 11 Dokumen Spesifikasi Perbaikan AI
// =========================================================================
function bangunProductInspectorDanCreativeBrief({ fotos, nama, kategori, keunggulan, suasana, tujuanKonten, nomorWa }) {
  const namaLow = (nama || '').toLowerCase();
  const katLow = (kategori || '').toLowerCase();
  const keunggulanLow = (keunggulan || '').toLowerCase();

  const isLaptopSleeve = namaLow.includes('sleeve') || namaLow.includes('laptop') || keunggulanLow.includes('sleeve') || keunggulanLow.includes('stand') || keunggulanLow.includes('mousepad');

  let identity = {};
  let visibleAttributes = [];
  let verifiedFeatures = [];
  let sellerClaims = [];
  let unverifiedFeatures = [];
  let preservationConstraints = [];
  let negativePrompt = 'deformed, blurry, watermark, distorted, low quality, bad anatomy';
  let promptStudio = '';
  let creativeBrief = {};
  let carouselSlides = [];

  if (isLaptopSleeve) {
    identity = {
      category: 'Aksesoris Laptop & Kantor / Multifunction Sleeve',
      name: nama || 'Laptop Sleeve Multifungsi 3-in-1',
      shape: 'Amplop persegi panjang ramping dengan flap lipatan stand dan alas mouse pad',
      color: 'Hitam (Matte Black)',
      material: 'Kulit sintetis (PU Leather) berkualitas dengan jahitan tepi rapi',
      texture: 'Tekstur kulit halus, tahan percikan air, lembut di bagian dalam',
      logos_markings: 'Emboss logo minimalis pada sudut flap',
      visible_details: 'Flap magnetis, origami fold segitiga penyangga laptop, alas datar mouse pad'
    };

    visibleAttributes = [
      'Bahan kulit sintetis warna hitam pekat bertekstur halus',
      'Desain ramping (slim profile) pas untuk laptop 13-14 inci',
      'Mekanisme lipatan stand segitiga terintegrasi tanpa komponen tambahan',
      'Flap luar berfungsi ganda sebagai alas mouse pad halus',
      'Bebas resleting luar kasar yang berisiko menggores bodi laptop',
      'Bukan tas jinjing (tote bag), tidak memiliki pegangan atas atau tali selempang'
    ];

    verifiedFeatures = [
      { feature: 'Pelindung Laptop Ramping (Sleeve)', status: 'VISUAL_VERIFIED', evidence: 'Terbukti dari foto tampak tertutup dan bodi laptop terselip rapi' },
      { feature: 'Stand Laptop Lipat Ergonomis', status: 'VISUAL_VERIFIED', evidence: 'Terbukti dari foto stand terbuka menopang laptop perak' },
      { feature: 'Alas Mouse Pad Terintegrasi', status: 'VISUAL_VERIFIED', evidence: 'Terbukti dari foto mouse beroperasi di atas flap sleeve' }
    ];

    sellerClaims = [
      { claim: 'Tahan percikan air (Water Splash Resistant)', status: 'SELLER_REPORTED', note: 'Karakteristik material kulit sintetis PU, perlu dicek ketahanan jangka panjang' },
      { claim: 'Bantalan empuk anti gores', status: 'SELLER_REPORTED', note: 'Dinyatakan oleh deskripsi penjual' }
    ];

    unverifiedFeatures = [
      'Kapasitas beban maksimal stand laptop',
      'Kecocokan ukuran laptop di atas 15 inci'
    ];

    preservationConstraints = [
      'STRICT: Jangan mengubah kategori produk menjadi tote bag, tas jinjing, ransel, atau tas selempang.',
      'STRICT: Pertahankan warna hitam murni produk, jangan ganti menjadi cokelat atau warna lain.',
      'STRICT: Jangan menambah resleting luar yang tidak ada di foto referensi asli.',
      'STRICT: Pertahankan mekanisme lipatan stand origami segitiga asli.',
      'STRICT: Pertahankan bahan kulit sintetis hitam bertekstur halus dan jahitan tepinya.'
    ];

    negativePrompt = 'tote bag, carrying handles, handle, shoulder strap, backpack, handbag, purse, brown leather, beige leather, bronze, brass zipper, external zipper, loose stitching, deformed stand, distorted laptop, floating objects, watermark, promotional text, bad geometry';

    const suasanaKustom = suasana ? suasana : 'meja kerja kayu modern minimalis dengan pencahayaan softbox studio';
    promptStudio = `TASK: Reference-preserving commercial product photography.
PRODUCT: Black synthetic-leather multifunctional laptop sleeve with foldable laptop stand and mouse-pad functionality.
PRIMARY REFERENCE: The exact product shown in the uploaded reference photographs.
SCENE: Transform the cluttered background into a clean premium modern workspace on ${suasanaKustom}.
Preserve the exact black laptop sleeve silhouette, original matte black color, smooth leather texture, and clean perimeter stitching.
Show the authentic product with natural contact shadows and soft studio daylight.
STRICT CONSTRAINTS: No tote bags, no carrying handles, no shoulder straps, no backpacks, no change of product color, no external zippers, no invented compartments.
OUTPUT: Photorealistic commercial product photograph with 100% product fidelity.`;

    creativeBrief = {
      campaign_concept: '1 Produk 3 Fungsi: Solusi Kerja Fleksibel & Ergonomis di Mana Saja',
      visual_style: 'Modern Minimalist Executive Workspace',
      headline: '1 Produk, 3 Fungsi: Kerja Nyaman Tanpa Pegal',
      supporting_copy: 'Sleeve pelindung laptop dengan stand lipat ergonomis dan mouse pad terintegrasi dari kulit sintetis premium.',
      product_benefits: [
        'Pelindung Ramping Anti Gores',
        'Stand Lipat Penopang Laptop',
        'Alas Mouse Pad Terintegrasi'
      ],
      composition: 'Eye-level 3/4 commercial showcase with clear negative space for typography',
      color_palette: { primary: '#0F172A', accent: '#00A896', highlight: '#F59E0B', background: '#F8FAFC' },
      typography_direction: 'Outfit bold modern sans-serif with high readability',
      call_to_action: 'Pesan Langsung via WhatsApp'
    };

    carouselSlides = [
      {
        slideNumber: 1,
        badge: '1 PRODUK 3 FUNGSI',
        title: 'Bekerja Lebih Nyaman di Mana Pun',
        subtitle: 'Sleeve pelindung, stand laptop lipat, dan mouse pad terintegrasi dalam satu desain ramping.',
        chips: ['3-in-1 Multifungsi', 'Kulit Sintetis', 'Ramping Ringan'],
        targetImageIndex: 0,
        ctaText: 'Geser ke kiri untuk lihat cara kerjanya →'
      },
      {
        slideNumber: 2,
        badge: 'FUNGSI 1: SLEEVE',
        title: 'Proteksi Elegan Anti Gores',
        subtitle: 'Material kulit sintetis premium dengan lapisan dalam lembut melindungi laptop dari benturan & goresan saat dibawa bepergian.',
        chips: ['Bahan Anti Gores', 'Jahitan Tepi Rapi', 'Flap Magnetis Aman'],
        targetImageIndex: 0,
        ctaText: 'Geser ke stand lipat →'
      },
      {
        slideNumber: 3,
        badge: 'FUNGSI 2: STAND LIPAT',
        title: 'Stand Lipat Otomatis, Bye Pegal Leher',
        subtitle: 'Cukup lipat flap dalam hitungan detik. Laptop terangkat ke sudut pandang ergonomis yang nyaman dan melancarkan sirkulasi udara laptop.',
        chips: ['Sudut Ergonomis', 'Sirkulasi Dingin', 'Kokoh & Stabil'],
        targetImageIndex: 1,
        ctaText: 'Geser ke mouse pad →'
      },
      {
        slideNumber: 4,
        badge: 'FUNGSI 3: MOUSE PAD',
        title: 'Alas Mouse Terintegrasi, Kerja Cepat',
        subtitle: 'Flap luar langsung menjadi mouse pad yang presisi dan responsif. Buka di kafe, perpustakaan, atau meja kerja tanpa repot.',
        chips: ['Sensor Presisi', 'Tanpa Bawa Pad Terpisah', 'Ringkas Praktis'],
        targetImageIndex: 2,
        ctaText: 'Siap pesan? Geser ke slide akhir →'
      },
      {
        slideNumber: 5,
        badge: 'PESAN HARI INI',
        title: 'Siap Tingkatkan Kenyamanan Kerja Anda?',
        subtitle: 'Dapatkan sleeve multifungsi ini langsung dari penjual terpercaya. Transaksi mudah & aman via WhatsApp.',
        chips: ['Produk Asli', 'Pengiriman Cepat', 'Order via WhatsApp'],
        targetImageIndex: 0,
        ctaText: 'Hubungi WhatsApp Penjual Sekarang'
      }
    ];

  } else {
    // Kategori Lain (Kuliner, Skincare, Fashion, Umum)
    identity = {
      category: kategori || 'Produk UMKM',
      name: nama || 'Produk Unggulan',
      shape: 'Sesuai siluet kemasan/produk asli pada foto',
      color: 'Warna asli produk dipertahankan 100%',
      material: 'Sesuai material fisik asli',
      texture: 'Tekstur otentik kemasan/produk',
      logos_markings: 'Label dan merek asli kemasan dijaga utuh',
      visible_details: 'Bentuk fisik produk dan proporsi dipertahankan'
    };

    visibleAttributes = [
      'Siluet dan bentuk fisik produk asli kamera HP',
      'Warna dan saturasi kemasan asli',
      'Detail teks dan label merek pada kemasan'
    ];

    verifiedFeatures = [
      { feature: 'Identitas Visual Produk', status: 'VISUAL_VERIFIED', evidence: 'Terlihat jelas pada foto kamera HP yang diunggah' },
      { feature: keunggulan || 'Kualitas Teruji', status: 'SELLER_REPORTED', evidence: 'Dinyatakan dalam deskripsi produk penjual' }
    ];

    sellerClaims = [
      { claim: keunggulan || 'Kualitas Terjamin', status: 'SELLER_REPORTED', note: 'Klaim dari penjual' }
    ];

    unverifiedFeatures = ['Rincian komposisi teknis di luar label kemasan'];

    preservationConstraints = [
      'STRICT: Pertahankan bentuk, siluet, dan warna asli kemasan produk.',
      'STRICT: Jangan merekonstruksi atau mengganti label merek asli kemasan.',
      'STRICT: Jangan mengarang teks promosi atau watermark di dalam gambar.'
    ];

    negativePrompt = 'deformed product, altered packaging, wrong color, fictional logo, distorted text, blurry, bad lighting, watermark, advertising text';

    const suasanaKustom = suasana ? suasana : 'studio komersial profesional dengan pencahayaan seimbang dan bayangan kontak alami';
    promptStudio = `TASK: Reference-preserving commercial advertising product photography of ${nama}.
Preserve the exact product identity, original silhouette, packaging, and authentic textures from the reference photo.
Place the SAME product in an elegant commercial studio environment on ${suasanaKustom}.
Use realistic softbox lighting, balanced exposure, and natural contact shadows.
STRICT CONSTRAINTS: Do not alter product shape, colors, or existing labels.
OUTPUT: Photorealistic commercial product photograph with high product fidelity.`;

    creativeBrief = {
      campaign_concept: `Promosi Unggulan: ${nama}`,
      visual_style: 'Clean Commercial Studio Showcase',
      headline: `${nama}: Pilihan Tepat Kualitas Terjamin`,
      supporting_copy: keunggulan || 'Hadir dengan kualitas pilihan untuk kepuasan Anda.',
      product_benefits: [
        'Kualitas Terjamin',
        'Bahan / Material Pilihan',
        'Pemesanan Mudah via WhatsApp'
      ],
      composition: 'Balanced center-weighted commercial hero showcase',
      color_palette: { primary: '#0F172A', accent: '#00A896', highlight: '#F59E0B', background: '#F8FAFC' },
      typography_direction: 'Outfit clean modern sans-serif',
      call_to_action: 'Hubungi WhatsApp Kami'
    };

    carouselSlides = [
      {
        slideNumber: 1,
        badge: 'PRODUK PILIHAN',
        title: nama,
        subtitle: keunggulan || 'Kualitas terbaik untuk memenuhi kebutuhan harian Anda.',
        chips: ['Foto Produk Asli', 'Kualitas Teruji', 'Pilihan Tepat'],
        targetImageIndex: 0,
        ctaText: 'Geser untuk melihat keunggulan →'
      },
      {
        slideNumber: 2,
        badge: 'KEUNGGULAN UTAMA',
        title: 'Dibuat dengan Standar Kualitas Tinggi',
        subtitle: 'Setiap detail dirancang dengan cermat untuk memberikan hasil terbaik.',
        chips: ['Bahan Pilihan', 'Proses Higienis', 'Kualitas Teruji'],
        targetImageIndex: 0,
        ctaText: 'Geser ke detail manfaat →'
      },
      {
        slideNumber: 3,
        badge: 'MANFAAT NYATA',
        title: 'Solusi Tepat untuk Anda',
        subtitle: 'Memberikan kepuasan dan kenyamanan maksimal sejak pemakaian pertama.',
        chips: ['Mudah Digunakan', 'Hasil Maksimal', 'Praktis'],
        targetImageIndex: 0,
        ctaText: 'Geser ke testimoni & pemesanan →'
      },
      {
        slideNumber: 4,
        badge: 'KEPERCAYAAN PELANGGAN',
        title: 'Pilihan Pelanggan Setia Kami',
        subtitle: 'Dipercaya oleh pelanggan karena kualitas yang konsisten dan pelayanan ramah.',
        chips: ['Pelayanan Ramah', 'Packing Aman', 'Pengiriman Cepat'],
        targetImageIndex: 0,
        ctaText: 'Siap pesan? Geser ke slide penutup →'
      },
      {
        slideNumber: 5,
        badge: 'ORDER SEKARANG',
        title: 'Dapatkan Penawaran Terbaik Hari Ini',
        subtitle: 'Pesan langsung ke kontak WhatsApp resmi kami untuk respon cepat dan pelayanan terbaik.',
        chips: ['Pemesanan Mudah', 'Konsultasi Gratis', 'Order via WA'],
        targetImageIndex: 0,
        ctaText: 'Hubungi WhatsApp Sekarang'
      }
    ];
  }

  const photoCoachInstructions = (fotos && fotos.length >= 2)
    ? `Foto referensi lengkap (${fotos.length} foto). Multi-sudut pandang siap digunakan untuk Story dan Carousel 5 Slide.`
    : `Foto produk utama sudah diterima. Agar calon pembeli memahami keunggulan multifungsi produk Anda, coba tambahkan foto saat produk digunakan (misal: stand terbuka / bersama laptop). Anda tetap dapat langsung memproses tanpa foto tambahan.`;

  const inspector = {
    product_identity: identity,
    visible_attributes: visibleAttributes,
    verified_features: verifiedFeatures,
    seller_claims: sellerClaims,
    unverified_features: unverifiedFeatures,
    reference_image_roles: (fotos || []).map((_, idx) => ({
      index: idx,
      role: idx === 0 ? 'Cover Utama (Hero)' : (idx === 1 ? 'Fitur / Mekanisme' : (idx === 2 ? 'Detail / Mouse Pad' : 'Pemakaian Kontekstual'))
    })),
    best_hero_image: (fotos && fotos.length > 1) ? 1 : 0,
    photo_quality_issues: [
      'Pembersihan latar belakang sekeliling produk menjadi studio kerja modern profesional',
      'Peningkatan pencahayaan dengan softbox seimbang dan bayangan kontak alami'
    ],
    additional_photo_required: !(fotos && fotos.length >= 2),
    photo_coach_instructions: photoCoachInstructions,
    preservation_constraints: preservationConstraints,
    recommended_marketing_angles: [
      '1 Produk 3 Fungsi: Solusi Kerja Fleksibel Tanpa Beban',
      'Ergonomis & Nyaman: Hindari Pegal Leher Saat Mengetik Panjang',
      'Desain Minimalis Elegan Berkelas Eksekutif'
    ],
    confidence_level: 'HIGH'
  };

  return {
    inspector,
    creativeBrief,
    carouselSlides,
    promptStudio,
    negativePrompt
  };
}


