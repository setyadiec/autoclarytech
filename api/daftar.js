// Vercel Serverless Function: /api/daftar
export default async function handler(req, res) {
  // CORS Headers (Valid tanpa Allow-Credentials saat Origin *)
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

  const { namaToko, namaOwner, waOwner, kategori } = req.body || {};

  if (!namaToko || !waOwner) {
    return res.status(400).json({
      status: 'error',
      message: 'Nama toko dan nomor WhatsApp wajib diisi'
    });
  }

  const payload = {
    id_pendaftaran: 'REG-' + Date.now(),
    waktu: new Date().toISOString(),
    nama_toko: String(namaToko).trim(),
    nama_owner: String(namaOwner || '').trim(),
    whatsapp: String(waOwner).trim(),
    kategori: String(kategori || 'Umum').trim(),
    kuota_gratis: 100,
    persetujuan_privasi: true,
    versi_kebijakan_pdp: '2026-10-06',
    sumber: 'web-daftar'
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
        'User-Agent': 'AutoClaryTech-Vercel-API/1.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!upstreamResp.ok) {
      let errMessage = 'Pendaftaran belum tercatat di sistem kami. Silakan hubungi kami langsung lewat WhatsApp di 0857-2724-0341.';
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
      console.error('Webhook upstream error:', upstreamResp.status, errDetail);
      const httpCode = (upstreamResp.status === 400 || upstreamResp.status === 422) ? upstreamResp.status : 502;
      return res.status(httpCode).json({
        status: 'error',
        message: errMessage,
        detail: errDetail
      });
    }

    const upstreamData = await upstreamResp.json().catch(() => ({}));

    return res.status(200).json({
      status: 'success',
      message: 'Pendaftaran berhasil tercatat secara resmi. Kuota 100 chat gratis siap diaktifkan.',
      data: payload,
      upstream: upstreamData
    });
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    console.error('Fetch error to funnel webhook:', error.message);
    return res.status(504).json({
      status: 'error',
      message: 'Pendaftaran belum tercatat di sistem kami. Silakan hubungi kami langsung lewat WhatsApp di 0857-2724-0341.',
      detail: isTimeout ? 'Koneksi ke peladen pendaftaran melebihi batas waktu (8 detik)' : error.message
    });
  }
}
