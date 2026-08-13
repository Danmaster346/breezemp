/* Kupiks service worker: офлайн-страница, кэш статики и картинок */
const VERSION = "kupiks-v1";
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/manifest.json", "/favicon.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isImage(request, url) {
  return request.destination === "image" || /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(url.pathname);
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_build/") ||
    url.pathname.startsWith("/assets/") ||
    /\.(js|css|woff2?)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Никогда не кэшируем API/серверные функции и авторизацию
  if (sameOrigin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn"))) {
    return;
  }

  // Навигация: сеть с фолбэком на кэш и офлайн-страницу (stale-while-revalidate)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(PAGE_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Статика: cache-first
  if (sameOrigin && isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Картинки (в том числе из хранилища): cache-first с ограничением объёма
  if (isImage(request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            cache.put(request, fresh.clone());
            const keys = await cache.keys();
            if (keys.length > 120) await cache.delete(keys[0]);
          }
          return fresh;
        } catch {
          return cached ?? Response.error();
        }
      })(),
    );
  }
});
