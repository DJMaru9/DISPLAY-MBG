/**
 * Service worker — Monitor Distribusi SPPG Bantaeng Gantarangkeke
 *
 * Aturan singkat:
 * - Data ke Apps Script TIDAK PERNAH disimpan di cache. Status distribusi harus
 *   selalu diambil langsung dari server, dan kalau gagal biar ditangani antrean
 *   di dalam aplikasi.
 * - Kerangka aplikasi (HTML, ikon, font) disimpan supaya tetap terbuka
 *   walau sinyal hilang di tengah jalan.
 *
 * Kalau file HTML diperbarui, naikkan angka VERSI di bawah supaya cache lama
 * dibuang dan pengantar tidak tertinggal versi lama.
 */

var VERSI = 'monitor-sppg-v2';

var INTI = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSI)
      .then(function (c) { return c.addAll(INTI); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* satu file gagal jangan sampai membatalkan pemasangan */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (nama) {
        return Promise.all(nama.map(function (n) {
          return n === VERSI ? null : caches.delete(n);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Apps Script: selalu langsung ke jaringan, tidak pernah disimpan
  if (url.hostname.indexOf('google.com') > -1 || url.hostname.indexOf('googleusercontent.com') > -1) {
    return;
  }

  // Halaman: coba jaringan dulu supaya versi terbaru terpakai, cache sebagai cadangan
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var salinan = res.clone();
          caches.open(VERSI).then(function (c) { c.put('./index.html', salinan); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (r) {
            return r || caches.match('./');
          });
        })
    );
    return;
  }

  // Sisanya (ikon, font): cache dulu, ambil jaringan kalau belum ada
  e.respondWith(
    caches.match(req).then(function (tersimpan) {
      if (tersimpan) return tersimpan;
      return fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var salinan = res.clone();
          caches.open(VERSI).then(function (c) { c.put(req, salinan); });
        }
        return res;
      }).catch(function () { return tersimpan; });
    })
  );
});

// Dipakai aplikasi untuk memaksa pembaruan tanpa menunggu tab lain ditutup
self.addEventListener('message', function (e) {
  if (e.data === 'perbarui') self.skipWaiting();
});
