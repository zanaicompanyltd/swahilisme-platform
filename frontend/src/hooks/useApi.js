/**
 * useApi.js — SwahiliSME Platform API client
 * Stack: Vercel (frontend) + Railway (backend) + Supabase (database)
 *
 * Setup: create a .env file in your React project root with:
 *   REACT_APP_API_URL=https://your-backend.up.railway.app
 */

const BASE_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:8000"
).replace(/\/$/, ""); // strip trailing slash

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
  queue.push({
    ...transaction,
    local_id:  crypto.randomUUID(),
    queued_at: new Date().toISOString(),
  });
  saveOfflineQueue(queue);
}

// ── Error extractor ───────────────────────────────────────────────────────────
function extractError(detail, lang = "sw") {
  if (!detail) return "Hitilafu isiyojulikana.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors are arrays of objects
    return detail.map((e) => e.msg || JSON.stringify(e)).join(", ");
  }
  if (typeof detail === "object") {
    return detail[lang] || detail.sw || detail.en
      || Object.values(detail)[0]
      || "Hitilafu imetokea.";
  }
  return String(detail);
}

// ── Core fetch ────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}, lang = "sw") {
  const url = `${BASE_URL}${path}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch (networkErr) {
    // Network failure (offline, CORS, wrong URL, etc.)
    throw new Error(`Failed to fetch: ${url} — ${networkErr.message}`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractError(err.detail, lang));
  }
  return res.json();
}

// ── Network check helper ──────────────────────────────────────────────────────
function isNetworkError(err) {
  const msg = err?.message || "";
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Network request failed") ||
    !navigator.onLine
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export async function sendOTP(phoneNumber, lang = "sw") {
  const res = await fetch(`${BASE_URL}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone_number:    phoneNumber,
      delivery_method: "sms",
      lang,
      purpose:         "login",
    }),
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
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${accessToken}`,
    },
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
// DAFTARI YANGU — TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * transcribeAudio — send voice blob to backend for ASR + NLP
 * NOTE: parameter order is (userId, audioBlob) to match DaftariYangu.jsx call:
 *   transcribeAudio(USER_ID, blob, "audio.webm")
 */
export async function transcribeAudio(userId, audioBlob, filename = "audio.webm") {
  const formData = new FormData();

  // Pick the right extension from the blob's MIME type
  let ext = "webm";
  if (audioBlob.type.includes("ogg"))  ext = "ogg";
  else if (audioBlob.type.includes("mp4")) ext = "mp4";
  const fname = filename || `recording.${ext}`;

  formData.append("audio",   audioBlob, fname);
  formData.append("user_id", userId);

  let res;
  try {
    res = await fetch(`${BASE_URL}/daftari/transcribe`, {
      method: "POST",
      body:   formData,
      // Do NOT set Content-Type header — browser sets it with boundary automatically
    });
  } catch (networkErr) {
    throw new Error(`Failed to fetch: ${networkErr.message}`);
  }

  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractError(data.detail));
  return data;
}

/**
 * createTransaction — handles both:
 *   1. Manual form entry  → payload has { user_id, type, category, amount, ... }
 *   2. Text/NLP entry     → payload has { user_id, text }
 *
 * Both go to /daftari/text which runs NLP and saves to DB.
 * The backend /daftari/text endpoint MUST save the transaction (see daftari.py fix).
 */
export async function createTransaction(payload) {
  // Offline: queue and return immediately
  if (!navigator.onLine) {
    enqueueOffline(payload);
    return {
      success:     true,
      offline:     true,
      message:     "Rekodi imehifadhiwa nje ya mtandao.",
      transaction: { ...payload, id: `offline_${Date.now()}` },
    };
  }

  try {
    // Case 1: payload already has a 'text' field (from voice/NLP pipeline)
    if (payload.text) {
      return await apiFetch("/daftari/text", {
        method: "POST",
        body:   JSON.stringify({
          user_id: payload.user_id,
          text:    payload.text,
        }),
      });
    }

    // Case 2: manual form entry — build a natural language sentence
    // so /daftari/text can process it, OR send directly to /daftari/transactions
    const amount   = parseFloat(payload.amount) || 0;
    const typeWord = payload.type === "mapato" ? "mapato" : "gharama";

    // Build a text sentence the NLP can parse
    const textSentence = [
      typeWord === "mapato" ? "Nimepata" : "Nimetumia",
      `shilingi ${amount}`,
      `kwa ajili ya ${payload.category || "biashara"}`,
      payload.product_name ? `- ${payload.product_name}` : "",
      payload.description   ? `- ${payload.description}` : "",
    ].filter(Boolean).join(" ");

    // Send to /daftari/text with full context so backend can save correctly
    return await apiFetch("/daftari/text", {
      method: "POST",
      body:   JSON.stringify({
        user_id:          payload.user_id,
        text:             textSentence,
        // Pass structured fields too so backend can use them directly
        // without relying purely on NLP extraction
        _type:            payload.type,
        _category:        payload.category,
        _amount:          amount,
        _product_name:    payload.product_name || null,
        _description:     payload.description  || null,
        _transaction_date: payload.transaction_date || null,
        _quantity:        payload.quantity     || null,
      }),
    });

  } catch (err) {
    if (isNetworkError(err)) {
      enqueueOffline(payload);
      return {
        success:     true,
        offline:     true,
        message:     "Rekodi imehifadhiwa nje ya mtandao.",
        transaction: { ...payload, id: `offline_${Date.now()}` },
      };
    }
    throw err;
  }
}

export async function listTransactions(userId, { limit = 50, offset = 0, type } = {}) {
  let path = `/daftari/transactions?user_id=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}`;
  if (type) path += `&transaction_type=${encodeURIComponent(type)}`;
  return apiFetch(path);
}

export async function deleteTransaction(txId, userId) {
  return apiFetch(
    `/daftari/transactions/${txId}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

export async function getSummary(userId, days = 30) {
  return apiFetch(`/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`);
}

// ── Dashboard analytics ───────────────────────────────────────────────────────

export async function getDashboardSummary(userId, period = "week") {
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  return apiFetch(`/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`);
}

/**
 * getRevenueCostProfit — builds daily chart data from transactions list
 * Falls back to zeros if transactions endpoint fails (shows empty chart, not error)
 */
export async function getRevenueCostProfit(userId, days = 7) {
  // Build the day map first so we always return something
  const dayMap = {};
  const now    = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date(now);
    d.setDate(now.getDate() - i);
    const key   = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("sw-TZ", { weekday: "short" });
    dayMap[key] = { label, revenue: 0, cost: 0, profit: 0 };
  }

  try {
    const [summary, txs] = await Promise.all([
      apiFetch(`/daftari/summary?user_id=${encodeURIComponent(userId)}&days=${days}`),
      apiFetch(`/daftari/transactions?user_id=${encodeURIComponent(userId)}&limit=200`),
    ]);

    for (const tx of (Array.isArray(txs) ? txs : [])) {
      const key = (tx.transaction_date || tx.created_at || "").slice(0, 10);
      if (dayMap[key]) {
        const amt = parseFloat(tx.amount) || 0;
        if (tx.type === "mapato")  { dayMap[key].revenue += amt; }
        if (tx.type === "gharama") { dayMap[key].cost    += amt; }
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
  } catch (err) {
    // Don't throw — return empty data so Takwimu tab still renders
    console.warn("getRevenueCostProfit error:", err.message);
    const entries = Object.values(dayMap);
    return {
      labels:  entries.map((e) => e.label),
      revenue: entries.map(() => 0),
      cost:    entries.map(() => 0),
      profit:  entries.map(() => 0),
      summary: null,
    };
  }
}

export async function getTopProducts(userId, period = "week") {
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  try {
    const data = await apiFetch(
      `/daftari/top-products?user_id=${encodeURIComponent(userId)}&days=${days}`
    );
    return { products: Array.isArray(data) ? data : [] };
  } catch (err) {
    console.warn("getTopProducts error:", err.message);
    return { products: [] };
  }
}

export async function getSpendingPatterns(userId, period = "week") {
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  try {
    const data = await apiFetch(
      `/daftari/spending?user_id=${encodeURIComponent(userId)}&days=${days}`
    );
    return { categories: Array.isArray(data) ? data : [] };
  } catch (err) {
    console.warn("getSpendingPatterns error:", err.message);
    return { categories: [] };
  }
}

// ── Health card ───────────────────────────────────────────────────────────────

export async function downloadHealthCard(userId, days = 90) {
  let res;
  try {
    res = await fetch(
      `${BASE_URL}/daftari/health-card?user_id=${encodeURIComponent(userId)}&days=${days}`
    );
  } catch (networkErr) {
    throw new Error(`Failed to fetch: ${networkErr.message}`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractError(err.detail));
  }

  const blob     = await res.blob();
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement("a");
  a.href         = url;
  a.download     = `kadi-afya-${new Date().toISOString().slice(0, 10)}.pdf`;
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
    queue.map((item) => {
      // Build text from queued item for /daftari/text endpoint
      const amount   = parseFloat(item.amount) || 0;
      const typeWord = item.type === "mapato" ? "Nimepata" : "Nimetumia";
      const text     = item.text
        || `${typeWord} shilingi ${amount} kwa ajili ya ${item.category || "biashara"}`;

      return apiFetch("/daftari/text", {
        method: "POST",
        body:   JSON.stringify({ user_id: userId, text, ...item }),
      });
    })
  );

  const synced    = results.filter((r) => r.status === "fulfilled").length;
  const remaining = queue.filter((_, i) => results[i].status === "rejected");
  saveOfflineQueue(remaining);
  return { synced, failed: results.length - synced, remaining: remaining.length };
}
