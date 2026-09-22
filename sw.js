// Service worker: abre rápido e funciona sem internet.
// Arquivos do site: busca na rede primeiro (sempre a versão mais nova) e usa o cache se estiver offline.
// Biblioteca do Firebase (versão fixa, nunca muda): cache primeiro.
// Os dados do calendário não passam por aqui: o Firebase tem o próprio cache.

const CACHE = 'ens-cal-v1';

const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/imagem.css',
  'css/style.css',
  'js/app.js',
  'js/calendar.js',
  'js/render.js',
  'js/export.js',
  'js/storage.js',
  'js/storage-firebase.js',
  'js/firebase-config.js',
  'js/vendor/html-to-image.js',
  'assets/logo-ens.png',
  'assets/favicon.png',
  'assets/icon-192.png',
  'assets/apple-touch-icon.png',
  'assets/fonts/Poppins-Regular.ttf',
  'assets/fonts/Poppins-Medium.ttf',
  'assets/fonts/Poppins-Bold.ttf',
];

const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then((r) => r ?? (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
    );
    return;
  }

  if (req.url.startsWith(FIREBASE_SDK)) {
    e.respondWith(
      caches.match(req).then((r) => r ?? fetch(req).then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return resp;
      })),
    );
  }
  // Todo o resto (login, banco de dados) vai direto para a rede.
});
