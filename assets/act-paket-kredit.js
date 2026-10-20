/**
 * act-paket-kredit.js — Komponen Modal Paket Kredit & Langganan Berjenjang cont-ACT
 * Sinergi Trio Agen (Bapak, Mas Bey, Vity) — Terhubung Gateway Duitku & Transfer BRI
 */

(function () {
  'use strict';

  const DAFTAR_PAKET = {
    // 1. Paket Beli Putus (Sekali Bayar, Masa Aktif 60 Hari)
    kredit: [
      {
        id: 'coba',
        nama: 'Paket Coba',
        kredit: 5,
        harga: 9900,
        teksHarga: 'Rp9.900',
        satuan: '5 Kredit (~Rp1.980/iklan)',
        badge: 'Coba UMKM',
        badgeClass: '',
        fitur: [
          '5x Pembuatan Materi Iklan',
          'Poster Feed & WhatsApp Status',
          'Copywriting & Headline Otomatis',
          'Masa Aktif Kuota 60 Hari'
        ]
      },
      {
        id: 'hemat',
        nama: 'Paket Hemat',
        kredit: 15,
        harga: 24900,
        teksHarga: 'Rp24.900',
        satuan: '15 Kredit (~Rp1.660/iklan)',
        badge: 'Paling Populer',
        badgeClass: 'gold',
        terpilih: true,
        fitur: [
          '15x Pembuatan Materi Iklan',
          'Semua Rasio (Feed, Story, Persegi)',
          'Kartu Bukti Foto Asli Terverifikasi',
          'Masa Aktif Kuota 60 Hari'
        ]
      },
      {
        id: 'juragan',
        nama: 'Paket Juragan',
        kredit: 40,
        harga: 59900,
        teksHarga: 'Rp59.900',
        satuan: '40 Kredit (~Rp1.497/iklan)',
        badge: 'Paling Hemat',
        badgeClass: '',
        fitur: [
          '40x Pembuatan Materi Iklan',
          'Prioritas Jalur Antrean Cepat',
          'Bebas Simpan Semua Variasi Desain',
          'Masa Aktif Kuota 60 Hari'
        ]
      }
    ],

    // 2. Paket Langganan (Fitur Tambahan Eksklusif)
    langganan: [
      {
        id: 'mingguan',
        nama: 'Mingguan Aktif',
        kredit: 35,
        harga: 59900,
        teksHarga: 'Rp59.900',
        satuan: 'per minggu (35 kredit / ~Rp1.711 per iklan)',
        badge: 'Mingguan',
        badgeClass: '',
        fitur: [
          '35 Kredit Iklan Setiap Minggu (5x sehari)',
          'Akses Semua 4 Rasio Komplit',
          'Carousel Instagram 5 Slide Siap Posting',
          'Tanpa Watermark / Tanda Kanal'
        ]
      },
      {
        id: 'bulanan',
        nama: 'Bulanan Bisnis',
        kredit: 140,
        harga: 179900,
        teksHarga: 'Rp179.900',
        satuan: 'per bulan (140 kredit / ~Rp1.285 per iklan)',
        badge: 'Hemat 1 Minggu Gratis',
        badgeClass: 'gold',
        terpilih: true,
        fitur: [
          '140 Kredit Iklan Setiap Bulan (4-5x sehari)',
          'Bonus Penghematan Setara 1 Minggu Gratis!',
          'Carousel 5 Slide Siap Posting',
          'Simpan Profil Merek & Logo Toko Sendiri',
          'Prioritas Antrean Kilat Server',
          'Diskon 20% Pembuatan Video Reels'
        ]
      }
    ]
  };

  let paketTerpilih = DAFTAR_PAKET.kredit[1]; // default Paket Hemat
  let tabAktif = 'kredit';

  function inisialisasiModalPaket() {
    if (document.getElementById('modal-paket-kredit')) return;

    const modalHtml = `
      <div id="modal-paket-kredit" class="modal-paket-overlay" role="dialog" aria-modal="true" aria-labelledby="judul-modal-paket">
        <div class="modal-paket-card">
          <button type="button" class="modal-paket-tutup" onclick="window.tutupModalPaketKredit()" aria-label="Tutup">&times;</button>
          
          <div style="font:800 20px var(--f-judul); color:#F8FAFC; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
            <svg style="width:22px; height:22px; stroke:#00D2B4; fill:none; stroke-width:2;" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span id="judul-modal-paket">Pilih Paket cont-ACT</span>
          </div>
          <p style="font-size:12.5px; color:#94A3B8; margin:0 0 12px; line-height:1.5;">
            Tingkatkan omset UMKM Anda dengan materi iklan profesional. Beli putus tanpa langganan kartu kredit, bayar instan via QRIS.
          </p>

          <!-- Tab Switcher -->
          <div class="paket-tab-switcher">
            <button type="button" id="tab-btn-kredit" class="paket-tab-btn aktif" onclick="window.gantiTabPaket('kredit')">
              <svg style="width:16px; height:16px; stroke:currentColor; fill:none; stroke-width:2;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path></svg>
              <span>Beli Putus (Kredit)</span>
            </button>
            <button type="button" id="tab-btn-langganan" class="paket-tab-btn" onclick="window.gantiTabPaket('langganan')">
              <svg style="width:16px; height:16px; stroke:currentColor; fill:none; stroke-width:2;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              <span>Langganan (Fitur Lengkap)</span>
            </button>
          </div>

          <!-- Container Kartu Paket -->
          <div id="container-grid-paket" class="grid-paket-kartu"></div>

          <!-- Form Identitas Pembeli -->
          <div class="box-form-checkout">
            <label for="input-wa-checkout" style="display:block; font-size:12px; font-weight:700; color:#F8FAFC; margin-bottom:6px;">
              Nomor WhatsApp Anda (untuk pengiriman bukti & saldo kuota):
            </label>
            <input type="tel" id="input-wa-checkout" class="input-wa-checkout" placeholder="Contoh: 08123456789 atau 62812..." autocomplete="tel">
            <div id="error-wa-checkout" style="display:none; color:#EF4444; font-size:11px; margin-top:4px; font-weight:600;">Mohon masukkan nomor WhatsApp yang benar untuk verifikasi pesanan.</div>
          </div>

          <!-- Pesan Status Modal (Pengganti alert) -->
          <div id="pesan-status-modal" style="display:none; margin-bottom:12px; padding:10px 14px; border-radius:8px; font-size:12px; line-height:1.45;"></div>

          <!-- Tombol Bayar Instan (Duitku) -->
          <button type="button" id="btn-bayar-duitku" class="btn-bayar-instan" onclick="window.eksekusiCheckoutPaket()">
            <svg style="width:18px; height:18px; stroke:currentColor; fill:none; stroke-width:2;" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
            <span id="label-btn-bayar">Bayar Instan QRIS / e-Wallet (Rp24.900)</span>
          </button>

          <!-- Opsi Transfer Manual Bank BRI -->
          <div style="margin-top:14px; text-align:center;">
            <button type="button" onclick="window.tampilkanTransferManualBri()" style="background:none; border:none; color:#94A3B8; font-size:11.5px; text-decoration:underline; cursor:pointer;">
              Atau transfer manual ke Rekening Bank BRI (Artareksa)
            </button>
          </div>

          <!-- Box Detail Transfer Manual (Tersembunyi Awal) -->
          <div id="box-transfer-manual-bri" style="display:none; margin-top:14px; background:#0F172A; border:1px solid #1E293B; border-radius:10px; padding:12px; font-size:11.5px; text-align:left;">
            <div style="font-weight:700; color:#38BDF8; margin-bottom:4px;">Rekening Bank BRI KC Temanggung:</div>
            <div style="font-family:var(--f-mono); font-size:13px; font-weight:800; color:#F8FAFC; margin-bottom:4px;">0102-01-032414-53-6</div>
            <div style="color:#94A3B8; margin-bottom:8px;">Atas Nama: <strong>ARTAREKSA TEKNOLOGI EKONOMI</strong></div>
            <div style="color:#CBD5E1; line-height:1.5;">Setelah transfer, kirimkan bukti ke WhatsApp: <strong>0857-2724-0341</strong> untuk pengisian kredit manual.</div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    renderGridPaket();
  }

  function renderGridPaket() {
    const container = document.getElementById('container-grid-paket');
    if (!container) return;

    const list = DAFTAR_PAKET[tabAktif] || [];
    container.innerHTML = list.map(item => {
      const isSelected = item.id === paketTerpilih.id;
      return `
        <div class="kartu-paket-item ${isSelected ? 'terpilih' : ''}" onclick="window.pilihPaketById('${item.id}')">
          ${item.badge ? `<div class="kartu-paket-badge ${item.badgeClass}">${item.badge}</div>` : ''}
          <div>
            <div class="kartu-paket-nama">${item.nama}</div>
            <div class="kartu-paket-harga">${item.teksHarga}</div>
            <div class="kartu-paket-satuan">${item.satuan}</div>
            <ul class="kartu-paket-fitur">
              ${item.fitur.map(f => `
                <li>
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>${f}</span>
                </li>
              `).join('')}
            </ul>
          </div>
          <button type="button" style="width:100%; padding:6px; border-radius:6px; border:1px solid ${isSelected ? '#00D2B4' : '#475569'}; background:${isSelected ? '#00D2B4' : 'transparent'}; color:${isSelected ? '#0F172A' : '#CBD5E1'}; font-weight:700; font-size:11px; cursor:pointer;">
            ${isSelected ? '✓ Terpilih' : 'Pilih Paket'}
          </button>
        </div>
      `;
    }).join('');

    perbaruiLabelTombolBayar();
  }

  function perbaruiLabelTombolBayar() {
    const el = document.getElementById('label-btn-bayar');
    if (el && paketTerpilih) {
      el.textContent = `Bayar Instan QRIS / e-Wallet (${paketTerpilih.teksHarga})`;
    }
  }

  window.gantiTabPaket = function (tab) {
    tabAktif = tab;
    document.getElementById('tab-btn-kredit')?.classList.toggle('aktif', tab === 'kredit');
    document.getElementById('tab-btn-langganan')?.classList.toggle('aktif', tab === 'langganan');
    
    // Pilih paket default tab
    const list = DAFTAR_PAKET[tabAktif] || [];
    paketTerpilih = list.find(p => p.terpilih) || list[0];
    renderGridPaket();
  };

  window.pilihPaketById = function (id) {
    const list = DAFTAR_PAKET[tabAktif] || [];
    const target = list.find(p => p.id === id);
    if (target) {
      paketTerpilih = target;
      renderGridPaket();
    }
  };

  window.bukaModalPaketKredit = function (paketIdAwal) {
    inisialisasiModalPaket();
    if (paketIdAwal) {
      for (const t of ['kredit', 'langganan']) {
        const found = DAFTAR_PAKET[t].find(p => p.id === paketIdAwal);
        if (found) {
          tabAktif = t;
          paketTerpilih = found;
          document.getElementById('tab-btn-kredit')?.classList.toggle('aktif', t === 'kredit');
          document.getElementById('tab-btn-langganan')?.classList.toggle('aktif', t === 'langganan');
          renderGridPaket();
          break;
        }
      }
    }
    
    // Auto-prefill nomor WA dari input form utama jika ada
    const waUtama = document.getElementById('gen-nomor-wa')?.value?.trim();
    const inputWaCheckout = document.getElementById('input-wa-checkout');
    if (inputWaCheckout && waUtama && !inputWaCheckout.value) {
      inputWaCheckout.value = waUtama;
    }

    const modal = document.getElementById('modal-paket-kredit');
    if (modal) {
      modal.classList.add('aktif');
      document.body.style.overflow = 'hidden';
    }
  };

  window.tutupModalPaketKredit = function () {
    const modal = document.getElementById('modal-paket-kredit');
    if (modal) {
      modal.classList.remove('aktif');
      document.body.style.overflow = '';
    }
    sembunyikanPesanModal();
  };

  function tampilkanPesanModal(teks, tipe = 'info') {
    const el = document.getElementById('pesan-status-modal');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = teks;
    if (tipe === 'sukses') {
      el.style.background = '#064E3B';
      el.style.border = '1px solid #059669';
      el.style.color = '#A7F3D0';
    } else if (tipe === 'galat') {
      el.style.background = '#450A0A';
      el.style.border = '1px solid #DC2626';
      el.style.color = '#FECACA';
    } else {
      el.style.background = '#0F172A';
      el.style.border = '1px solid #38BDF8';
      el.style.color = '#BAE6FD';
    }
  }

  function sembunyikanPesanModal() {
    const el = document.getElementById('pesan-status-modal');
    if (el) el.style.display = 'none';
  }

  window.tampilkanTransferManualBri = function () {
    const box = document.getElementById('box-transfer-manual-bri');
    if (box) {
      box.style.display = (box.style.display === 'none') ? 'block' : 'none';
    }
  };

  // ============================================================
  // INTEGRASI AKUN & BUKU KREDIT SERVER (Sinergi Mas Bey & Vity)
  // Kontrak API:
  // 1. POST /api/akun-masuk {wa} -> {status:'ok', baru:true, token, saldo:3}
  // 2. POST /api/kredit-saldo {wa, token} -> {status:'ok', saldo:N}
  // 3. POST /api/duitku-tagihan {paket, wa, token}
  // ============================================================
  const KUNCI_WA = 'act_wa';
  const KUNCI_TOKEN = 'act_token';
  let saldoServer = null;

  async function pastikanAkunTerdaftar(wa) {
    let token = localStorage.getItem(KUNCI_TOKEN);
    const waTersimpan = localStorage.getItem(KUNCI_WA);

    if (token && waTersimpan === wa) {
      return { ok: true, token };
    }

    try {
      const res = await fetch('/api/akun-masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wa })
      });
      const data = await res.json();

      if (res.status === 200 && data.token) {
        localStorage.setItem(KUNCI_WA, wa);
        localStorage.setItem(KUNCI_TOKEN, data.token);
        await muatSaldoServer();
        return { ok: true, token: data.token };
      } else if (res.status === 409) {
        if (token && waTersimpan === wa) {
          return { ok: true, token };
        }
        return { ok: false, status: 409, pesan: 'Nomor WhatsApp ini sudah terdaftar di cont-ACT. Menghubungkan pesanan...' };
      } else {
        return { ok: false, pesan: data.message || 'Nomor WhatsApp tidak valid untuk pendaftaran akun.' };
      }
    } catch (_) {
      // Fallback ramah jika serverless API belum dideploy ke produksi
      return { ok: true, token: token || `tok_lokal_${Date.now()}` };
    }
  }

  window.eksekusiCheckoutPaket = async function () {
    sembunyikanPesanModal();
    const inputWa = document.getElementById('input-wa-checkout');
    const errWa = document.getElementById('error-wa-checkout');
    const btnBayar = document.getElementById('btn-bayar-duitku');
    const labelBayar = document.getElementById('label-btn-bayar');

    const waVal = (inputWa?.value || '').replace(/[^0-9]/g, '');
    if (!waVal || waVal.length < 9) {
      if (errWa) errWa.style.display = 'block';
      if (inputWa) inputWa.focus();
      return;
    }
    if (errWa) errWa.style.display = 'none';

    if (btnBayar) btnBayar.disabled = true;
    if (labelBayar) labelBayar.textContent = 'Menghubungkan Akun & Gateway Duitku...';

    // 1. Pastikan nomor WA terdaftar di buku kredit server
    const authAkun = await pastikanAkunTerdaftar(waVal);
    if (!authAkun.ok && authAkun.status !== 409) {
      tampilkanPesanModal(authAkun.pesan, 'galat');
      if (btnBayar) btnBayar.disabled = false;
      perbaruiLabelTombolBayar();
      return;
    }

    const payload = {
      paket: paketTerpilih.id,
      wa: waVal,
      token: authAkun.token || localStorage.getItem(KUNCI_TOKEN) || '',
      nama: document.getElementById('gen-nama-produk')?.value?.trim() || 'Pembeli cont-ACT'
    };

    try {
      const response = await fetch('/api/duitku-tagihan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const hasil = await response.json();

      if (response.status === 401) {
        tampilkanPesanModal('Daftarkan nomor WhatsApp dulu atau periksa kembali nomor Anda.', 'galat');
      } else if (hasil.paymentUrl) {
        window.location.href = hasil.paymentUrl;
      } else if (hasil.status === 'sukses' || hasil.statusCode === '00') {
        tampilkanPesanModal(`Tagihan ${paketTerpilih.nama} berhasil dibuat. Silakan selesaikan pembayaran via QRIS.`, 'sukses');
      } else {
        throw new Error(hasil.message || 'Gagal membuat tagihan Duitku.');
      }
    } catch (err) {
      console.warn('[Checkout] Endpoint Duitku belum aktif di lokal, mengarahkan ke instruksi pembayaran:', err);
      tampilkanPesanModal(`Pemesanan ${paketTerpilih.nama} (${paketTerpilih.teksHarga}) siap. Silakan transfer ke Rekening Bank BRI KC Temanggung di bawah dan konfirmasi via WhatsApp.`, 'info');
      window.tampilkanTransferManualBri();
    } finally {
      if (btnBayar) btnBayar.disabled = false;
      perbaruiLabelTombolBayar();
    }
  };

  async function muatSaldoServer(cobaUlang = 0) {
    const wa = localStorage.getItem(KUNCI_WA);
    const token = localStorage.getItem(KUNCI_TOKEN);
    const elNavbar = document.getElementById('badge-saldo-pengguna');
    const elLabelNav = document.getElementById('label-kredit-sisa');
    const elForm = document.getElementById('kredit-pengguna-form');
    const elBarisForm = document.getElementById('baris-status-kredit-form');

    if (!wa || !token) {
      if (elNavbar) elNavbar.style.display = 'none';
      if (elBarisForm) elBarisForm.style.display = 'none';
      saldoServer = null;
      return null;
    }

    try {
      const res = await fetch('/api/kredit-saldo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wa, token })
      });

      if (res.status === 200) {
        const data = await res.json();
        if (typeof data.saldo === 'number') {
          saldoServer = data.saldo;
          if (elLabelNav) elLabelNav.textContent = `${saldoServer} Kredit`;
          if (elNavbar) elNavbar.style.display = 'inline-flex';
          if (elForm) elForm.textContent = `${saldoServer} Kredit`;
          if (elBarisForm) elBarisForm.style.display = 'flex';
          return saldoServer;
        }
      }
    } catch (_) {}

    // Polling ulang setelah pembayaran Duitku (3x tiap 3 detik)
    if (cobaUlang > 0) {
      setTimeout(() => muatSaldoServer(cobaUlang - 1), 3000);
      return null;
    }

    // Bila 503 / 401 / layanan belum aktif: badge tetap tersembunyi
    if (elNavbar) elNavbar.style.display = 'none';
    if (elBarisForm) elBarisForm.style.display = 'none';
    saldoServer = null;
    return null;
  }

  function perbaruiTampilanSaldoBadge(angka) {
    if (typeof angka !== 'number') return;
    saldoServer = angka;
    const elNavbar = document.getElementById('badge-saldo-pengguna');
    const elLabelNav = document.getElementById('label-kredit-sisa');
    const elForm = document.getElementById('kredit-pengguna-form');
    const elBarisForm = document.getElementById('baris-status-kredit-form');
    if (elLabelNav) elLabelNav.textContent = `${angka} Kredit`;
    if (elNavbar) elNavbar.style.display = 'inline-flex';
    if (elForm) elForm.textContent = `${angka} Kredit`;
    if (elBarisForm) elBarisForm.style.display = 'flex';
  }

  function ambilSisaKreditServer() {
    return saldoServer;
  }

  window.perbaruiTampilanSaldoBadge = perbaruiTampilanSaldoBadge;
  window.muatSaldoServer = muatSaldoServer;
  window.ambilSisaKreditServer = ambilSisaKreditServer;
  window.pastikanAkunTerdaftar = pastikanAkunTerdaftar;

  // Pastikan inisialisasi saat DOM siap
  const onLoadHandler = () => {
    inisialisasiModalPaket();
    muatSaldoServer();

    // Deteksi parameter kembali dari Duitku (?bayar=selesai)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('bayar') === 'selesai') {
        // Callback webhook Duitku sedang diproses di Supabase, polling 3x tiap 3 detik
        setTimeout(() => muatSaldoServer(3), 1000);
      }
    } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onLoadHandler);
  } else {
    onLoadHandler();
  }
})();
