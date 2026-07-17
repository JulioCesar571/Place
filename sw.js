// ═══════════════════════════════════════════════════════════════
// PLACE — SERVICE WORKER
// Estratégia: rede primeiro para o app (atualizações chegam sempre),
// cache como reserva para abrir offline; APIs nunca são cacheadas.
// ═══════════════════════════════════════════════════════════════
const CACHE = 'place-v1';
const APP_SHELL = [
  './',
  './index.html',
  './icon-192.png',
  './icon-512.png'
];

// Instala: guarda o esqueleto do app
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// Ativa: remove caches de versões antigas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // APIs dinâmicas (banco, licença): sempre rede, nunca cache
  if (url.includes('supabase.co') || url.includes('gist.githubusercontent')) {
    return; // deixa o navegador tratar normalmente
  }

  // Navegação/HTML: rede primeiro (pega atualizações), cache se offline
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Demais recursos (bibliotecas CDN, fontes, ícones): cache primeiro,
  // buscando na rede e guardando quando ainda não estiver salvo
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        // Só cacheia respostas válidas de GET
        if (e.request.method === 'GET' && res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
