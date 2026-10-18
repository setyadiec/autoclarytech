// Vercel Serverless Function: /api/contact-generate
// Arsitektur cont-ACT AI Awan (fal.ai) — Dhawuh Bapak & Bey 18 Okt 2026

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

// Penyimpanan kuota memori in-memory sederhana per instance serverless
// Ditambah validasi di sisi client untuk akurasi kuota 3x gratis
const kuotaClientMap = new Map();
let hitunganHarianGlobal = 0;
let tanggalHariIni = new Date().toISOString().slice(0, 10);

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
  const BATAS_GLOBAL_HARIAN = 100;
  if (hitunganHarianGlobal >= BATAS_GLOBAL_HARIAN) {
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

  // Cek Kuota Klien (3x Gratis)
  const clientKey = String(clientId || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'guest').slice(0, 80);
  const pemakaianSaatIni = kuotaClientMap.get(clientKey) || 0;
  const MAKS_KUOTA_GRATIS = 3;

  if (pemakaianSaatIni >= MAKS_KUOTA_GRATIS) {
    return res.status(403).json({
      status: 'quota_exceeded',
      message: 'Jatah 3x coba gratis Anda telah selesai digunakan. Selesaikan misi sosial media atau daftarkan antrean produksi kustom kagem membuka akses berikutnya.',
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

    // Catat pemakaian kuota setelah request queue sukses
    kuotaClientMap.set(clientKey, pemakaianSaatIni + 1);
    hitunganHarianGlobal += 1;
    const sisaKuota = Math.max(0, MAKS_KUOTA_GRATIS - (pemakaianSaatIni + 1));

    // Racik Naskah Copywriting Jualan Terstruktur & 10 Tagar Relevan
    const { caption, hashtags } = racikNaskah(namaBersih, kategoriBersih, keunggulanBersih);

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

// Helper peracik copywriting jualan profesional formula Hook Menarik + Manfaat + CTA
function racikNaskah(nama, kategori, keunggulan) {
  let caption = '';
  let hashtags = '';

  if (kategori === 'kuliner') {
    caption = `Pilihan tepat untuk penikmat kuliner berkualitas. ${nama} hadir dengan cita rasa istimewa.\n\nDibuat dari bahan-bahan pilihan bermutu tinggi, ${keunggulan}. Sangat pas untuk menemani waktu kerja, santai bersama keluarga, maupun suguhan istimewa.\n\nPenawaran Terbatas Hari Ini:\nDapatkan harga promo khusus pemesanan sekarang. Silakan klik tautan di bio untuk informasi dan pemesanan.`;
    hashtags = `#kulinerindonesia #kulineran #cemilanenak #makananviral #jajanankekinian #racuntiktok #fypkuliner #foodies #enakbanget #reelskuliner`;
  } else if (kategori === 'skincare') {
    caption = `Rawat kesehatan kulit wajah Anda dengan perawatan yang tepat. Memperkenalkan ${nama}.\n\nDiformulasikan khusus untuk ${keunggulan}. Formulanya ringan di kulit, nyaman digunakan secara rutin, serta membantu menjaga kesegaran alami wajah.\n\nPromo Khusus Hari Ini:\nDapatkan penawaran istimewa untuk pembelian pekan ini. Silakan kunjungi tautan di profil sebelum masa promo berakhir.`;
    hashtags = `#skincareroutine #racunskincare #kulitglowing #skincarebpom #beautytips #fypindonesia #viralreels #cantikalami #perawatanwajah #racuntiktok`;
  } else if (kategori === 'fashion') {
    caption = `Tampil percaya diri dengan busana yang nyaman dan elegan: ${nama}.\n\nDirancang menggunakan material berkualitas yang jatuh rapi di badan. ${keunggulan}. Pilihan serasi baik untuk agenda formal maupun kegiatan santai harian.\n\nPersediaan Terbatas:\nAmankan ukuran dan varian pilihan Anda sekarang juga melalui tautan di profil.`;
    hashtags = `#ootdindonesia #fashionviral #outfitharian #racuntiktok #bajubagus #hijabstyle #reelsfashion #fypoutfit #racunshopee #styleinspo`;
  } else if (kategori === 'herbal') {
    caption = `Kesehatan adalah investasi terbaik untuk masa depan keluarga. Jaga stamina harian dengan ${nama}.\n\nKhasiat alami murni untuk mendukung daya tahan tubuh secara optimal. ${keunggulan}. Tanpa bahan tambahan yang merugikan, aman untuk konsumsi harian.\n\nPemesanan & Konsultasi:\nHubungi kami melalui tautan di profil untuk mendapatkan produk asli bergaransi.`;
    hashtags = `#hidupsehat #herbalalami #kesehatantubuh #suplemenalami #madumurni #tipssehat #herbalindonesia #fypkesehatan #sehatberkah #racunsehat`;
  } else {
    caption = `Solusi fungsional untuk menunjang aktivitas harian Anda: ${nama}.\n\nKualitas teruji, andal, dan ${keunggulan}. Dibuat secara presisi untuk memberikan kemudahan serta efisiensi maksimal.\n\nPromo Perdana:\nDapatkan penawaran harga terbaik khusus hari ini dengan mengunjungi tautan di profil.`;
    hashtags = `#produkviral #racuntiktok #barangunik #solusicerdas #fypindonesia #viralhariini #tokoonline #belanjaonline #murahberkualitas #trendingreels`;
  }

  return { caption, hashtags };
}
