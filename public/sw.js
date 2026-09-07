/* global self, caches, URL, fetch */
const BUILD_COMMIT = self.FLIXO_BUILD_COMMIT || '__FLIXO_COMMIT__';
const CACHE_NAME = `flixo-shell-${BUILD_COMMIT}`;
const LOCALES = ['en', 'ar', 'es', 'fr', 'de', 'hi', 'id', 'it', 'ja', 'ko', 'ms', 'nl', 'pl', 'pt', 'ru', 'sv', 'th', 'tr', 'uk', 'vi'];
const SHELL_ASSETS = ['/', ...LOCALES.map((locale) => `/${locale}`), '/manifest.webmanifest', '/flixo-logo.svg', '/favicon.svg'];

function localeFallback(pathname) {
  const segment = pathname.split('/').filter(Boolean)[0] || '';
  return LOCALES.includes(segment) ? `/${segment}` : '/';
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('flixo-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok && response.type === 'basic') void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached ?? caches.match(localeFallback(url.pathname)))));
});
