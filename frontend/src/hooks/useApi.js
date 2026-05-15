// frontend/src/hooks/useApi.js
// API client for Daftari Yangu backend

// === UPDATED PRODUCTION URL ===
const BASE_URL = process.env.REACT_APP_API_URL || "https://swahilisme-platform-production.up.railway.app";

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
  queue.push({ 
    ...transaction, 
    local_id: crypto.randomUUID(), 
    queued_at: new Date().toISOString() 
  });
  saveQueue(queue);
}

export function getOfflineCount() {
  return getQueue().length;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  
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
    return { ...data, id: data.local_id || Date.now(), is_synced: false, offline: true };
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

// ── Sync ──────────────────────────────────────────────────────────────────────
export async function syncOfflineQueue(userId) {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0 };

  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      await createTransaction({ ...item, user_id: userId });
      synced++;
    } catch {
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  return { synced, remaining: remaining.length };
}

// ── Health Card ───────────────────────────────────────────────────────────────
export async function downloadHealthCard(userId, days = 90) {
  const res = await fetch(
    `${BASE_URL}/api/v1/daftari/health-card?user_id=${userId}&days=${days}`
  );
  if (!res.ok) throw new Error("PDF generation failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kadi-afya-${new Date().toISOString().slice(0,10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
