/* global self, caches, URL, fetch */
const CACHE_NAME = 'flixo-shell-v5';
const SHELL_ASSETS = ['/', '/en', '/manifest.webmanifest', '/flixo-logo.webp', '/flixo-favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isApiRequest = url.pathname.startsWith('/api/');
  const hasAmbientCredentials = event.request.headers.has('cookie') || event.request.headers.has('authorization');
  const isNavigation = event.request.mode === 'navigate';

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cacheControl = response.headers.get('cache-control') ?? '';
        const cacheable = response.ok
          && response.type === 'basic'
          && !isApiRequest
          && !hasAmbientCredentials
          && !isNavigation
          && !/\b(?:no-store|private)\b/iu.test(cacheControl);
        if (cacheable) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => isApiRequest || hasAmbientCredentials
        ? new Response('', { status: 503, statusText: 'Offline and uncached' })
        : caches.match(event.request).then((cached) => cached ?? caches.match('/en'))),
  );
});
