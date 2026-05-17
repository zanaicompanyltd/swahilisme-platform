/**
 * useApi.js — SwahiliSME Platform API client
 *
 * ROOT FIX: Backend returns error detail as EITHER:
 *   - plain string:  "Nambari si sahihi"
 *   - object:        {"sw": "Msimbo si sahihi.", "en": "Invalid code."}
 *
 * Old code:  throw new Error(err.detail)
 * Problem:   When detail is an object → "[object Object]"
 * Fix:       extractError() handles both cases safely.
 */
// frontend/src/hooks/useApi.js
// ============================================================
// FIXED VERSION
// - BASE_URL points to local backend (change for production)
// - Dashboard endpoints redirected to daftari endpoints
// - All bugs from previous version kept fixed
// ============================================================

const BASE_URL =
  process.env.REACT_APP_API_URL ||
  "http://localhost:8000";  // ← YOUR local backend

// ── Offline queue ─────────────────────────────────────────────────────────────
const QUEUE_KEY = "daftari_offline_queue";
const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ── Offline queue ─────────────────────────────────────────────────────────────
const OFFLINE_QUEUE_KEY = "daftari_offline_queue";
function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]"); }
  catch { return []; }
}
function saveOfflineQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
  catch { return []; }
}
export function getOfflineCount() { return getOfflineQueue().length; }

function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function enqueueOffline(transaction) {
  const q = getQueue();
  q.push({ ...transaction, local_id: crypto.randomUUID(), queued_at: new Date().toISOString() });
  saveQueue(q);
// ── THE FIX ───────────────────────────────────────────────────────────────────
// Safely extract a readable error string from any backend detail shape
function extractError(detail, lang = "sw") {
  if (!detail) return "Hitilafu isiyojulikana.";
  if (typeof detail === "string") return detail;
  if (typeof detail === "object") {
    return detail[lang] || detail.sw || detail.en
      || Object.values(detail)[0]
      || "Hitilafu imetokea.";
  }
  return String(detail);
}

export function getOfflineCount() {
  return getQueue().length;
}

// ── Core fetch ────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path.startsWith("/") ? path : "/" + path}`;

  const headers = { ...options.headers };
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });

// ── Generic fetch wrapper ─────────────────────────────────────────────────────
async function apiFetch(path, options = {}, lang = "sw") {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractError(err.detail, lang));
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || err.message || detail;
    } catch {}
    throw new Error(detail);
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

/** Step 1 — Request OTP  POST /auth/send-otp */
export async function sendOTP(phoneNumber, lang = "sw") {
  const res = await fetch(`${BASE_URL}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, delivery_method: "sms", lang, purpose: "login" }),
  });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail, lang));
  return {
    message:         extractError(data.message, lang),
    delivery_method: data.delivery_method,
    phone:           data.phone,
    otp:             data.otp, // sandbox only
  };
}

  if (!res.ok) {
    let detail = "Transcription failed";
    try { const e = await res.json(); detail = e.detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
/** Step 2 — Verify OTP  POST /auth/verify-otp */
export async function verifyOTP(phoneNumber, code, lang = "sw") {
  const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, code, purpose: "login" }),
  });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail, lang));
  return data; // { access_token, refresh_token, user } or { needs_registration: true }
}

/** Step 3 (new users) — Register  POST /auth/register */
export async function registerUser(payload, lang = "sw") {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail, lang));
  return { ...data, message: extractError(data.message, lang) };
}

// ── Create transaction ────────────────────────────────────────────────────────
export async function createTransaction(data) {
  if (!navigator.onLine) {
    enqueueOffline(data);
    return { ...data, id: crypto.randomUUID(), is_synced: false, offline: true };
  }

  try {
    return await apiFetch("/api/v1/daftari/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      enqueueOffline(data);
      return { ...data, id: crypto.randomUUID(), is_synced: false, offline: true };
    }
    throw err;
  }
/** GET /auth/me */
export async function getMe(accessToken) {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail));
  return data;
}

/** POST /auth/refresh */
export async function refreshToken(token) {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: token }),
  });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail));
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAFTARI YANGU
// ─────────────────────────────────────────────────────────────────────────────

export async function transcribeAudio(audioBlob, userId) {
  const formData = new FormData();
  const ext = audioBlob.type.includes("ogg") ? "ogg" : audioBlob.type.includes("mp4") ? "mp4" : "webm";
  formData.append("audio", audioBlob, `recording.${ext}`);
  const res = await fetch(`${BASE_URL}/daftari/voice?user_id=${encodeURIComponent(userId)}`, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail));
  return data;
}

// ── List transactions ─────────────────────────────────────────────────────────
export async function listTransactions(userId, params = {}) {
  const qs = new URLSearchParams({
    user_id: userId,
    limit:   params.limit  ?? 50,
    offset:  params.offset ?? 0,
    ...(params.type ? { type: params.type } : {}),
  }).toString();

  return apiFetch(`/api/v1/daftari/transactions?${qs}`);
export async function createTransaction(payload) {
  if (!navigator.onLine) {
    const queue = getOfflineQueue();
    queue.push({ ...payload, _queued_at: new Date().toISOString() });
    saveOfflineQueue(queue);
    return { success: true, offline: true, message: "Rekodi imehifadhiwa nje ya mtandao.", transaction: { ...payload, id: `offline_${Date.now()}` } };
  }
  return apiFetch("/daftari/text", { method: "POST", body: JSON.stringify(payload) });
}

export async function listTransactions(userId, { limit = 50, offset = 0, type } = {}) {
  let path = `/daftari/transactions?user_id=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}`;
  if (type) path += `&transaction_type=${type}`;
  return apiFetch(path);
}

// ── Delete transaction ────────────────────────────────────────────────────────
export async function deleteTransaction(txId, userId) {
  return apiFetch(
    `/api/v1/daftari/transactions/${txId}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
  return apiFetch(`/daftari/transactions/${txId}?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" });
}

// ── Daftari summary ───────────────────────────────────────────────────────────
export async function getSummary(userId, days = 30) {
  return apiFetch(`/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`);
  return apiFetch(
    `/api/v1/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`
  );
}

// ── Dashboard analytics ───────────────────────────────────────────────────────
// These map to YOUR daftari endpoints — no separate dashboard needed

export async function getDashboardSummary(userId, period = "week") {
  // Map period to days
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  return apiFetch(
    `/api/v1/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`
  );
}

export async function getRevenueCostProfit(userId, days = 7) {
  // Get summary and transactions to build chart data
  const [summary, txs] = await Promise.all([
    apiFetch(`/api/v1/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`),
    apiFetch(`/api/v1/daftari/transactions?user_id=${encodeURIComponent(userId)}&limit=200`),
  ]);

  // Build daily chart data from transactions
  const dayMap = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("sw-TZ", { weekday: "short" });
    dayMap[key] = { label, revenue: 0, cost: 0, profit: 0 };
  }

export async function downloadHealthCard(userId, businessName, ownerName) {
  const params = new URLSearchParams({ user_id: userId, business_name: businessName || "Biashara Yangu", owner_name: ownerName || "Mmiliki" });
  const res = await fetch(`${BASE_URL}/daftari/health-card/download?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractError(err.detail));
  for (const tx of (txs || [])) {
    const key = (tx.transaction_date || tx.created_at || "").slice(0, 10);
    if (dayMap[key]) {
      if (tx.type === "mapato")  dayMap[key].revenue += tx.amount;
      if (tx.type === "gharama") dayMap[key].cost    += tx.amount;
      dayMap[key].profit = dayMap[key].revenue - dayMap[key].cost;
    }
  }

  const entries = Object.values(dayMap);
  return {
    labels:  entries.map((e) => e.label),
    revenue: entries.map((e) => e.revenue),
    cost:    entries.map((e) => e.cost),
    profit:  entries.map((e) => e.profit),
    summary,
  };
}

export async function getTopProducts(userId, period = "week") {
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  const data = await apiFetch(
    `/api/v1/daftari/top-products?user_id=${encodeURIComponent(userId)}&days=${days}`
  );
  // Normalise to { products: [...] } shape the frontend expects
  return { products: Array.isArray(data) ? data : [] };
}

export async function getSpendingPatterns(userId, period = "week") {
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  const data = await apiFetch(
    `/api/v1/daftari/spending?user_id=${encodeURIComponent(userId)}&days=${days}`
  );
  // Normalise to { categories: [...] } shape the frontend expects
  return { categories: Array.isArray(data) ? data : [] };
}

// ── Sync offline queue ────────────────────────────────────────────────────────
export async function syncOfflineQueue(userId) {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    try {
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `health_card_${userId}.pdf`; a.click();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `kadi-afya-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { success: true };
}

export async function getHealthCardStatus(userId) {
  return apiFetch(`/daftari/health-card/status?user_id=${encodeURIComponent(userId)}`);
}

export async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (!queue.length) return { synced: 0 };
  const results = await Promise.allSettled(queue.map((item) => apiFetch("/daftari/text", { method: "POST", body: JSON.stringify(item) })));
  const synced = results.filter((r) => r.status === "fulfilled").length;
  const remaining = queue.filter((_, i) => results[i].status === "rejected");
  saveOfflineQueue(remaining);
  return { synced, failed: results.length - synced, remaining: remaining.length };
}