// CONT-ACT V2 — pemilih model gambar + prompt preservasi + gerbang mutu (spek bab 6, 7, 12, 13). Bey, 20 Okt 2026.
// Dasar pemilihan: uji A/B 4 model fal.ai dengan foto sleeve Bapak (ab-model/hasil/_lembar_AB.jpg, log_*.json):
//   bawaan semua mode -> fal-ai/bytedance/seedream/v4/edit (putusan Bapak: tidak mengubah produk, tidak janggal; Test B paling setia, US$0,03)
//   cadangan 1x bila gerbang mutu FAIL -> fal-ai/flux-pro/kontext/max/multi (Test A paling setia, US$0,08)
// Modul ini TIDAK dipanggil sendiri; contact-generate.js memanggil pilihPipaGambar() lalu gerbangMutu() saat hasil selesai.

const FAL_QUEUE = 'https://queue.fal.run/';

export function pilihPipaGambar(jumlahFoto, cadangan = false) {
  // Putusan Bapak 20 Okt 09.32 setelah melihat uji A/B: hasil seedream = produk tidak berubah, tidak janggal -> seedream v4 edit jadi bawaan semua mode.
  // kontext max hanya CADANGAN (satu kali ulang bila gerbang mutu FAIL), supaya biaya terkendali.
  const mode = jumlahFoto >= 2 ? 'fungsi' : 'cleanup';
  if (cadangan) {
    return {
      kode: 'kontext_max_cadangan', mode, endpoint: FAL_QUEUE + 'fal-ai/flux-pro/kontext/max/multi', biayaUsd: 0.08,
      bangunBody: (prompt, fotos) => ({ prompt, image_urls: fotos.slice(0, 1), aspect_ratio: '1:1', num_images: 1, safety_tolerance: '5', output_format: 'jpeg' })
    };
  }
  return {
    kode: 'seedream_v4', mode, endpoint: FAL_QUEUE + 'fal-ai/bytedance/seedream/v4/edit', biayaUsd: 0.03,
    bangunBody: (prompt, fotos) => ({ prompt, image_urls: fotos.slice(0, 4), image_size: { width: 1024, height: 1024 }, num_images: 1 })
  };
}

const LARANGAN = 'No change of product category, color, shape, material, logo or proportions. No handles, straps, zippers, compartments, '
  + 'hinges or mechanisms that are not in the references. No other-brand objects. No advertising text, prices, badges, watermarks or fictional branding.';

// Prompt preservasi produk. Prompt BUKAN jaminan (spek bab 6) -> hasil tetap lewat gerbangMutu().
export function bangunPromptPreservasi({ nama, kategori, keunggulan, suasana, mode }) {
  const produk = String(nama || 'the product').slice(0, 100);
  const latar = String(suasana || '').trim().slice(0, 120);
  if (mode === 'fungsi') {
    return 'Authentic product-in-use commercial photography. Use ALL supplied photographs as the source of truth for ONE product: ' + produk + '. '
      + 'Create a premium lifestyle advertising photograph of the SAME product showing ONLY the functions demonstrated in the reference photographs, '
      + 'on a clean modern light-wood desk in a bright minimal room' + (latar ? ' (' + latar + ')' : '') + ', COMPLETELY replacing the original floor, clutter and background objects, professional soft daylight, natural shadows, three-quarter camera view, '
      + 'the product visually dominant with empty space for later typography. Keep the exact devices and accessories shown in the references. '
      + (keunggulan ? 'Seller-stated benefit (do not exaggerate): ' + String(keunggulan).slice(0, 160) + '. ' : '') + LARANGAN;
  }
  return 'Reference-preserving commercial product photography. Use the uploaded image as the authoritative visual reference for ' + produk + '. '
    + 'Preserve the EXACT physical product identity: original silhouette, color, material appearance, proportions, seams, edges and logos. '
    + 'Do NOT redesign, replace or invent a different product. Remove clutter and distracting background; place the SAME product in a premium clean '
    + (latar || 'light studio surface') + ' with soft softbox lighting, natural contact shadow, accurate textures and a believable camera angle consistent with the reference. '
    + 'Keep the product dominant with empty space around it for later typography. ' + LARANGAN
    + ' If the original product cannot be preserved reliably, prefer conservative background cleanup over reconstruction.';
}

const SYSTEM_GERBANG = 'You are a strict product-identity inspector for e-commerce ads. You get REFERENCE photos (the real product) followed by ONE candidate '
  + 'advertising photo. Decide if the candidate shows the SAME physical product as the references. Answer ONLY with JSON.';
const PROMPT_GERBANG = 'The first images are REFERENCE photos of the real product. The LAST image is the CANDIDATE. Return JSON with keys: '
  + 'same_category (bool), same_color (bool), same_shape_and_construction (bool), invented_parts (bool: handles, straps, zippers, extra compartments, extra mechanisms '
  + 'or fake logos not in the references), other_brand_objects (bool: true ONLY if an object appears whose brand/model/appearance is NOT visible in any reference; laptops, mice or phones that match the references are fine), background_clean (bool: true if the surface/room looks tidy and professional, ignoring harmless soft shadows), product_dominant (bool), verdict (PASS, REVIEW or FAIL), '
  + 'reasons (short Indonesian strings). FAIL if category, color, shape differ or parts are invented. REVIEW if only secondary objects differ. PASS otherwise.';

// Penilai pendukung (bukan bukti mutlak). Mengembalikan {verdict, reasons, ...}; galat jaringan -> REVIEW (tidak pernah PASS diam-diam).
export async function gerbangMutu(falKey, fotoRef, hasilUrl) {
  try {
    const r = await fetch('https://fal.run/fal-ai/any-llm/vision', {
      method: 'POST',
      headers: { 'Authorization': 'Key ' + String(falKey).trim(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', system_prompt: SYSTEM_GERBANG, prompt: PROMPT_GERBANG, image_urls: [...fotoRef.slice(0, 4), hasilUrl] }),
      signal: AbortSignal.timeout(45000)
    });
    if (!r.ok) return { verdict: 'REVIEW', reasons: ['penilai tidak tersedia (' + r.status + ')'] };
    const out = await r.json();
    let t = String(out.output || '').trim();
    t = t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1);
    const j = JSON.parse(t);
    if (!['PASS', 'REVIEW', 'FAIL'].includes(j.verdict)) j.verdict = 'REVIEW';
    // aturan keras di atas penilaian model: kategori/warna/bentuk beda atau bagian karangan = FAIL
    if (j.same_category === false || j.same_color === false || j.same_shape_and_construction === false || j.invented_parts === true) j.verdict = 'FAIL';
    return j;
  } catch (e) {
    return { verdict: 'REVIEW', reasons: ['penilai galat: ' + e.message] };
  }
}

// Kebijakan keluaran: PASS -> tampil; REVIEW -> tampil + catatan; FAIL -> JANGAN tampilkan hasil AI, pakai fallback foto asli (cleanup deterministik).
export function putusanTayang(verdict) {
  if (verdict === 'FAIL') return { tampilkanHasilAi: false, fallback: 'foto_asli_bersih', catatan: 'Hasil AI tidak setia pada produk, memakai foto asli.' };
  if (verdict === 'REVIEW') return { tampilkanHasilAi: true, fallback: null, catatan: 'Periksa kembali hasil: ada objek pendamping yang mungkin berbeda dari fotomu.' };
  return { tampilkanHasilAi: true, fallback: null, catatan: '' };
}
