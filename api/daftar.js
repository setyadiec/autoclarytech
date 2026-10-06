// Vercel Serverless Function: /api/daftar
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { namaToko, namaOwner, waOwner, kategori } = req.body || {};

    if (!namaToko || !waOwner) {
      return res.status(400).json({ status: 'error', message: 'Nama toko dan nomor WhatsApp wajib diisi' });
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
      status: 'pending_verifikasi'
    };

    // Forward ke webhook n8n jika aktif (non-blocking)
    try {
      const webhookUrl = 'http://100.113.198.75:5678/webhook/act-pendaftaran';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      }).catch(() => {});
      clearTimeout(timeoutId);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      message: 'Pendaftaran berhasil tercatat. Kuota 100 chat gratis siap diaktifkan.',
      data: payload
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
