// Vercel Serverless Function: /api/daftar
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  const {
    namaToko,
    namaOwner,
    waOwner,
    kategori,
    jenisAplikasi,
    kota,
    skalaUsaha,
    // Parameter Spesifikasi Custom App (Wizard 7 Layar)
    masalahUtama,
    alurTransaksi,
    kondisiSaatIni,
    dataDicatat,
    aturanHitung,
    penggunaSistem,
    perangkatPakai,
    dokumenKeluaran,
    integrasiWajib,
    fiturPrioritas,
    rentangAnggaran,
    jadwalKonsultasi
  } = req.body || {};

  if (!namaToko || !waOwner) {
    return res.status(400).json({
      status: 'error',
      message: 'Nama usaha dan nomor WhatsApp wajib diisi'
    });
  }

  const isCustomApp = String(jenisAplikasi || '').includes('Kustom') || String(jenisAplikasi || '').includes('Request Baru');

  const payload = {
    id_pendaftaran: (isCustomApp ? 'CUST-' : 'REG-') + Date.now(),
    waktu: new Date().toISOString(),
    nama_toko: String(namaToko).trim(),
    nama_owner: String(namaOwner || '').trim(),
    whatsapp: String(waOwner).trim(),
    kategori: String(kategori || 'Umum').trim(),
    jenis_aplikasi: String(jenisAplikasi || 'CS WhatsApp AI').trim(),
    kota: String(kota || '').trim(),
    skala_usaha: String(skalaUsaha || 'UMKM').trim(),
    kuota_gratis: 1000,
    persetujuan_privasi: true,
    skema_termin: 'Ya kami segera memproses permintaan Anda setelah masuk pembayaran uang muka, dan pelunasan setelah aplikasi jadi. Sedangkan biaya langganan akan kami kenakan mulai bulan berikutnya',
    // Rincian Spesifikasi bila Custom App
    spesifikasi_kustom: isCustomApp ? {
      masalah_utama: String(masalahUtama || ''),
      alur_transaksi: String(alurTransaksi || ''),
      kondisi_saat_ini: String(kondisiSaatIni || ''),
      data_dicatat: Array.isArray(dataDicatat) ? dataDicatat : [String(dataDicatat || '')],
      aturan_hitung: String(aturanHitung || ''),
      pengguna_sistem: Array.isArray(penggunaSistem) ? penggunaSistem : [String(penggunaSistem || '')],
      perangkat_pakai: String(perangkatPakai || ''),
      dokumen_keluaran: Array.isArray(dokumenKeluaran) ? dokumenKeluaran : [String(dokumenKeluaran || '')],
      integrasi_wajib: Array.isArray(integrasiWajib) ? integrasiWajib : [String(integrasiWajib || '')],
      fitur_prioritas: String(fiturPrioritas || ''),
      rentang_anggaran: String(rentangAnggaran || 'Butuh Diskusi Estimasi'),
      jadwal_konsultasi: String(jadwalKonsultasi || 'Fleksibel')
    } : null,
    versi_kebijakan_pdp: '2026-10-07',
    sumber: isCustomApp ? 'web-wizard-custom-app' : 'web-standard-app'
  };

  // Kirim ke n8n webhook publik via Tailscale Funnel
  const FUNNEL_WEBHOOK_URL = 'https://bey-pc.tail594b32.ts.net/webhook/act-pendaftaran';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const upstreamResp = await fetch(FUNNEL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AutoClaryTech-Universal-API/2.1'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // Jujur: sukses HANYA bila penampung menjawab ok (penampung menjawab 200 bila tersimpan, 422 bila tidak).
    let hasilHulu = null;
    try { hasilHulu = await upstreamResp.json(); } catch (_) { hasilHulu = null; }
    if (!upstreamResp.ok || !hasilHulu || hasilHulu.status !== 'ok') {
      console.error('Penampung menolak/gagal:', upstreamResp.status);
      return res.status(502).json({
        status: 'error',
        message: 'Permohonan belum tersimpan di sistem kami. Mohon kirim lewat tombol WhatsApp.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: isCustomApp 
        ? 'Permohonan rancang bangun aplikasi kustom Anda telah kami terima secara lengkap. Tim konsultan AutoClaryTech akan meninjau dan menghubungi WhatsApp Anda untuk jadwal demonstrasi.'
        : 'Permohonan aplikasi berhasil diterima! Konsultan teknologi kami akan menyiapkan solusi dan menghubungi Anda via WhatsApp.',
      data: payload
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Fetch error to funnel webhook:', error.message);
    return res.status(502).json({
      status: 'error',
      message: 'Permohonan belum tersimpan di sistem kami. Mohon kirim lewat tombol WhatsApp.',
      offline_fallback: true
    });
  }
}
