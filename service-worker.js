const CACHE_NAME = "milagro-app-v6";
const SHELL_FILES = [
  "./index.html",
  "./ferm-log.html",
  "./vineyards.html",
  "./styles.css",
  "./common.js",
  "./hub.js",
  "./ferm.js",
  "./vineyards.js",
  "./vineyards-render.js",
  "./manifest.json",
  "./vineyard-bg.jpg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache calls to the Apps Script backend — those need to hit the network
  // (or fail loudly so ferm.js can queue them).
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first: always prefer the live file when there's a connection, so a
  // pushed change (like a fixed CONFIG.API_URL) takes effect on the very next
  // load instead of waiting on cache invalidation. Cache is purely the offline
  // fallback here, not the primary source.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
