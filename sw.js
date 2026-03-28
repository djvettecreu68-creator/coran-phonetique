// ─── Coran Phonétique — Service Worker ───────────────────────────────────────
const CACHE_NAME = 'coran-phonetique-v1';
const AUDIO_CACHE = 'coran-audio-v1';

// Fichiers à mettre en cache immédiatement au premier chargement
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// ── Installation ──────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des ressources statiques');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activation & nettoyage des anciens caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== AUDIO_CACHE)
            .map(k => { console.log('[SW] Suppression ancien cache:', k); return caches.delete(k); })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Stratégie de fetch ────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Audio Alafasy : Cache-first, puis réseau si absent
  if (url.hostname.includes('everyayah') || url.pathname.match(/\.(mp3|ogg|wav)$/i)) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then((cache) => {
        return cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => new Response('', { status: 503 }));
        });
      })
    );
    return;
  }

  // Google Fonts & autres CDN : Network-first, fallback cache
  if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Ressources statiques (HTML, JS, CSS, manifest) : Cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        // Hors-ligne : retourner l'app principale
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return new Response('Hors-ligne', { status: 503 });
      });
    })
  );
});
