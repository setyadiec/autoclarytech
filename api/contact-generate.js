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
    tujuanKonten,
    nomorWa,
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
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1');
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
  const tujuanBersih = String(tujuanKonten || 'hard_sell').trim();
  const waBersih = formatNomorWa(nomorWa);

  // Pemetaan prompt foto studio komersial per suasana (Model fal-ai/flux-pro/kontext)
  let promptStudio = '';
  if (suasana === 'kafe_kayu') {
    promptStudio = `High-end commercial advertising food photography of ${namaBersih}, placed neatly on a rustic warm solid wooden dining table with visible natural dark wood grain and rich organic timber texture. Cozy warm ambient cafe morning lighting, gentle natural contact shadows, soft warm rim light, blurred cozy cafe background with warm bokeh, sharp focus on product packaging and details, photorealistic 8k, authentic culinary commercial presentation`;
  } else if (suasana === 'marmer_mewah') {
    promptStudio = `High-end commercial advertising studio photography of ${namaBersih}, placed neatly on a luxury polished dark marble countertop with subtle natural stone veining. Dramatic warm spotlighting, subtle clean reflections, clean minimalist studio background, sharp focus on product packaging, photorealistic 8k, prestigious commercial showcase`;
  } else if (suasana === 'alami_botanical') {
    promptStudio = `High-end commercial advertising studio photography of ${namaBersih}, placed neatly on a natural light bamboo or light wooden surface surrounded by fresh green tropical leaves and organic botanical accents. Soft natural morning daylight, gentle shadows, fresh vibrant organic atmosphere, sharp focus on product details, photorealistic 8k, clean eco-friendly commercial aesthetic`;
  } else if (suasana === 'pastel_modern') {
    promptStudio = `High-end commercial advertising studio photography of ${namaBersih}, placed neatly on a sleek modern pastel podium with contemporary minimalist studio setting. Soft diffused studio lighting, gentle geometric shadows, clean elegant pastel aesthetic, sharp focus on product details, photorealistic 8k, modern commercial presentation`;
  } else if (suasana && typeof suasana === 'string' && suasana.trim().length > 3) {
    promptStudio = `High-end commercial advertising studio photography of ${namaBersih}, placed neatly on ${suasana.trim().slice(0, 200)}. Natural contact shadows, soft ambient warm rim lighting, sharp focus on packaging details, photorealistic 8k, authentic commercial presentation`;
  } else {
    promptStudio = `High-end commercial advertising studio photography of ${namaBersih}, placed neatly on a luxury polished dark marble counter with dramatic warm spotlighting. Natural contact shadows, sharp focus on packaging details, photorealistic 8k, authentic commercial presentation`;
  }

  // Kunci API fal.ai dari Environment Serverless Vercel
  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    // Mode Jujur: Laporkan bila kunci FAL_KEY di serverless Vercel belum disematkan oleh Bapak
    return res.status(503).json({
      status: 'key_pending',
      message: 'Layanan AI Awan cont-ACT sedang dalam sinkronisasi kredensial Vercel (FAL_KEY). Mohon hubungi admin atau gunakan simulator visual.'
    });
  }

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

    // Racik Paket Konten Kreator 360 Derajat (Caption, Video Script, Status WA, Rencana 7 Hari, 10 Tagar) via LLM Awan fal.ai
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
      sisaKuota: sisaKuota,
      caption: paketKonten.caption,
      videoScript: paketKonten.videoScript,
      waStatus: paketKonten.waStatus,
      ideKonten7Hari: paketKonten.ideKonten7Hari,
      hashtags: paketKonten.hashtags,
      linkWa: linkWa
    });

  } catch (err) {
    console.error('Error contact-generate:', err.message);
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

// Integrasi LLM Awan fal.ai (fal-ai/any-llm) untuk copywriting presisi & 10 tagar relevan
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

Tugas: Buat 5 Aset Konten Kreator Siap Pakai:
1. CAPTION FEED (Instagram/Facebook): Hook memikat pembuka, elaborasi manfaat produk yang menyentuh kebutuhan konsumen secara jujur berdasarkan data keunggulan di atas, dan Call to Action pemesanan yang jelas.
2. SKRIP VIDEO REELS & TIKTOK (15–30 Detik):
   - Hook 3 Detik (Teks di layar & narasi pembuka yang menghentikan scroll)
   - Panduan Visual B-roll Kamera HP (adegan yang harus direkam)
   - Narasi Voiceover
   - CTA Penutup
3. STATUS WHATSAPP (Story / Chat Broadcast): Teks ringkas, ramah, mengundang calon pembeli membalas chat secara spontan.
   [ATURAN KERAS STATUS WA]:
   - DILARANG mengarang promo, diskon, harga potongan, atau klaim stok terbatas fiktif (seperti "lagi ada promo terbatas hari ini aja", "diskon 50%", "stok tinggal 5") KECUALI jika secara eksplisit tertulis di data keunggulan produk.
   - HANYA ceritakan fakta produk, kualitas rasa/bahan, dan keunggulan nyata dari data klien.
4. RENCANA KONTEN 7 HARI: Ide posting tematik Hari 1 s.d. Hari 7 (kombinasi Reels, Feed, dan Story) agar pemilik usaha konsisten jualan selama seminggu penuh.
5. HASHTAGS: Tepat 10 tagar relevan, tertarget, dan populer.
   [ATURAN KERAS HASHTAGS]:
   - WAJIB TEPAT 10 TAGAR murni berawalan tanda #.
   - DILARANG menyertakan nama kota apa pun (seperti #KulinerBandung, #KulinerJakarta, dll).
   - DILARANG menambahkan teks penjelasan, saran, atau tanda kurung apa pun (seperti "(ganti kota jika perlu)").
   - HANYA keluarkan 10 tagar murni dipisahkan spasi tunggal.

Format keluaran WAJIB persis seperti ini (tanpa basa-basi pembuka):
===CAPTION===
[Teks caption feed lengkap di sini, gunakan emoji yang memikat]

===VIDEOSCRIPT===
[Teks skrip video lengkap dengan pembagian Hook 3 Detik, Panduan Visual B-roll, Narasi Suara, dan CTA Penutup]

===WASTATUS===
[Teks status WhatsApp ringkas dan ramah tanpa klaim promo karangan]

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

      // Sanitasi ketat keluaran LLM
      const hashtagsBersih = bersihkanHashtags(hashtags, kategori);
      const waStatusBersih = bersihkanWaStatus(waStatus, nama, keunggulan, nomorWa);

      if (caption && hashtagsBersih) {
        return {
          caption,
          videoScript: videoScript || racikVideoScriptFallback(nama, kategori, keunggulan, tujuanKonten, nomorWa),
          waStatus: waStatusBersih,
          ideKonten7Hari: ideKonten7Hari || racikIde7HariFallback(nama, kategori),
          hashtags: hashtagsBersih
        };
      }
    }
  } catch (err) {
    console.warn('Fallback LLM awan:', err.message);
  }

  // Fallback cerdas jika LLM awan timeout
  return racikPaketKontenFallback(nama, kategori, keunggulan, tujuanKonten, nomorWa);
}

// Sanitasi Hashtag: Menjamin tepat 10 tagar murni tanpa nama kota & tanpa tanda kurung
function bersihkanHashtags(rawHashtags, kategori) {
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

  // 4. Cadangan tagar murni per kategori (bebas kota)
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

// Sanitasi Status WA: Membersihkan klaim promo fiktif jika tidak ada di input klien
function bersihkanWaStatus(waRaw, nama, keunggulan, nomorWa) {
  if (!waRaw || typeof waRaw !== 'string') return racikWaStatusFallback(nama, '', keunggulan, nomorWa);
  let hasil = waRaw
    .replace(/Lagi ada promo TERBATAS hari ini aja lho!?/gi, '')
    .replace(/Promo terbatas hari ini aja lho!?/gi, '')
    .replace(/Promo terbatas hari ini!?/gi, '')
    .replace(/Slot hari ini terbatas hanya \d+ porsi/gi, 'Siap dipesan untuk Anda')
    .trim();
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
      `• Suara/Voiceover: "Dapatkan produk original sekarang juga. ${ctaWa}"`;
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


