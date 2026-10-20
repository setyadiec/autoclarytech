import { gerbangMutu, putusanTayang } from './_model_router.js';
import { konfigDb, baca, ubah, terlaluSering } from './_akun.js';

// KEAMANAN (tinjauan 20 Okt 22.1x): (1) URL status/hasil WAJIB https://queue.fal.run/ (sebelumnya FAL_KEY dikirim ke alamat apa pun dari klien = pencurian kunci);
// (2) gerbang mutu berbayar hanya untuk pekerjaan yang DITERBITKAN server (tabel job_gambar), sekali per pekerjaan, hasilnya disimpan.
const urlFalAman = (u) => { try { const x = new URL(String(u)); return x.protocol === 'https:' && x.hostname === 'queue.fal.run' ? x.toString() : null; } catch (_) { return null; } };
const idSah = (r) => /^[0-9a-fA-F-]{8,64}$/.test(String(r || ''));

// Vercel Serverless Function: /api/contact-status
// Polling status antrean & hasil render Studio AI + Gerbang Mutu — arahan Bapak & Bey 18-20 Okt 2026

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.autoclarytech.com');
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

  const targetStatusUrl = urlFalAman(statusUrl);
  const targetResponseUrl = responseUrl ? urlFalAman(responseUrl) : null;
  if (!targetStatusUrl || (responseUrl && !targetResponseUrl) || !idSah(requestId)) {
    return res.status(400).json({ status: 'error', message: 'Parameter statusUrl/requestId tidak valid.' });
  }
  if (terlaluSering(req, 'status', 90, 1)) {
    return res.status(429).json({ status: 'error', message: 'Terlalu sering memeriksa status.' });
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
      return res.status(checkResp.status).json({
        status: 'error',
        message: 'Gagal memeriksa status antrean Studio AI: ' + checkResp.status
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
        // Evaluasi Gerbang Mutu LLM-Vision (Preservasi Produk): BERBAYAR -> hanya untuk pekerjaan sah, sekali per pekerjaan
        let daftarFotoRefs = [];
        if (queryOrBody.fotoRefs) {
          if (Array.isArray(queryOrBody.fotoRefs)) {
            daftarFotoRefs = queryOrBody.fotoRefs;
          } else if (typeof queryOrBody.fotoRefs === 'string') {
            try { daftarFotoRefs = JSON.parse(queryOrBody.fotoRefs); } catch (_) {}
          }
        }
        daftarFotoRefs = (Array.isArray(daftarFotoRefs) ? daftarFotoRefs : []).slice(0, 4)
          .filter((x) => typeof x === 'string' && x.length < 2500000 && (x.startsWith('data:image/') || x.startsWith('https://')));

        let evaluasiGerbang = null;
        let putusan = null;
        if (daftarFotoRefs.length > 0) {
          if (konfigDb().siap) {
            let job = null;
            try { job = (await baca('job_gambar?select=request_id,gerbang,putusan&request_id=eq.' + encodeURIComponent(requestId) + '&limit=1'))[0] || null; } catch (_) { job = null; }
            if (job && job.gerbang) {
              evaluasiGerbang = job.gerbang; putusan = job.putusan;                         // sudah dinilai: pakai hasil tersimpan (tanpa biaya)
            } else if (job) {
              evaluasiGerbang = await gerbangMutu(FAL_KEY, daftarFotoRefs, imageUrl);       // pekerjaan sah, belum dinilai -> sekali
              putusan = putusanTayang(evaluasiGerbang.verdict);
              try { await ubah('job_gambar?request_id=eq.' + encodeURIComponent(requestId), { gerbang: evaluasiGerbang, putusan }); } catch (_) {}
            }                                                                                // pekerjaan tak dikenal: TIDAK ada panggilan berbayar
          } else {
            evaluasiGerbang = await gerbangMutu(FAL_KEY, daftarFotoRefs, imageUrl);         // mode pengembangan tanpa database
            putusan = putusanTayang(evaluasiGerbang.verdict);
          }
        }

        return res.status(200).json({
          status: 'completed',
          imageUrl: imageUrl,
          requestId: requestId || null,
          gerbangMutu: evaluasiGerbang,
          putusanTayang: putusan
        });
      } else {
        return res.status(502).json({
          status: 'error',
          message: 'Status selesai namun URL gambar hasil tidak ditemukan dalam respons Studio AI.'
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
