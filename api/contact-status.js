// Vercel Serverless Function: /api/contact-status
// Polling status antrean & hasil render fal.ai — arahan Bapak & Bey 18 Okt 2026

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return res.status(503).json({
      status: 'error',
      message: 'Kunci FAL_KEY belum dikonfigurasi di environment Vercel.'
    });
  }

  const queryOrBody = req.method === 'GET' ? req.query : req.body;
  const { statusUrl, responseUrl, requestId } = queryOrBody || {};

  // Susun URL status jika hanya requestId yang dikirimkan
  const targetStatusUrl = statusUrl || (requestId ? `https://queue.fal.run/fal-ai/flux-pro/kontext/requests/${requestId}/status` : null);
  const targetResponseUrl = responseUrl || (requestId ? `https://queue.fal.run/fal-ai/flux-pro/kontext/requests/${requestId}` : null);

  if (!targetStatusUrl) {
    return res.status(400).json({
      status: 'error',
      message: 'Parameter statusUrl atau requestId wajib disertakan.'
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const checkResp = await fetch(targetStatusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${FAL_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!checkResp.ok) {
      const errText = await checkResp.text();
      return res.status(checkResp.status).json({
        status: 'error',
        message: 'Gagal memeriksa status fal.ai: ' + checkResp.status,
        detail: errText
      });
    }

    const checkData = await checkResp.json();
    const rawStatus = (checkData.status || '').toUpperCase();

    if (rawStatus === 'COMPLETED') {
      // Ambil hasil gambar dari responseUrl
      let imageUrl = null;
      if (checkData.images && checkData.images[0] && checkData.images[0].url) {
        imageUrl = checkData.images[0].url;
      } else if (targetResponseUrl) {
        const respController = new AbortController();
        const respTimeout = setTimeout(() => respController.abort(), 10000);

        const resultResp = await fetch(targetResponseUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Key ${FAL_KEY.trim()}`,
            'Content-Type': 'application/json'
          },
          signal: respController.signal
        });
        clearTimeout(respTimeout);

        if (resultResp.ok) {
          const resultData = await resultResp.json();
          if (resultData.images && resultData.images[0] && resultData.images[0].url) {
            imageUrl = resultData.images[0].url;
          }
        }
      }

      if (imageUrl) {
        return res.status(200).json({
          status: 'completed',
          imageUrl: imageUrl,
          requestId: requestId || null
        });
      } else {
        return res.status(502).json({
          status: 'error',
          message: 'Status selesai namun URL gambar hasil tidak ditemukan dalam respons fal.ai.'
        });
      }

    } else if (rawStatus === 'IN_PROGRESS' || rawStatus === 'IN_QUEUE') {
      return res.status(200).json({
        status: 'in_progress',
        falStatus: rawStatus,
        queuePosition: checkData.queue_position !== undefined ? checkData.queue_position : null
      });

    } else {
      return res.status(200).json({
        status: 'pending',
        falStatus: rawStatus || 'WAITING'
      });
    }

  } catch (err) {
    console.error('Error contact-status:', err.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal polling status antrean AI: ' + err.message
    });
  }
}
