/* service-worker.js
 * App-shell caching (cache-first) + runtime caching for weather API calls
 * (network-first, falling back to cache when offline).
 */
'use strict';

const CACHE_VERSION = 'aura-weather-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './scraper.js',
  './storage.js',
  './ui.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('aura-weather-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isWeatherApiRequest(url) {
  return (
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('weahunter.com') ||
    url.hostname.includes('geocoding-api')
  );
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Runtime (network-first) caching for weather API + geocoding requests,
  // so the last successful response is available offline.
  if (isWeatherApiRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell: cache-first.
  if (event.request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => cached);
      })
    );
  }
});
