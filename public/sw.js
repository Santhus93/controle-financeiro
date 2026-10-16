// Service worker do Minha Fatura.
// Guarda apenas os arquivos do próprio app (HTML, JS, CSS, ícones).
// Dados financeiros (Firebase/Firestore) NUNCA passam pelo cache.

const CACHE = 'minha-fatura-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Somente GET do mesmo domínio. Firebase, Google Fonts etc. seguem direto para a rede.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Páginas: rede primeiro, cache como reserva offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./'))),
    )
    return
  }

  // Arquivos estáticos (têm hash no nome): cache primeiro.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
