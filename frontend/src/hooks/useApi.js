/**
 * useApi.js — SwahiliSME Platform API client
 */

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ── Offline queue ─────────────────────────────────────────────────────────────
const OFFLINE_QUEUE_KEY = "daftari_offline_queue";

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]"); }
  catch { return []; }
}

function saveOfflineQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function getOfflineCount() {
  return getOfflineQueue().length;
}

export function enqueueOffline(transaction) {
  const queue = getOfflineQueue();
  queue.push({ ...transaction, local_id: crypto.randomUUID(), queued_at: new Date().toISOString() });
  saveOfflineQueue(queue);
}

// ── Error extractor ───────────────────────────────────────────────────────────
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

// ── Core fetch ────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}, lang = "sw") {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractError(err.detail, lang));
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

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
    otp:             data.otp,
  };
}

export async function verifyOTP(phoneNumber, code, lang = "sw") {
  const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, code, purpose: "login" }),
  });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail, lang));
  return data;
}

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

export async function getMe(accessToken) {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail));
  return data;
}

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
  const res = await fetch(`${BASE_URL}/daftari/voice?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail));
  return data;
}

export async function createTransaction(payload) {
  if (!navigator.onLine) {
    enqueueOffline(payload);
    return {
      success: true,
      offline: true,
      message: "Rekodi imehifadhiwa nje ya mtandao.",
      transaction: { ...payload, id: `offline_${Date.now()}` },
    };
  }
  try {
    // KAMA payload ina ufunguo wa 'text', inamaanisha ni NLP (kutoka kwenye AI input)
    if (payload.text) {
      return await apiFetch("/daftari/text", { method: "POST", body: JSON.stringify(payload) });
    }
    
    // KAMA payload haina 'text' bali ina 'amount' na 'category', tuma kwenye endpoint ya miamala ya kawaida
    // Hii itazuia kosa la 422 kwa sababu hapa tunapita kwenye endpoint inayouelewa muundo huu!
    return await apiFetch(`/daftari/transactions?user_id=${encodeURIComponent(payload.user_id)}`, { 
      method: "POST", 
      body: JSON.stringify(payload) 
    });
  } catch (err) {
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      enqueueOffline(payload);
      return {
        success: true,
        offline: true,
        message: "Rekodi imehifadhiwa nje ya mtandao.",
        transaction: { ...payload, id: `offline_${Date.now()}` },
      };
    }
    throw err;
  }
}

export async function listTransactions(userId, { limit = 50, offset = 0, type } = {}) {
  let path = `/daftari/transactions?user_id=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}`;
  if (type) path += `&transaction_type=${type}`;
  return apiFetch(path);
}

export async function deleteTransaction(txId, userId) {
  return apiFetch(`/daftari/transactions/${txId}?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export async function getSummary(userId, days = 30) {
  return apiFetch(`/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`);
}

// ── Dashboard analytics ───────────────────────────────────────────────────────

export async function getDashboardSummary(userId, period = "week") {
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  return apiFetch(`/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`);
}

export async function getRevenueCostProfit(userId, days = 7) {
  const [summary, txs] = await Promise.all([
    apiFetch(`/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`),
    apiFetch(`/daftari/transactions?user_id=${encodeURIComponent(userId)}&limit=200`),
  ]);

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
  const data = await apiFetch(`/daftari/top-products?user_id=${encodeURIComponent(userId)}&days=${days}`);
  return { products: Array.isArray(data) ? data : [] };
}

export async function getSpendingPatterns(userId, period = "week") {
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  const data = await apiFetch(`/daftari/spending?user_id=${encodeURIComponent(userId)}&days=${days}`);
  return { categories: Array.isArray(data) ? data : [] };
}

// ── Health card ───────────────────────────────────────────────────────────────

export async function downloadHealthCard(userId, days = 90) {
  const res = await fetch(
    `${BASE_URL}/daftari/health-card/download?user_id=${encodeURIComponent(userId)}&days=${days}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractError(err.detail));
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
  return { success: true };
}

export async function getHealthCardStatus(userId) {
  return apiFetch(`/daftari/health-card/status?user_id=${encodeURIComponent(userId)}`);
}

// ── Sync offline queue ────────────────────────────────────────────────────────

export async function syncOfflineQueue(userId) {
  const queue = getOfflineQueue();
  if (!queue.length) return { synced: 0, failed: 0, remaining: 0 };

  const results = await Promise.allSettled(
    queue.map((item) =>
      apiFetch("/daftari/text", { method: "POST", body: JSON.stringify({ ...item, user_id: userId }) })
    )
  );

  const synced    = results.filter((r) => r.status === "fulfilled").length;
  const remaining = queue.filter((_, i) => results[i].status === "rejected");
  saveOfflineQueue(remaining);
  return { synced, failed: results.length - synced, remaining: remaining.length };
}
