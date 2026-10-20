/**
 * act-kontak-widget.js — Widget Pesan & Kontak Melayang AutoClaryTech (ACT)
 * Ringan (~4 KB), responsif, kontekstual halaman, tanpa dependensi eksternal.
 * Tingkat 1: Akses Instan Omnichannel (WhatsApp Resmi, Telegram, Email Dukungan).
 */

(function () {
  'use strict';

  // Jangan inisialisasi ganda
  if (window.__ACT_KONTAK_WIDGET_INIT__) return;
  window.__ACT_KONTAK_WIDGET_INIT__ = true;

  function initWidget() {
    // Muat konfigurasi situs
    var cfg = window.SITUS || {};
    var waNomor = cfg.waNomor || '6285727240341';
    var tgUser = String(cfg.telegramUser || '').trim(); // Default kosong sampai ditetapkan Bapak
    var emailTujuan = cfg.emailResmi || 'autoclarytech@gmail.com';

    // Deteksi konteks halaman aktif
    var path = window.location.pathname.toLowerCase();
    var judul = document.title || 'AutoClaryTech';

    var pesanDefault = 'Halo Admin AutoClaryTech, saya ingin konsultasi mengenai layanan untuk usaha saya.';
    if (path.indexOf('cont-act') !== -1) {
      pesanDefault = 'Halo Admin cont-ACT, saya sedang mencoba Studio Foto & Iklan Produk AI dan ingin bertanya seputar layanan / konfirmasi pemesanan.';
    } else if (path.indexOf('video') !== -1) {
      pesanDefault = 'Halo Admin AutoClaryTech, saya ingin konfirmasi pemesanan Video Reels cont-ACT (Rp19.900) ke rekening BRI Artareksa.';
    } else if (path.indexOf('bayar') !== -1) {
      pesanDefault = 'Halo Admin AutoClaryTech, saya sedang berada di halaman pembayaran dan ingin konfirmasi aktivasi paket usaha.';
    } else if (path.indexOf('rentalkita') !== -1) {
      pesanDefault = 'Halo Admin AutoClaryTech, saya tertarik dengan aplikasi RentalKita untuk manajemen sewa kendaraan.';
    } else if (path.indexOf('pantala') !== -1) {
      pesanDefault = 'Halo Admin AutoClaryTech, saya ingin berkonsultasi mengenai sistem kasir & operasional kafe Pantala.';
    }

    // Bangun URL tujuan
    var urlWa = 'https://wa.me/' + waNomor + '?text=' + encodeURIComponent(pesanDefault);
    var urlTg = tgUser ? ('https://t.me/' + tgUser) : '';
    var subjekEmail = 'Konsultasi Layanan AutoClaryTech — ' + judul;
    var urlEmail = 'mailto:' + emailTujuan + '?subject=' + encodeURIComponent(subjekEmail) + '&body=' + encodeURIComponent(pesanDefault + '\n\n(Terkirim dari halaman: ' + window.location.href + ')');

    var htmlTelegram = '';
    if (tgUser) {
      htmlTelegram = 
        '<!-- Opsi 2: Telegram -->' +
        '<a href="' + urlTg + '" target="_blank" rel="noopener noreferrer" class="act-opsi-item act-opsi-tg" id="act-link-tg">' +
          '<div class="act-opsi-ikon">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">' +
              '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>' +
            '</svg>' +
          '</div>' +
          '<div class="act-opsi-teks">' +
            '<span class="act-opsi-judul">Telegram Resmi</span>' +
            '<span class="act-opsi-ket">@' + tgUser + ' &bull; Alternatif bebas ban</span>' +
          '</div>' +
          '<svg class="act-opsi-panah" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
        '</a>';
    }

    // Buat elemen wadah widget
    var wrap = document.createElement('div');
    wrap.className = 'act-kontak-wrap';
    wrap.id = 'act-kontak-widget';

    wrap.innerHTML = 
      '<!-- Teaser Balon -->' +
      '<div class="act-kontak-teaser" id="act-kontak-teaser">' +
        '💬 Butuh bantuan? Chat kami' +
      '</div>' +

      '<!-- Panel Menu Popover -->' +
      '<div class="act-kontak-card" id="act-kontak-card" role="dialog" aria-labelledby="act-card-title">' +
        '<div class="act-card-header">' +
          '<div class="act-header-info">' +
            '<h4 id="act-card-title">Hubungi AutoClaryTech</h4>' +
            '<div class="act-header-status">' +
              '<span class="act-status-dot"></span> Admin Online &bull; Respon Cepat' +
            '</div>' +
          '</div>' +
          '<button type="button" class="act-btn-tutup" id="act-btn-tutup" aria-label="Tutup jendela kontak">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          '</button>' +
        '</div>' +

        '<div class="act-card-body">' +
          '<p class="act-card-sub">Pilih saluran yang paling nyaman bagi Anda:</p>' +

          '<!-- Opsi 1: WhatsApp -->' +
          '<a href="' + urlWa + '" target="_blank" rel="noopener noreferrer" class="act-opsi-item act-opsi-wa">' +
            '<div class="act-opsi-ikon">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">' +
                '<path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.476-.15-.677.15-.2.302-.776.979-.952 1.18-.175.201-.351.226-.652.075-.3-.15-1.266-.467-2.41-1.488-.89-.794-1.49-1.774-1.666-2.075-.175-.3-.019-.463.131-.613.136-.135.302-.351.452-.527.151-.176.201-.302.302-.503.1-.201.05-.377-.025-.527-.075-.151-.677-1.632-.927-2.235-.244-.588-.492-.508-.677-.518-.175-.008-.376-.01-.577-.01-.201 0-.527.075-.803.376s-1.053 1.029-1.053 2.511 1.078 2.912 1.229 3.113c.15.201 2.122 3.24 5.141 4.544.718.31 1.279.495 1.716.634.721.23 1.378.197 1.897.12.578-.087 1.78-.727 2.031-1.43.25-.704.25-1.307.175-1.431-.075-.125-.276-.201-.577-.352z"/>' +
                '<path d="M12.004 2C6.48 2 2 6.48 2 12.004c0 1.954.564 3.784 1.542 5.334L2.1 22l4.805-1.407A9.957 9.957 0 0 0 12.004 22C17.524 22 22 17.52 22 12.004 22 6.48 17.524 2 12.004 2zm0 18.2a8.17 8.17 0 0 1-4.223-1.17l-.303-.18-2.855.836.852-2.783-.197-.315A8.17 8.17 0 1 1 12.004 20.2z"/>' +
              '</svg>' +
            '</div>' +
            '<div class="act-opsi-teks">' +
              '<span class="act-opsi-judul">WhatsApp Resmi</span>' +
              '<span class="act-opsi-ket">0857-2724-0341 &bull; Chat langsung</span>' +
            '</div>' +
            '<svg class="act-opsi-panah" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
          '</a>' +

          htmlTelegram +

          '<!-- Opsi 3: Email -->' +
          '<a href="' + urlEmail + '" class="act-opsi-item act-opsi-email">' +
            '<div class="act-opsi-ikon">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>' +
                '<polyline points="22,6 12,13 2,6"></polyline>' +
              '</svg>' +
            '</div>' +
            '<div class="act-opsi-teks">' +
              '<span class="act-opsi-judul">Email Dukungan</span>' +
              '<span class="act-opsi-ket">' + emailTujuan + '</span>' +
            '</div>' +
            '<svg class="act-opsi-panah" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
          '</a>' +
        '</div>' +

        '<div class="act-card-footer">' +
          'PT Artareksa Teknologi Ekonomi &bull; NIB 0510260027696' +
        '</div>' +
      '</div>' +

      '<!-- Tombol FAB Melayang -->' +
      '<button type="button" class="act-kontak-fab" id="act-kontak-fab" aria-label="Buka bantuan obrolan">' +
        '<span class="act-kontak-pulse"></span>' +
        '<!-- Ikon Chat Normal -->' +
        '<svg class="act-ikon-chat" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
        '</svg>' +
        '<!-- Ikon Silang Tutup -->' +
        '<svg class="act-ikon-silang" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="18" y1="6" x2="6" y2="18"></line>' +
          '<line x1="6" y1="6" x2="18" y2="18"></line>' +
        '</svg>' +
      '</button>';

    document.body.appendChild(wrap);

    // Event Listener Interaktif
    var fab = document.getElementById('act-kontak-fab');
    var btnTutup = document.getElementById('act-btn-tutup');

    function toggleMenu() {
      wrap.classList.toggle('terbuka');
      var buka = wrap.classList.contains('terbuka');
      fab.setAttribute('aria-expanded', buka ? 'true' : 'false');
    }

    fab.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    btnTutup.addEventListener('click', function (e) {
      e.stopPropagation();
      wrap.classList.remove('terbuka');
      fab.setAttribute('aria-expanded', 'false');
    });

    // Tutup bila klik di luar
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove('terbuka');
        fab.setAttribute('aria-expanded', 'false');
      }
    });

    // Tutup dengan tombol Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && wrap.classList.contains('terbuka')) {
        wrap.classList.remove('terbuka');
        fab.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Jalankan saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
