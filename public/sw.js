// Service worker: opens the app instantly (and offline) from cache, caches team
// logos, and shows score notifications.
//
// - Pages: network first, falling back to the cached app shell when offline
// - /assets/*: cache first (file names are content-hashed, so never stale)
// - ESPN logos: cache first, capped in size
// - ESPN scores: not cached here; the app keeps its own last-known scores

const APP_CACHE = 'app-v1'
const LOGO_CACHE = 'logos-v1'
const MAX_LOGOS = 400

// Cache the app shell and the assets it references
async function cacheAppShell(response) {
  const cache = await caches.open(APP_CACHE)
  const html = await response.clone().text()
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1])
  await cache.put('/', response)
  await Promise.all(assets.map(async (asset) => {
    if (!(await cache.match(asset))) await cache.add(asset)
  }))
  // Drop assets from previous deploys
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname
    if (path.startsWith('/assets/') && !assets.includes(path)) await cache.delete(request)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(fetch('/', { cache: 'no-store' }).then(cacheAppShell).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  const keep = [APP_CACHE, LOGO_CACHE]
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => !keep.includes(n)).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

async function trimLogoCache(cache) {
  const keys = await cache.keys()
  for (const request of keys.slice(0, Math.max(0, keys.length - MAX_LOGOS))) await cache.delete(request)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok && url.pathname === '/') event.waitUntil(cacheAppShell(response.clone()))
        return response
      } catch {
        return (await caches.match('/')) || Response.error()
      }
    })())
    return
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(APP_CACHE)
        event.waitUntil(cache.put(request, response.clone()))
      }
      return response
    })())
    return
  }

  if (url.hostname === 'a.espncdn.com') {
    event.respondWith((async () => {
      const cache = await caches.open(LOGO_CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      // Opaque (no-cors) image responses can't be inspected, so cache those too
      if (response.ok || response.type === 'opaque') {
        event.waitUntil(cache.put(request, response.clone()).then(() => trimLogoCache(cache)))
      }
      return response
    })())
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data ? event.data.text() : 'Score update' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Score update', {
      body: data.body || '',
      // One notification per game: each update replaces the previous one
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: '/apple-touch-icon.png',
      badge: '/apple-touch-icon.png',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(w => w.url.startsWith(self.location.origin))
    if (existing) return existing.focus()
    return self.clients.openWindow(target)
  })())
})
