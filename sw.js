// Service Worker: macht die App offline nutzbar.
// Die Seite selbst (index.html) wird bei jedem Start zuerst aus dem Netz geholt,
// damit Updates sofort erscheinen. Ohne Internet (oder bei sehr langsamer
// Verbindung) wird die gespeicherte Kopie benutzt.
// Bei Änderungen an den Dateien die Versionsnummer erhöhen (z. B. v10).
const CACHE = 'sitzplan-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // cache:'reload' umgeht den Browser-Zwischenspeicher, damit sicher die neuen Dateien abgelegt werden
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Seite: erst Netz (max. 3,5 s), sonst gespeicherte Kopie
  if (req.mode === 'navigate' || req.destination === 'document') {
    const net = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    });
    const timeout = new Promise((_, rej) => setTimeout(rej, 3500));
    e.respondWith(
      Promise.race([net, timeout]).catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(r => r || caches.match('./index.html'))
          .then(r => r || caches.match('./'))
          .then(r => r || net)
      )
    );
    return;
  }

  // Icons, Manifest: aus dem Speicher, im Hintergrund aktualisieren
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const refresh = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || refresh;
    })
  );
});
