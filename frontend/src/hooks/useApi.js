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
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path.startsWith("/") ? path : "/" + path}`;

  const headers = { ...options.headers };
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || err.message || detail;
    } catch {}
    throw new Error(detail);
  }

  return res.json();
}

// ── ASR + NLP ─────────────────────────────────────────────────────────────────
export async function transcribeAudio(userId, audioBlob, filename = "audio.webm") {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("audio", audioBlob, filename);

  const res = await fetch(`${BASE_URL}/api/v1/daftari/transcribe`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let detail = "Transcription failed";
    try { const e = await res.json(); detail = e.detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
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
}

// ── Delete transaction ────────────────────────────────────────────────────────
export async function deleteTransaction(txId, userId) {
  return apiFetch(
    `/api/v1/daftari/transactions/${txId}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

// ── Daftari summary ───────────────────────────────────────────────────────────
export async function getSummary(userId, days = 30) {
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
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `kadi-afya-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
