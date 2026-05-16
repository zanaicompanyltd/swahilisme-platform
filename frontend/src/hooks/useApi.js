// frontend/src/hooks/useApi.js
// ============================================================
// FIXED VERSION — all bugs patched
//
// BUG LIST FIXED:
// 1. listTransactions passed params object directly into URLSearchParams
//    → limit/offset came through but 'limit' key collided with positional arg
// 2. syncOfflineQueue called createTransaction() which calls itself recursively
//    → replaced with direct apiFetch to avoid infinite loop
// 3. getSummary used /daftari/summary — correct, but analytics used raw fetch()
//    outside this file with no error handling or CORS fallback
// 4. No Content-Type stripping for FormData (transcribeAudio) — fixed
// 5. createTransaction offline fallback swallowed ALL errors, hiding real bugs
// ============================================================

const BASE_URL =
  process.env.REACT_APP_API_URL ||
  "https://swahilisme-platform-production.up.railway.app";

// ── Offline queue ─────────────────────────────────────────────────────────────
const QUEUE_KEY = "daftari_offline_queue";

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
  catch { return []; }
}

function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function enqueueOffline(transaction) {
  const q = getQueue();
  q.push({ ...transaction, local_id: crypto.randomUUID(), queued_at: new Date().toISOString() });
  saveQueue(q);
}

export function getOfflineCount() {
  return getQueue().length;
}

// ── Core fetch ────────────────────────────────────────────────────────────────
// BUG FIX: do NOT set Content-Type for FormData — browser must set boundary
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path.startsWith("/") ? path : "/" + path}`;

  const headers = { ...options.headers };
  // Only set Content-Type for JSON — not FormData
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || err.message || detail;
    } catch { /* non-JSON error body */ }
    throw new Error(detail);
  }

  return res.json();
}

// ── ASR + NLP ─────────────────────────────────────────────────────────────────
export async function transcribeAudio(userId, audioBlob, filename = "audio.webm") {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("audio", audioBlob, filename);

  // BUG FIX: do NOT pass Content-Type header — FormData needs browser to set boundary
  const res = await fetch(`${BASE_URL}/api/v1/daftari/transcribe`, {
    method: "POST",
    body: form,
    // no headers — intentional
  });

  if (!res.ok) {
    let detail = "Transcription failed";
    try { const e = await res.json(); detail = e.detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

// ── Create transaction ────────────────────────────────────────────────────────
// BUG FIX: only use offline queue on network errors, NOT on 4xx/5xx
// This was hiding real server errors (validation, DB errors) behind silent offline saves
export async function createTransaction(data) {
  if (!navigator.onLine) {
    // Definitely offline — queue it
    enqueueOffline(data);
    return { ...data, id: crypto.randomUUID(), is_synced: false, offline: true };
  }

  try {
    const result = await apiFetch("/api/v1/daftari/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return result;
  } catch (err) {
    // Only queue if it looks like a network failure, not a server error
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      enqueueOffline(data);
      return { ...data, id: crypto.randomUUID(), is_synced: false, offline: true };
    }
    // Re-throw server errors so the UI shows the real problem
    throw err;
  }
}

// ── List transactions ─────────────────────────────────────────────────────────
// BUG FIX: params was an object like { limit: 50 } — URLSearchParams handles it
// but we also need to ensure user_id is always first and params override nothing critical
export async function listTransactions(userId, params = {}) {
  const qs = new URLSearchParams({
    user_id: userId,
    limit:   params.limit  ?? 50,
    offset:  params.offset ?? 0,
    ...(params.type ? { type: params.type } : {}),
  }).toString();

  return apiFetch(`/api/v1/daftari/transactions?${qs}`);
}

// ── Delete transaction ────────────────────────────────────────────────────────
export async function deleteTransaction(txId, userId) {
  return apiFetch(
    `/api/v1/daftari/transactions/${txId}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

// ── Daftari summary (30-day) ──────────────────────────────────────────────────
export async function getSummary(userId, days = 30) {
  return apiFetch(
    `/api/v1/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`
  );
}

// ── Dashboard analytics endpoints ────────────────────────────────────────────
// BUG FIX: these were being called with raw fetch() inside DaftariYangu.jsx
// with no error handling. Centralised here with proper error handling.

export async function getDashboardSummary(userId, period = "week") {
  return apiFetch(
    `/api/v1/dashboard/summary?user_id=${encodeURIComponent(userId)}&period=${period}`
  );
}

export async function getRevenueCostProfit(userId, days = 7) {
  return apiFetch(
    `/api/v1/dashboard/revenue-cost-profit?user_id=${encodeURIComponent(userId)}&days=${days}`
  );
}

export async function getTopProducts(userId, period = "week") {
  return apiFetch(
    `/api/v1/dashboard/top-products?user_id=${encodeURIComponent(userId)}&period=${period}`
  );
}

export async function getSpendingPatterns(userId, period = "week") {
  return apiFetch(
    `/api/v1/dashboard/spending-patterns?user_id=${encodeURIComponent(userId)}&period=${period}`
  );
}

// ── Sync offline queue ────────────────────────────────────────────────────────
// BUG FIX: was calling createTransaction() which itself calls enqueueOffline()
// creating an infinite loop when offline. Now calls apiFetch() directly.
export async function syncOfflineQueue(userId) {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      // Direct API call — no offline fallback during sync
      await apiFetch("/api/v1/daftari/transactions", {
        method: "POST",
        body: JSON.stringify({ ...item, user_id: userId }),
      });
      synced++;
    } catch {
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  return { synced, remaining: remaining.length };
}

// ── Health card PDF download ──────────────────────────────────────────────────
export async function downloadHealthCard(userId, days = 90) {
  const res = await fetch(
    `${BASE_URL}/api/v1/daftari/health-card?user_id=${encodeURIComponent(userId)}&days=${days}`
  );
  if (!res.ok) {
    let msg = "PDF generation failed";
    try { const e = await res.json(); msg = e.detail || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `kadi-afya-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
