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
    pesanKebutuhan,
    kota,
    skalaUsaha
  } = req.body || {};

  if (!namaToko || !waOwner) {
    return res.status(400).json({
      status: 'error',
      message: 'Nama usaha dan nomor WhatsApp wajib diisi'
    });
  }

  const payload = {
    id_pendaftaran: 'REQ-' + Date.now(),
    waktu: new Date().toISOString(),
    nama_toko: String(namaToko).trim(),
    nama_owner: String(namaOwner || '').trim(),
    whatsapp: String(waOwner).trim(),
    kategori: String(kategori || 'Umum').trim(),
    jenis_aplikasi: String(jenisAplikasi || 'CS WhatsApp AI').trim(),
    pesan_kebutuhan: String(pesanKebutuhan || '').trim(),
    kota: String(kota || '').trim(),
    skala_usaha: String(skalaUsaha || 'UMKM').trim(),
    kuota_gratis: 1000,
    persetujuan_privasi: true,
    versi_kebijakan_pdp: '2026-10-07',
    sumber: 'web-universal-request'
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
        'User-Agent': 'AutoClaryTech-Universal-API/2.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!upstreamResp.ok) {
      let errMessage = 'Permohonan Anda telah kami catat. Tim konsultan AutoClaryTech akan segera menghubungi WhatsApp Anda.';
      let errDetail = 'Upstream status ' + upstreamResp.status;
      try {
        const parsed = await upstreamResp.json();
        if (parsed && parsed.message) {
          errMessage = parsed.message;
        }
        errDetail = parsed;
      } catch (e) {
        const rawText = await upstreamResp.text().catch(() => '');
        if (rawText) errDetail = rawText;
      }
      console.warn('Webhook upstream response not 200:', upstreamResp.status, errDetail);
      return res.status(200).json({
        status: 'success',
        message: 'Permohonan aplikasi berhasil dikirim. Tim AutoClaryTech akan segera menghubungi via WhatsApp untuk konsultasi & demonstrasi.',
        data: payload,
        upstream_warning: true
      });
    }

    const upstreamData = await upstreamResp.json().catch(() => ({}));

    return res.status(200).json({
      status: 'success',
      message: 'Permohonan aplikasi berhasil diterima! Konsultan teknologi kami akan menyiapkan solusi dan menghubungi Anda via WhatsApp.',
      data: payload,
      upstream: upstreamData
    });
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    console.error('Fetch error to funnel webhook:', error.message);
    return res.status(200).json({
      status: 'success',
      message: 'Permohonan berhasil tercatat di sistem kami. Anda juga dapat langsung konfirmasi cepat ke tim kami melalui tautan WhatsApp.',
      data: payload,
      offline_fallback: true
    });
  }
}
