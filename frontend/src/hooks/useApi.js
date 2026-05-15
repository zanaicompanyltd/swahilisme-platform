// frontend/src/hooks/useApi.js
// API client for Daftari Yangu backend

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ── Offline queue (IndexedDB-backed via localStorage fallback) ────────────────
const QUEUE_KEY = "daftari_offline_queue";     
function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueOffline(transaction) {
  const queue = getQueue();
  queue.push({ ...transaction, local_id: crypto.randomUUID(), queued_at: new Date().toISOString() });
  saveQueue(queue);
}

export function getOfflineCount() {
  return getQueue().length;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
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
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Transcription failed");
  }
  return res.json();
}

// ── Transactions ──────────────────────────────────────────────────────────────
export async function createTransaction(data) {
  try {
    return await apiFetch("/api/v1/daftari/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (e) {
    // Offline fallback
    enqueueOffline(data);
    return { ...data, id: data.local_id, is_synced: false, offline: true };
  }
}

export async function listTransactions(userId, params = {}) {
  const qs = new URLSearchParams({ user_id: userId, ...params }).toString();
  return apiFetch(`/api/v1/daftari/transactions?${qs}`);
}

export async function deleteTransaction(txId, userId) {
  return apiFetch(`/api/v1/daftari/transactions/${txId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

// ── Summary / Analytics ───────────────────────────────────────────────────────
export async function getSummary(userId, days = 30) {
  return apiFetch(`/api/v1/daftari/summary?user_id=${userId}&days=${days}`);
}

export async function getTopProducts(userId, days = 30) {
  return apiFetch(`/api/v1/daftari/top-products?user_id=${userId}&days=${days}`);
}

export async function getSpending(userId, days = 30) {
  return apiFetch(`/api/v1/daftari/spending?user_id=${userId}&days=${days}`);
}

// ── Sync ──────────────────────────────────────────────────────────────────────
export async function syncOfflineQueue(userId) {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0 };

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

  // Also flush server-side queue
  try {
    await apiFetch("/api/v1/daftari/sync", {
      method: "POST",
      body: JSON.stringify(userId),
      headers: { "Content-Type": "application/json" },
    });
  } catch {}

  return { synced, remaining: remaining.length };
}

export async function getSyncStatus(userId) {
  try {
    const server = await apiFetch(`/api/v1/daftari/sync/status?user_id=${userId}`);
    return { ...server, offline_pending: getOfflineCount() };
  } catch {
    return { is_synced: false, offline_pending: getOfflineCount() };
  }
}

// ── Health Card ───────────────────────────────────────────────────────────────
export async function downloadHealthCard(userId, days = 90) {
  const res = await fetch(
    `${BASE_URL}/api/v1/daftari/health-card?user_id=${userId}&days=${days}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "PDF generation failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kadi-afya-${userId}-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}