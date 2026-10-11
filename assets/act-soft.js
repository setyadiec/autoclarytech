/* act-soft.js — perilaku bersama halaman AutoClaryTech (12 Okt 2026).
   1) menu kapsul di ponsel, 2) penanda tautan aktif, 3) panel "bukti hidup".
   Panel bukti hidup = CONTOH TAMPILAN (bukan data nyata); setiap panel di HTML
   wajib memuat label "Contoh tampilan". Gerak berhenti bila prefers-reduced-motion
   atau panel tidak terlihat di layar. */
(function () {
  "use strict";
  var hemat = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IKON = "/assets/ikon.svg#";
  function ikon(n, k) { return '<svg class="ikon ' + (k || "") + '" aria-hidden="true"><use href="' + IKON + n + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- 1. Menu ponsel ---------- */
  var nav = document.getElementById("nav"), tm = document.getElementById("tombolMenu");
  if (nav && tm) {
    tm.addEventListener("click", function () {
      var buka = nav.classList.toggle("buka");
      tm.setAttribute("aria-expanded", buka ? "true" : "false");
    });
    Array.prototype.forEach.call(nav.querySelectorAll(".kapsul-menu a"), function (a) {
      a.addEventListener("click", function () { nav.classList.remove("buka"); tm.setAttribute("aria-expanded", "false"); });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { nav.classList.remove("buka"); tm.setAttribute("aria-expanded", "false"); } });
  }

  /* ---------- 2. Penanda bagian aktif di menu ---------- */
  var tautan = Array.prototype.slice.call(document.querySelectorAll('.kapsul-menu a[href^="#"]'));
  if (tautan.length && "IntersectionObserver" in window) {
    var peta = {};
    tautan.forEach(function (a) { peta[a.getAttribute("href").slice(1)] = a; });
    var o = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && peta[e.target.id]) {
          tautan.forEach(function (a) { a.classList.remove("aktif"); });
          peta[e.target.id].classList.add("aktif");
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(peta).forEach(function (id) { var s = document.getElementById(id); if (s) o.observe(s); });
  }

  /* ---------- 3. Panel bukti hidup ---------- */
  // Setiap skenario: meter (angka berjalan), baris (kejadian yang tercatat), status (keadaan di kaki panel).
  // baris: [apa, keterangan, nilai, tambahMeter]
  var SKENARIO = {
    pantala: {
      jamAwal: 10 * 60 + 26,
      meter: { label: "Kendaraan masuk shift ini, terhitung kamera", awal: 37 },
      baris: [
        ["Motor masuk", "terhitung kamera gerbang", "+1", 1],
        ["Mobil masuk", "terhitung kamera gerbang", "+1", 1],
        ["Motor masuk", "terhitung kamera gerbang", "+1", 1],
        ["Penerimaan parkir", "atas nama Petugas 1", "tercatat", 0],
        ["Motor masuk", "terhitung kamera gerbang", "+1", 1],
        ["Setoran shift diterima", "dicocokkan dengan hitungan kamera", "cocok", 0]
      ],
      status: [
        ["Shift Pagi", "Terbuka otomatis pukul 10.00", "jalan", 1],
        ["Shift Pagi", "Ditutup sendiri oleh sistem, menunggu setoran", "tunggu", 0],
        ["Shift Sore", "Terbuka otomatis pukul 17.00", "jalan", 1]
      ],
      nolPadaStatus: 2
    },
    toko: {
      jamAwal: 8 * 60 + 12,
      meter: { label: "Kendaraan di halaman toko hari ini", awal: 54 },
      baris: [
        ["Motor parkir", "dicatat Juru Parkir 1", "+1", 1],
        ["Motor parkir", "dicatat Juru Parkir 1", "+1", 1],
        ["Mobil parkir", "dicatat Juru Parkir 2", "+1", 1],
        ["Motor parkir", "dicatat Juru Parkir 2", "+1", 1],
        ["Setoran juru parkir", "tercatat atas nama Juru Parkir 1", "tercatat", 0]
      ],
      status: [
        ["Halaman depan", "Dua juru parkir bertugas, semua tercatat", "jalan", 1],
        ["Rekap pemilik", "Jumlah kendaraan dan setoran terlihat dari HP", "jalan", 1]
      ]
    },
    pondok: {
      jamAwal: 7 * 60 + 40,
      meter: { label: "Santri yang syahriah bulan ini sudah lunas", awal: 21, total: 30 },
      baris: [
        ["Syahriah diterima", "Santri 22, tunai di bendahara", "lunas", 1],
        ["Syahriah diterima", "Santri 08, transfer, bukti tersimpan", "lunas", 1],
        ["Tunggakan diperbarui", "Santri 15, dua bulan", "tercatat", 0],
        ["Syahriah diterima", "Santri 27, tunai di bendahara", "lunas", 1],
        ["Syahriah diterima", "Santri 03, transfer, bukti tersimpan", "lunas", 1]
      ],
      status: [["Rekap bendahara", "{sisa} santri belum lunas, nama-namanya terlihat", "tunggu", 0]],
      ulangPadaPenuh: true
    },
    koperasi: {
      jamAwal: 9 * 60 + 5,
      meter: { label: "Transaksi toko koperasi hari ini", awal: 46 },
      baris: [
        ["Penjualan tunai", "Kasir 1, stok berkurang otomatis", "+1", 1],
        ["Bon dicatat", "Anggota 031, jatuh tempo akhir bulan", "+1", 1],
        ["Penjualan tunai", "Kasir 1, stok berkurang otomatis", "+1", 1],
        ["Bon dilunasi", "Anggota 012", "+1", 1],
        ["Belanja anggota", "Anggota 007, masuk hitungan jasa SHU", "+1", 1]
      ],
      status: [
        ["Kas laci", "Cocok dengan catatan penjualan", "jalan", 1],
        ["Bon terbuka", "Terlihat per anggota, bukan perkiraan", "jalan", 1]
      ]
    },
    desa: {
      jamAwal: 9 * 60 + 30,
      meter: { label: "Pengunjung masuk hari ini, dari karcis", awal: 182 },
      baris: [
        ["Karcis terjual", "Mobil rombongan, 6 orang", "+6", 6],
        ["Karcis terjual", "Motor, 2 orang", "+2", 2],
        ["Karcis terjual", "Mobil keluarga, 4 orang", "+4", 4],
        ["Karcis terjual", "Motor, 1 orang", "+1", 1],
        ["Karcis terjual", "Bus rombongan, 28 orang", "+28", 28]
      ],
      status: [
        ["Loket utama", "Karcis terjual sama dengan uang tercatat", "jalan", 1],
        ["Rekap BUMDes", "Bisa dibuka bersama saat musyawarah", "jalan", 1]
      ]
    },
    les: {
      jamAwal: 15 * 60 + 30,
      meter: { label: "Murid hadir di sesi sore ini", awal: 5, total: 12 },
      baris: [
        ["Presensi", "Murid 07, kelompok Iqra", "hadir", 1],
        ["Presensi", "Murid 02, kelompok Matematika", "hadir", 1],
        ["Iuran diterima", "Murid 03, bulan ini, transfer", "lunas", 0],
        ["Presensi", "Murid 11, kelompok Iqra", "hadir", 1],
        ["Presensi", "Murid 09, kelompok Matematika", "hadir", 1]
      ],
      status: [["Rekap bulan ini", "Iuran tertunda terlihat per murid, tanpa menagih lisan", "jalan", 1]],
      ulangPadaPenuh: true
    }
  };

  function jamTeks(m) { return String(Math.floor(m / 60) % 24).padStart(2, "0") + "." + String(m % 60).padStart(2, "0"); }

  function pasangBuku(panel, S) {
    var isi = panel.querySelector(".hidup-isi");
    var h = '<div class="meter"><div><div class="meter-label">' + esc(S.meter.label) + '</div></div>' +
      '<div class="meter-angka" aria-hidden="true"></div>' +
      (S.meter.total ? '<div class="meter-rel"><div class="meter-isi"></div></div>' : "") + "</div>" +
      '<div class="buku"></div>' +
      '<div class="status-baris"><div class="shift-teks"><b></b><span></span></div><div class="sakelar" role="img" aria-label="Status"></div></div>';
    isi.innerHTML = h;
    var angkaEl = isi.querySelector(".meter-angka"), relEl = isi.querySelector(".meter-isi"), buku = isi.querySelector(".buku");
    var stB = isi.querySelector(".shift-teks b"), stS = isi.querySelector(".shift-teks span"), sak = isi.querySelector(".sakelar");
    var nilai = S.meter.awal, menit = S.jamAwal, i = 0, st = 0;

    function tulisMeter(lompat) {
      angkaEl.innerHTML = S.meter.total ? nilai + " <small>/ " + S.meter.total + "</small>" : String(nilai);
      if (relEl) relEl.style.width = Math.min(100, nilai / S.meter.total * 100) + "%";
      if (lompat && !hemat) { angkaEl.classList.remove("loncat"); void angkaEl.offsetWidth; angkaEl.classList.add("loncat"); }
    }
    function tulisStatus() {
      var s = S.status[st % S.status.length];
      stB.textContent = s[0];
      stS.textContent = s[1].replace("{sisa}", S.meter.total ? S.meter.total - nilai : "");
      stS.className = s[2];
      sak.classList.toggle("nyala", !!s[3]);
    }
    function baris(d, baru) {
      var b = document.createElement("div");
      b.className = "buku-baris" + (baru ? " baru" : "");
      b.innerHTML = '<span class="jam">' + jamTeks(menit) + '</span><span class="apa">' + esc(d[0]) + "<small>" + esc(d[1]) + '</small></span><span class="nilai">' + esc(d[2]) + "</span>";
      return b;
    }
    for (var k = 0; k < 3; k++) { buku.appendChild(baris(S.baris[k])); menit -= 6; }
    menit += 24; i = 3;
    tulisMeter(false); tulisStatus();

    function langkah() {
      var d = S.baris[i % S.baris.length];
      var lama = buku.querySelector(".baru"); if (lama) lama.classList.remove("baru");
      buku.insertBefore(baris(d, true), buku.firstChild);
      if (buku.children.length > 3) buku.removeChild(buku.lastChild);
      if (d[3]) {
        nilai += d[3];
        if (S.meter.total && nilai > S.meter.total) nilai = S.meter.total;
        tulisMeter(true);
      }
      i++; menit += 3 + (i % 3) * 2;
      if (S.status.length > 1 && i % 3 === 0) {
        st++;
        if (S.nolPadaStatus != null && st % S.status.length === S.nolPadaStatus) { nilai = 0; tulisMeter(true); }
        if (st % S.status.length === 0) { nilai = S.meter.awal; tulisMeter(false); }
      }
      if (S.ulangPadaPenuh && S.meter.total && nilai >= S.meter.total - 2) { nilai = S.meter.awal; tulisMeter(false); }
      tulisStatus();
    }
    return langkah;
  }

  // Jadwal armada RentalKita: pesanan masuk -> bentrok ditolak -> dialihkan -> kontrak terbit
  function pasangJadwal(panel) {
    var isi = panel.querySelector(".hidup-isi");
    var hari = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    var unit = [["MPV 01", [0, 1, 2, 3], []], ["MPV 02", [5, 6], []], ["City car 03", [], [1, 2]], ["Motor 04", [0, 1, 4, 5, 6], []]];
    var h = '<div class="jadwal" aria-hidden="true"><div class="jadwal-baris kepala"><span></span>';
    hari.forEach(function (x) { h += "<span>" + x + "</span>"; });
    h += "</div>";
    unit.forEach(function (u, r) {
      h += '<div class="jadwal-baris"><span class="nm">' + u[0] + "</span>";
      for (var d = 0; d < 7; d++) h += '<span class="sel" data-r="' + r + '" data-d="' + d + '"></span>';
      h += "</div>";
    });
    h += '<div class="jadwal-ket"><span><b style="background:#C9CBF7"></b>Disewa</span><span><b style="background:#CBD2E1"></b>Servis</span><span><b style="background:#5B5EF0"></b>Pesanan baru</span></div></div>' +
      '<div class="buku"></div>' +
      '<div class="status-baris"><div class="shift-teks"><b>Unit tersedia Rabu</b><span class="jalan"></span></div><span class="chip aksen"><i></i>anti-bentrok</span></div>';
    isi.innerHTML = h;
    var buku = isi.querySelector(".buku"), stS = isi.querySelector(".shift-teks span");
    function sel(r, d) { return isi.querySelector('.sel[data-r="' + r + '"][data-d="' + d + '"]'); }
    function awal() {
      Array.prototype.forEach.call(isi.querySelectorAll(".sel"), function (s) { s.className = "sel"; });
      unit.forEach(function (u, r) { u[1].forEach(function (d) { sel(r, d).classList.add("sewa"); }); u[2].forEach(function (d) { sel(r, d).classList.add("servis"); }); });
      hitungTersedia();
    }
    function hitungTersedia() {
      var n = 0;
      for (var r = 0; r < unit.length; r++) { var s = sel(r, 2); if (!/sewa|servis|baru/.test(s.className)) n++; }
      stS.textContent = n + " dari " + unit.length + " unit";
    }
    var LANGKAH = [
      ["Pesanan online masuk", "MPV 01, Rabu sampai Jumat", "diperiksa", "aksen", function () { [2, 3, 4].forEach(function (d) { sel(0, d).classList.add("minta"); }); }],
      ["Ditolak otomatis", "MPV 01 masih disewa sampai Kamis", "bentrok", "bahaya", function () { [2, 3].forEach(function (d) { sel(0, d).classList.add("bentrok"); }); }],
      ["Dialihkan ke unit sekelas", "MPV 02, Rabu sampai Jumat", "terkunci", "hidup", function () {
        [2, 3, 4].forEach(function (d) { sel(0, d).classList.remove("minta", "bentrok"); sel(1, d).classList.add("baru"); }); hitungTersedia(); }],
      ["Kontrak dan nota terbit", "dari data sewa yang tercatat", "siap cetak", "hidup", function () {}]
    ];
    var j = 0;
    function tulis(L) {
      var lama = buku.querySelector(".baru"); if (lama) lama.classList.remove("baru");
      var b = document.createElement("div");
      b.className = "buku-baris baru";
      b.innerHTML = '<span class="jam">' + ikon(L[3] === "bahaya" ? "i-lingkar-x" : (L[3] === "hidup" ? "i-lingkar-cek" : "i-kalender"), "ikon-s") + '</span><span class="apa">' + esc(L[0]) + "<small>" + esc(L[1]) + '</small></span><span class="chip ' + L[3] + '"><i></i>' + esc(L[2]) + "</span>";
      buku.insertBefore(b, buku.firstChild);
      if (buku.children.length > 3) buku.removeChild(buku.lastChild);
    }
    awal();
    // isi awal buku dengan keadaan tenang
    var b0 = document.createElement("div"); b0.className = "buku-baris";
    b0.innerHTML = '<span class="jam">' + ikon("i-mobil", "ikon-s") + '</span><span class="apa">Motor 04 kembali<small>dicek fisik, tercatat</small></span><span class="chip hidup"><i></i>tersedia</span>';
    buku.appendChild(b0);
    var b1 = document.createElement("div"); b1.className = "buku-baris";
    b1.innerHTML = '<span class="jam">' + ikon("i-alat", "ikon-s") + '</span><span class="apa">City car 03 masuk servis<small>pengingat jadwal servis</small></span><span class="chip tunggu"><i></i>servis</span>';
    buku.appendChild(b1);
    return function () {
      if (j === LANGKAH.length) { awal(); j = 0; }
      var L = LANGKAH[j]; L[4](); tulis(L); j++;
    };
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-hidup]"), function (panel) {
    var kode = panel.getAttribute("data-hidup");
    var langkah = kode === "rental" ? pasangJadwal(panel) : (SKENARIO[kode] ? pasangBuku(panel, SKENARIO[kode]) : null);
    if (!langkah || hemat) return;
    var tampak = true, jeda = kode === "rental" ? 2400 : 3200;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { tampak = es[0].isIntersecting; }).observe(panel);
    }
    setInterval(function () { if (tampak && !document.hidden) langkah(); }, jeda);
  });
})();
