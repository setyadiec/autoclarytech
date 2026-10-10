/* hitung.js - alat hitung + formulir singkat halaman jalur ACT (10 Okt 2026).
   Pengganti ajakan "kirim HITUNG ... ke WA" (nomor WA diblokir). Rumus disalin dari balasan otomatis CS WA:
   D:\SaaS-UMKM\atc-masuk\kunci_jalur.py (sewa, pondok, parkir toko, koperasi, desa, les) dan
   D:\SaaS-UMKM\atc-masuk\proses_dan_balas.py balasan_hitung_parkir (parkir kafe/Pantala).
   Semua angka hasil keluar dari angka yang diisi pengunjung sendiri. Tidak ada angka bawaan selain
   "hari buka kosong = 30 hari" dan "bulan kosong = 1" yang juga dipakai balasan WA.
   Pakai: <div data-hitung="pondok"></div> <script src="/hitung.js" defer></script> */
(function () {
  "use strict";

  function angka(s) {                       // padanan _angka(): 150rb, 1,2jt, 2.000, 2000
    if (s == null) return null;
    var t = String(s).toLowerCase().replace(/\s+/g, "").replace(/^rp\.?/, "");
    if (t === "") return null;
    var kali = 1, m;
    if ((m = t.match(/^(.*?)(jt|juta)$/))) { kali = 1e6; t = m[1]; }
    else if ((m = t.match(/^(.*?)(rb|ribu|k)$/))) { kali = 1e3; t = m[1]; }
    if (kali > 1) { var f = parseFloat(t.replace(",", ".")); return isNaN(f) ? null : Math.round(f * kali); }
    t = t.replace(/[.,]/g, "");
    return /^\d+$/.test(t) ? parseInt(t, 10) : null;
  }
  function rp(n) { var neg = n < 0; n = Math.round(Math.abs(n)); return (neg ? "-" : "") + "Rp" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function ang(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  // ---- definisi tiap jalur: kolom isian + rumus (lihat sumber di kepala berkas) ----
  var JALUR = {
    pantala: {
      nama: "Parkir kafe", judul: "Hitung parkir kafe Anda",
      ajak: "Isi rata-rata kendaraan tamu per hari dan tarif parkir di tempat Anda.",
      kolom: [
        ["motor", "Motor tamu per hari", "jumlah", "mis. 120"],
        ["tm", "Tarif parkir motor", "rp", "mis. 2000"],
        ["mobil", "Mobil tamu per hari", "jumlah", "mis. 15"],
        ["tb", "Tarif parkir mobil", "rp", "mis. 5000"],
        ["hari", "Hari buka sebulan", "jumlah", "kosong = 30 hari"],
        ["setor", "Yang sampai ke Anda per bulan (boleh kosong)", "rp", "mis. 3jt"]
      ],
      hitung: function (v) {
        var adaMt = v.motor != null && v.tm != null, adaMb = v.mobil != null && v.tb != null;
        if (!adaMt && !adaMb) return { kurang: "Isi jumlah motor dan tarifnya, atau jumlah mobil dan tarifnya." };
        var hari = v.hari || 30, b = [];
        if (adaMt) b.push(["Motor: " + ang(v.motor) + " x " + rp(v.tm), rp(v.motor * v.tm) + " per hari"]);
        if (adaMb) b.push(["Mobil: " + ang(v.mobil) + " x " + rp(v.tb), rp(v.mobil * v.tb) + " per hari"]);
        var ph = (v.motor || 0) * (v.tm || 0) + (v.mobil || 0) * (v.tb || 0), pb = ph * hari;
        b.push(["Per hari", rp(ph)]);
        b.push(["Per bulan (" + hari + " hari" + (v.hari ? "" : ", hari buka belum diisi") + ")", rp(pb), 1]);
        if (v.setor != null) { b.push(["Yang sampai ke Anda", rp(v.setor)]); b.push(["Selisih per bulan", rp(pb - v.setor), 1]); }
        return { baris: b };
      }
    },
    toko: {
      nama: "Parkir toko / ruko", judul: "Hitung parkir halaman toko Anda",
      ajak: "Hitung kendaraan di jam ramai, isi tarifnya, lalu bandingkan dengan yang sampai ke Anda.",
      kolom: [
        ["motor", "Motor per hari", "jumlah", "mis. 200"],
        ["tm", "Tarif parkir motor", "rp", "mis. 2000"],
        ["mobil", "Mobil per hari", "jumlah", "mis. 10"],
        ["tb", "Tarif parkir mobil", "rp", "mis. 5000"],
        ["hari", "Hari buka sebulan", "jumlah", "kosong = 30 hari"],
        ["setor", "Yang sampai ke Anda per bulan (boleh kosong)", "rp", "mis. 3jt"]
      ],
      hitung: function (v) {
        if (!((v.motor != null && v.tm) || (v.mobil != null && v.tb))) return { kurang: "Isi jumlah motor dan tarifnya, atau jumlah mobil dan tarifnya." };
        var hari = v.hari || 30, bln = ((v.motor || 0) * (v.tm || 0) + (v.mobil || 0) * (v.tb || 0)) * hari;
        var b = [["Per hari", rp(bln / hari)], ["Per bulan (" + hari + " hari)", rp(bln), 1]];
        if (v.setor != null) { b.push(["Yang sampai ke Anda", rp(v.setor)]); b.push(["Selisih per bulan", rp(bln - v.setor), 1]); }
        return { baris: b };
      }
    },
    rental: {
      nama: "Rental kendaraan", judul: "Hitung yang hilang dalam tiga bulan terakhir",
      ajak: "Isi angka usaha rental Anda selama tiga bulan terakhir. Yang tidak ada, biarkan kosong.",
      kolom: [
        ["rusak", "Biaya perbaikan yang Anda tanggung sendiri", "rp", "mis. 2jt"],
        ["batal", "Pesanan batal karena jadwal bentrok", "jumlah", "mis. 3"],
        ["harga", "Harga sewa rata-rata", "rp", "mis. 350rb"],
        ["belum", "Uang sewa / sisa bayar yang belum jelas", "rp", "mis. 500rb"]
      ],
      hitung: function (v) {
        if (v.rusak == null && v.batal == null && v.belum == null) return { kurang: "Isi minimal satu: biaya perbaikan, pesanan batal, atau uang sewa yang belum jelas." };
        var r = v.rusak || 0, bt = v.batal || 0, h = v.harga || 0, u = v.belum || 0, tot = r + bt * h + u;
        return { baris: [
          ["Kerusakan ditanggung sendiri", rp(r)],
          ["Pesanan batal karena bentrok: " + ang(bt) + " x " + rp(h), rp(bt * h)],
          ["Uang sewa belum jelas", rp(u)],
          ["Total tiga bulan", rp(tot), 1],
          ["Bila terus begini, setahun", rp(tot * 4), 1]
        ] };
      }
    },
    pondok: {
      nama: "Pondok / sekolah", judul: "Cek tunggakan syahriah pondok Anda",
      ajak: "Centang daftar yang sudah lunas, hitung yang belum, lalu isi di sini.",
      kolom: [
        ["y", "Syahriah / SPP per bulan", "rp", "mis. 300rb"],
        ["n", "Santri / siswa yang belum lunas", "jumlah", "mis. 25"],
        ["m", "Rata-rata berapa bulan tertunggak", "jumlah", "kosong = 1 bulan"]
      ],
      hitung: function (v) {
        if (v.y == null || v.n == null) return { kurang: "Isi besar syahriah dan jumlah santri yang belum lunas." };
        var m = v.m || 1;
        return { baris: [
          [ang(v.n) + " santri/siswa belum lunas x " + rp(v.y) + " x " + m + " bulan", ""],
          ["Total tunggakan", rp(v.y * v.n * m), 1]
        ] };
      }
    },
    koperasi: {
      nama: "Koperasi", judul: "Cek kas dan bon koperasi Anda",
      ajak: "Hitung sepuluh barang terlaris, cocokkan dengan catatan stok, dan jumlahkan bon anggota yang masih terbuka.",
      kolom: [
        ["st", "Nilai selisih stok 10 barang terlaris (harga beli)", "rp", "mis. 1,2jt"],
        ["bk", "Total bon anggota menurut buku", "rp", "mis. 8jt"],
        ["bp", "Total bon anggota menurut perkiraan pengurus", "rp", "mis. 10jt"]
      ],
      hitung: function (v) {
        if (v.st == null && v.bk == null) return { kurang: "Isi nilai selisih stok atau total bon anggota menurut buku." };
        var b = [["Selisih stok", rp(v.st || 0), 1]];
        if (v.bk != null && v.bp != null) {
          b.push(["Bon anggota menurut buku", rp(v.bk)]);
          b.push(["Bon anggota menurut perkiraan", rp(v.bp)]);
          b.push(["Selisih bon", rp(Math.abs(v.bp - v.bk)), 1]);
        }
        return { baris: b };
      }
    },
    desa: {
      nama: "Desa wisata / BUMDes", judul: "Cek karcis objek wisata desa dalam satu akhir pekan",
      ajak: "Hitung kendaraan dan rombongan di jalan masuk, lalu bandingkan dengan karcis terjual dan uang di kotak.",
      kolom: [
        ["k", "Kendaraan / rombongan yang dihitung", "jumlah", "mis. 150"],
        ["o", "Rata-rata orang per kendaraan", "jumlah", "kosong = 1"],
        ["h", "Harga karcis per orang", "rp", "mis. 10rb"],
        ["j", "Karcis terjual (boleh kosong)", "jumlah", "mis. 380"],
        ["u", "Uang di kotak (boleh kosong)", "rp", "mis. 3,5jt"]
      ],
      hitung: function (v) {
        if (v.k == null || v.h == null) return { kurang: "Isi jumlah kendaraan yang dihitung dan harga karcis." };
        var o = v.o || 1, s = v.k * o * v.h;
        var b = [["Perkiraan pengunjung", ang(v.k * o) + " orang"], ["Seharusnya", rp(s), 1]];
        if (v.j != null) b.push(["Tercatat dari karcis terjual", rp(v.j * v.h)]);
        if (v.u != null) { b.push(["Uang di kotak", rp(v.u)]); b.push(["Selisih dengan perkiraan", rp(s - v.u), 1]); }
        return { baris: b };
      }
    },
    les: {
      nama: "Les / bimbel", judul: "Hitung usaha les Anda sebulan",
      ajak: "Iuran yang seharusnya masuk, yang sudah masuk, biaya yang keluar, lalu jam mengajar.",
      kolom: [
        ["n", "Jumlah murid", "jumlah", "mis. 12"],
        ["i", "Iuran per murid sebulan", "rp", "mis. 150rb"],
        ["b", "Murid yang sudah membayar bulan ini", "jumlah", "kosong = semua"],
        ["c", "Biaya les sebulan (boleh kosong)", "rp", "mis. 300rb"],
        ["j", "Jam mengajar les sebulan (boleh kosong)", "jumlah", "mis. 40"]
      ],
      hitung: function (v) {
        if (v.n == null || v.i == null) return { kurang: "Isi jumlah murid dan iuran per murid." };
        var sudah = (v.b != null ? v.b : v.n) * v.i;
        var b = [["Iuran seharusnya", rp(v.n * v.i)], ["Sudah masuk", rp(sudah)], ["Masih tertunda", rp(v.n * v.i - sudah), 1]];
        if (v.c != null) b.push(["Pendapatan bersih", rp(sudah - v.c), 1]);
        if (v.j) b.push(["Nilai per jam mengajar", rp((sudah - (v.c || 0)) / v.j), 1]);
        return { baris: b };
      }
    }
  };

  var CSS = ".hk{--hk-a:var(--hijau,#1f5a3b);--hk-at:var(--hijau-teks,#fff);border:2px solid var(--hk-a);border-radius:12px;padding:22px 18px;margin:8px 0 0;background:rgba(127,127,127,.06)}" +
    ".hk h2{margin:0 0 6px}.hk .hk-ajak{margin:0 0 16px;opacity:.85}" +
    ".hk-grid{display:grid;gap:12px;grid-template-columns:1fr}@media(min-width:560px){.hk-grid{grid-template-columns:1fr 1fr}}" +
    ".hk label{display:block;font-size:14px;font-weight:600;margin-bottom:4px;line-height:1.35}" +
    ".hk input{width:100%;box-sizing:border-box;font:inherit;font-size:17px;padding:11px 12px;border-radius:8px;border:1px solid rgba(127,127,127,.45);background:rgba(255,255,255,.9);color:#1e1b16;min-height:46px}" +
    ".hk input:focus{outline:3px solid var(--hk-a);outline-offset:1px}" +
    ".hk-btn{display:inline-block;margin-top:14px;background:var(--hk-a);color:var(--hk-at);border:0;font:inherit;font-weight:700;font-size:16px;padding:13px 22px;border-radius:8px;cursor:pointer;min-height:46px}" +
    ".hk-btn[disabled]{opacity:.6;cursor:wait}" +
    ".hk-hasil{margin-top:18px;display:none}.hk-hasil table{width:100%;border-collapse:collapse;font-size:16px}" +
    ".hk-hasil td{padding:8px 4px;border-bottom:1px solid rgba(127,127,127,.3);vertical-align:top}.hk-hasil td:last-child{text-align:right;white-space:nowrap;padding-left:10px}" +
    ".hk-hasil tr.hk-p td{font-weight:800;font-size:17px}.hk-cat{font-size:14px;opacity:.8;margin:10px 0 0}" +
    ".hk-kurang{color:#b42318;font-weight:600;margin-top:12px;display:none}" +
    ".hk-daftar{margin-top:26px;padding-top:20px;border-top:1px dashed rgba(127,127,127,.5)}.hk-daftar h3{margin:0 0 4px;font-size:20px}" +
    ".hk-daftar p{margin:0 0 14px;font-size:15px;opacity:.85}.hk-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}" +
    ".hk-pesan{margin-top:12px;padding:12px 14px;border-radius:8px;display:none;font-size:15px}" +
    ".hk-ok{background:rgba(16,185,129,.14);border:1px solid #10b981}.hk-gagal{background:rgba(239,68,68,.12);border:1px solid #ef4444}";

  function el(tag, attr, html) { var e = document.createElement(tag); for (var k in (attr || {})) e.setAttribute(k, attr[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function pasang(wadah) {
    var kode = wadah.getAttribute("data-hitung"), J = JALUR[kode];
    if (!J) return;
    var id = "hk-" + kode;
    var h = '<div class="hk" id="' + id + '">' +
      '<h2>' + esc(J.judul) + '</h2><p class="hk-ajak">' + esc(J.ajak) + ' Angka Anda tidak dikirim ke mana pun saat menghitung.</p>' +
      '<form class="hk-hitung" novalidate><div class="hk-grid">';
    J.kolom.forEach(function (k) {
      h += '<div><label for="' + id + '-' + k[0] + '">' + esc(k[1]) + (k[2] === "rp" ? " (Rp)" : "") + '</label>' +
        '<input id="' + id + '-' + k[0] + '" name="' + k[0] + '" inputmode="' + (k[2] === "rp" ? "text" : "numeric") + '" autocomplete="off" placeholder="' + esc(k[3]) + '"></div>';
    });
    h += '</div><button class="hk-btn" type="submit">Hitung sekarang</button>' +
      '<div class="hk-kurang" role="alert"></div>' +
      '<div class="hk-hasil" aria-live="polite"><table></table><p class="hk-cat">Angka ini murni dari angka yang Anda isi sendiri. Tidak ada yang kami tambahkan.</p></div></form>' +
      '<div class="hk-daftar" id="daftar"><h3>Ingin tahu cara mencatatnya tanpa ribet?</h3>' +
      '<p>Tinggalkan nama Anda. Isi kontak bila ingin dihubungi tim AutoClaryTech. Hasil hitungan di atas ikut terkirim supaya tim kami bisa membacanya.</p>' +
      '<form class="hk-form"><div class="hk-grid">' +
      '<div><label for="' + id + '-nama">Nama Anda</label><input id="' + id + '-nama" name="nama" required autocomplete="name"></div>' +
      '<div><label for="' + id + '-usaha">Nama usaha / lembaga</label><input id="' + id + '-usaha" name="usaha" required autocomplete="organization"></div>' +
      '<div><label for="' + id + '-kota">Kota / kabupaten</label><input id="' + id + '-kota" name="kota" autocomplete="address-level2"></div>' +
      '<div><label for="' + id + '-kontak">No. HP atau email (boleh kosong)</label><input id="' + id + '-kontak" name="kontak" autocomplete="tel"></div>' +
      '</div><div class="hk-hp" aria-hidden="true"><label>Jangan diisi<input name="situs" tabindex="-1" autocomplete="off"></label></div>' +
      '<button class="hk-btn" type="submit">Kirim</button>' +
      '<div class="hk-pesan" role="status"></div>' +
      '<p style="font-size:13px;margin-top:10px">Dengan mengirim, Anda menyetujui <a href="/privasi.html">Kebijakan Privasi</a>. Tanpa biaya, tanpa kewajiban berlangganan.</p>' +
      '</form></div></div>';
    wadah.innerHTML = h;

    var fH = wadah.querySelector(".hk-hitung"), hasil = wadah.querySelector(".hk-hasil"), kurang = wadah.querySelector(".hk-kurang");
    var terakhir = null;
    fH.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = {}, masukan = {};
      J.kolom.forEach(function (k) { var raw = fH.elements[k[0]].value; v[k[0]] = angka(raw); if (raw.trim()) masukan[k[1]] = raw.trim(); });
      var r = J.hitung(v);
      if (r.kurang) { kurang.textContent = r.kurang; kurang.style.display = "block"; hasil.style.display = "none"; return; }
      kurang.style.display = "none";
      var t = "";
      r.baris.forEach(function (b) { t += '<tr' + (b[2] ? ' class="hk-p"' : "") + '><td>' + esc(b[0]) + '</td><td>' + esc(b[1]) + '</td></tr>'; });
      hasil.querySelector("table").innerHTML = t;
      hasil.style.display = "block";
      terakhir = { masukan: masukan, hasil: r.baris.map(function (b) { return b[0] + (b[1] ? ": " + b[1] : ""); }) };
    });

    var fD = wadah.querySelector(".hk-form"), pesan = wadah.querySelector(".hk-pesan");
    fD.addEventListener("submit", function (e) {
      e.preventDefault();
      if (fD.elements.situs.value) return;                       // isian jebakan robot
      var nama = fD.elements.nama.value.trim(), usaha = fD.elements.usaha.value.trim();
      if (!nama || !usaha) { tampil("Mohon isi nama Anda dan nama usaha.", false); return; }
      var btn = fD.querySelector("button"); btn.disabled = true; btn.textContent = "Mengirim...";
      var kontak = fD.elements.kontak.value.trim();
      var body = {
        namaToko: usaha, namaOwner: nama, kota: fD.elements.kota.value.trim(),
        waOwner: /^[+\d][\d\s().-]{7,}$/.test(kontak) ? kontak : "", kontak: kontak,
        kategori: J.nama, jenisAplikasi: "Halaman hitung " + kode, jalur: kode,
        sumberHalaman: location.pathname, hasilHitung: terakhir
      };
      fetch("/api/daftar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.status === "success", j: j }; }); })
        .then(function (x) {
          if (x.ok) {
            tampil("Terima kasih, " + esc(nama) + ". Data Anda sudah tercatat." + (kontak ? " Tim kami akan menghubungi Anda." : " Anda belum mengisi kontak, jadi kami tidak akan menghubungi Anda."), true);
            fD.reset(); btn.textContent = "Terkirim";
          } else { gagal(); }
        })
        .catch(gagal);
      function gagal() { tampil("Maaf, data belum tersimpan. Mohon coba kirim lagi beberapa saat lagi.", false); btn.disabled = false; btn.textContent = "Kirim lagi"; }
    });
    function tampil(t, ok) { pesan.innerHTML = t; pesan.className = "hk-pesan " + (ok ? "hk-ok" : "hk-gagal"); pesan.style.display = "block"; }
  }

  function mulai() {
    if (!document.getElementById("hk-css")) { var s = el("style", { id: "hk-css" }, CSS); document.head.appendChild(s); }
    Array.prototype.forEach.call(document.querySelectorAll("[data-hitung]"), pasang);
    if (location.hash === "#hitung" || location.hash === "#daftar") { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }
  window.HITUNG_ACT = { angka: angka, JALUR: JALUR };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mulai); else mulai();
})();
