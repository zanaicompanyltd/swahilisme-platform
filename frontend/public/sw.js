/* ============================================================
   SwahiliSME Service Worker — 1.8.3 Offline-First PWA
   Caches the app shell and queues transactions when offline
   ============================================================ */

const CACHE_NAME = "swahilisme-v1.0.0";

// Files to cache for offline use (the app shell)
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/static/js/main.chunk.js",
  "/static/js/bundle.js",
  "/static/css/main.chunk.css",
];

// ── Install: cache app shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {
        // Some files may not exist yet during first build — that's fine
        console.log("[SW] Shell cache: some assets not yet available");
      })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────
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

// ── Fetch strategy ────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network-first, queue POST offline
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache new static files as we encounter them
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => caches.match("/index.html"))
  );
});

async function handleApiRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch {
    // Network failed
    if (request.method === "POST") {
      // Queue the transaction for later sync
      const body = await request.json().catch(() => ({}));
      await queueOfflineTransaction(request.url, body);
      return new Response(
        JSON.stringify({
          queued: true,
          offline: true,
          message:
            "Muamala umehifadhiwa kwenye simu yako. Utasawazishwa mtandao ukipatikana. ✅",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return new Response(
      JSON.stringify({ error: "Huna mtandao. Tafadhali jaribu tena baadaye." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ── Offline Queue (uses Cache API as a simple store) ─────────────────────
const QUEUE_CACHE = "swahilisme-offline-queue";

async function queueOfflineTransaction(url, body) {
  const cache = await caches.open(QUEUE_CACHE);
  const key = `queued-${Date.now()}-${Math.random()}`;
  await cache.put(
    key,
    new Response(JSON.stringify({ url, body, timestamp: Date.now() }))
  );
}

// ── Background Sync: flush queue when back online ─────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-transactions") {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue() {
  const cache = await caches.open(QUEUE_CACHE);
  const keys = await cache.keys();
  for (const key of keys) {
    try {
      const response = await cache.match(key);
      const { url, body } = await response.json();
      const result = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (result.ok) {
        await cache.delete(key);
      }
    } catch {
      // Still offline — leave in queue
    }
  }
}
