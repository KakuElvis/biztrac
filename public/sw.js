const CACHE_NAME = "biztrac-cache-v1";
const OFFLINE_PAGE = "/offline.html";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/pwa-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function cacheResponse(request, response) {
  if (!response || response.status !== 200 || response.type === "opaque") {
    return response;
  }

  const responseClone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          cacheResponse(request, response);
          return response;
        })
        .catch(() =>
          caches.match("/index.html").then((cachedIndex) => cachedIndex || caches.match(OFFLINE_PAGE))
        )
    );
    return;
  }

  if (
    CORE_ASSETS.includes(url.pathname) ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => cacheResponse(request, response))
          .catch(() => cachedResponse || null);
      })
    );
  }
});
