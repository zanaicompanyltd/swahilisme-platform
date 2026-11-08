/* ============================================================
   SwahiliSME Service Worker — 1.8.3 Offline-First PWA
   Caches the app shell and queues transactions when offline
   ============================================================ */

// Bump this on releases that change app identity/auth behavior. Activation
// removes the prior cache, including stale per-device app shells.
const CACHE_NAME = "swahilisme-v1.0.1";

// CRA emits content-hashed JS/CSS names, so they are cached as encountered.
// Keep only the documents needed to launch the app while offline.
const SHELL_ASSETS = ["/", "/index.html", "/manifest.json"];

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

  // Always fetch HTML documents first. A cache-first index.html can keep an
  // old JavaScript bundle (and old account-ID logic) alive on a device after a
  // Vercel deployment. Keep the latest app shell cached only as an offline
  // fallback.
  if (request.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request))
            || (await cache.match("/index.html"))
            || (await cache.match("/"))
            || new Response("Huna mtandao. Fungua programu ukiwa mtandaoni mara moja kisha ujaribu tena.", { status: 503 });
        })
    );
    return;
  }

  // Content-hashed JS/CSS and other static files: cache-first is safe because
  // a changed build receives a new URL. Cache new assets as we encounter them.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
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
