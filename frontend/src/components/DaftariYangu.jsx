// frontend/src/components/DaftariYangu.jsx
// Main PWA Component for Module 1: Daftari Yangu
// Swahili-first, offline-capable voice bookkeeping app

// frontend/src/components/DaftariYangu.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  transcribeAudio,
  createTransaction,
  listTransactions,
  deleteTransaction,
  getSummary,
  downloadHealthCard,
  syncOfflineQueue,
  getOfflineCount,
} from "../hooks/useApi";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import sw from "../i18n/sw";

// === UPDATE THIS LINE ===
const API_BASE = process.env.REACT_APP_API_URL || "https://swahilisme-platform-production.up.railway.app";

// ── User ID (persisted in localStorage) ──────────────────────────────────────
const USER_ID = localStorage.getItem("daftari_user_id") || 
  (() => {
    const id = "user_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("daftari_user_id", id);
    return id;
  })();

// ── Category definitions ──────────────────────────────────────────────────────
const INCOME_CATEGORIES = [
  { value: "mauzo",              label: "Mauzo (Bidhaa)" },
  { value: "huduma",             label: "Huduma" },
  { value: "mkopo_uliopokelewa", label: "Mkopo Uliopokelewa" },
  { value: "nyingine_mapato",    label: "Mapato Mengine" },
];

const EXPENSE_CATEGORIES = [
  { value: "malighafi",        label: "Malighafi" },
  { value: "mishahara",        label: "Mishahara" },
  { value: "kodi",             label: "Kodi / Pango" },
  { value: "umeme",            label: "Umeme" },
  { value: "usafiri",          label: "Usafiri" },
  { value: "matangazo",        label: "Matangazo" },
  { value: "mkopo_uliolipwa",  label: "Mkopo Uliolipwa" },
  { value: "nyingine_gharama", label: "Gharama Nyingine" },
];

const CATEGORY_ICONS = {
  mauzo: "🛒", huduma: "🛠️", mkopo_uliopokelewa: "💵", nyingine_mapato: "💰",
  malighafi: "📦", mishahara: "👷", kodi: "🏠", umeme: "⚡",
  usafiri: "🚗", matangazo: "📢", mkopo_uliolipwa: "🏦", nyingine_gharama: "💸",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTZS(n) {
  return "TZS " + Number(n || 0).toLocaleString();
}

function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Leo";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Jana";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const EMPTY_FORM = {
  type: "mapato",
  category: "mauzo",
  amount: "",
  description: "",
  product_name: "",
  quantity: "",
  transaction_date: new Date().toISOString().slice(0, 10),
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function DaftariYangu() {
  const [tab, setTab]               = useState("rekodi");
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary]       = useState(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [toast, setToast]           = useState(null);
  const [transcript, setTranscript] = useState("");
  const [nlpData, setNlpData]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recorder = useVoiceRecorder();

  // ── Load data ───────────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    try {
      const [txs, sum] = await Promise.all([
        listTransactions(USER_ID, { limit: 30 }),
        getSummary(USER_ID, 30),
      ]);
      setTransactions(txs);
      setSummary(sum);
    } catch {
      setTransactions([]);
    }
    setOfflineCount(getOfflineCount());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Auto-sync when back online
  useEffect(() => {
    const handleOnline = async () => {
      if (getOfflineCount() > 0) {
        showToast("🔄 Inasawazisha data iliyohifadhiwa…", "info");
        const res = await syncOfflineQueue(USER_ID);
        if (res.synced > 0) {
          showToast("✅ Miamala " + res.synced + " imesawazishwa", "success");
          reload();
        }
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [reload]);

  // Auto-transcribe when recording finishes
  useEffect(() => {
    if (recorder.audioBlob && recorder.state === "processing") {
      handleTranscribe(recorder.audioBlob);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob, recorder.state]);

  // ── Toast helper ────────────────────────────────────────────────────────────
  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Transcribe audio → NLP → fill form ─────────────────────────────────────
  async function handleTranscribe(blob) {
    setTranscribing(true);
    try {
      const result = await transcribeAudio(USER_ID, blob, "audio.webm");
      setTranscript(result.transcript);
      if (result.nlp) {
        const n = result.nlp;
        setNlpData(n);
        setForm((prev) => ({
          ...prev,
          type:             n.transaction_type || prev.type,
          category:         n.category         || prev.category,
          amount:           n.amount != null   ? String(n.amount) : prev.amount,
          description:      result.transcript,
          product_name:     n.product_name     || prev.product_name,
          quantity:         n.quantity != null ? String(n.quantity) : prev.quantity,
          transaction_date: n.transaction_date
            ? n.transaction_date.slice(0, 10)
            : prev.transaction_date,
        }));
      }
      setTab("thibitisha");
    } catch (err) {
      showToast("❌ " + (err.message || sw.errorRecording), "error");
      recorder.reset();
    } finally {
      setTranscribing(false);
    }
  }

  // ── Save transaction ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.amount || isNaN(parseFloat(form.amount))) {
      showToast("Tafadhali weka kiasi sahihi", "error");
      return;
    }
    setSaving(true);
    try {
      await createTransaction({
        user_id:          USER_ID,
        type:             form.type,
        category:         form.category,
        amount:           parseFloat(form.amount),
        description:      form.description,
        transaction_date: form.transaction_date,
        source:           transcript ? "voice" : "manual",
        raw_transcript:   transcript  || null,
        nlp_confidence:   nlpData?.confidence || null,
        product_name:     form.product_name   || null,
        quantity:         form.quantity ? parseFloat(form.quantity) : null,
        nlp_entities:     nlpData || null,
      });
      showToast("✅ Muamala umehifadhiwa!", "success");
      setTranscript("");
      setNlpData(null);
      setForm(EMPTY_FORM);
      recorder.reset();
      setTab("daftari");
      reload();
    } catch {
      showToast("⚠️ " + sw.errorSaving, "warning");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete transaction ──────────────────────────────────────────────────────
  async function handleDelete(id) {
    try {
      await deleteTransaction(id, USER_ID);
      showToast("🗑️ Muamala umefutwa", "info");
      reload();
    } catch {
      showToast("❌ Hitilafu ya kufuta", "error");
    }
  }

  // ── Download health card PDF ────────────────────────────────────────────────
  async function handleHealthCard() {
    setPdfLoading(true);
    try {
      await downloadHealthCard(USER_ID, 90);
      showToast("✅ PDF imepakuliwa!", "success");
    } catch (err) {
      showToast("❌ " + (err.message || "Hitilafu ya PDF"), "error");
    } finally {
      setPdfLoading(false);
    }
  }

  const categories =
    form.type === "mapato" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={S.app}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div>
            <div style={S.headerTitle}>📒 {sw.appName}</div>
            <div style={S.headerSub}>{sw.tagline}</div>
          </div>
          <div style={S.headerRight}>
            {offlineCount > 0 && (
              <div style={{ ...S.badge, background: "#f59e0b" }}>
                ⏳ {offlineCount}
              </div>
            )}
            {!navigator.onLine && (
              <div style={{ ...S.badge, background: "#ef4444" }}>
                📵 Nje ya mtandao
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          ...S.toast,
          background:
            toast.type === "error"   ? "#ef4444" :
            toast.type === "warning" ? "#f59e0b" :
            toast.type === "info"    ? "#3b82f6" : "#22c55e",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <main style={S.main}>

        {/* ══════════════ REKODI TAB ══════════════ */}
        {tab === "rekodi" && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>🎙️ Rekodi Muamala Wako</h2>
            <p style={S.hint}>
              Sema kwa Kiswahili — mfano:<br />
              <em>"Nimeuza ndizi mia mbili, shilingi elfu ishirini"</em>
            </p>

            <div style={S.recordCenter}>
              <button
                style={{
                  ...S.micBtn,
                  ...(recorder.isRecording ? S.micBtnActive : {}),
                  ...(transcribing ? S.micBtnProcessing : {}),
                }}
                onMouseDown={recorder.startRecording}
                onMouseUp={recorder.stopRecording}
                onTouchStart={(e) => { e.preventDefault(); recorder.startRecording(); }}
                onTouchEnd={(e)   => { e.preventDefault(); recorder.stopRecording(); }}
                disabled={transcribing}
                aria-label="Rekodi sauti"
              >
                {transcribing ? "⏳" : recorder.isRecording ? "⏹" : "🎙️"}
              </button>

              <div style={S.recordLabel}>
                {transcribing
                  ? sw.transcribing
                  : recorder.isRecording
                  ? sw.recording + " (" + recorder.duration + "s)"
                  : sw.holdToRecord}
              </div>

              {recorder.error && (
                <div style={S.errorText}>{recorder.error}</div>
              )}
            </div>

            <div style={S.divider}>
              <span style={S.dividerText}>au ingiza kwa mkono</span>
            </div>
            <button
              style={S.btnSecondary}
              onClick={() => {
                setTranscript("");
                setNlpData(null);
                setTab("thibitisha");
              }}
            >
              ✏️ Ingiza Mwenyewe
            </button>
          </div>
        )}

        {/* ══════════════ THIBITISHA TAB ══════════════ */}
        {tab === "thibitisha" && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>✅ Thibitisha Muamala</h2>

            {transcript && (
              <div style={S.transcriptBox}>
                <div style={S.transcriptLabel}>Ulichosema:</div>
                <div style={S.transcriptText}>"{transcript}"</div>
                {nlpData?.confidence != null && (
                  <div style={S.confidence}>
                    Uhalisi wa AI: {Math.round(nlpData.confidence * 100)}%
                  </div>
                )}
              </div>
            )}

            {nlpData?.warnings?.map((w, i) => (
              <div key={i} style={S.warning}>⚠️ {w}</div>
            ))}

            <div style={S.typeToggle}>
              <button
                style={{ ...S.typeBtn, ...(form.type === "mapato" ? S.typeBtnIncome : {}) }}
                onClick={() => setForm((f) => ({ ...f, type: "mapato", category: "mauzo" }))}
              >
                💰 Mapato
              </button>
              <button
                style={{ ...S.typeBtn, ...(form.type === "gharama" ? S.typeBtnExpense : {}) }}
                onClick={() => setForm((f) => ({ ...f, type: "gharama", category: "malighafi" }))}
              >
                💸 Gharama
              </button>
            </div>

            <label style={S.label}>{sw.amount}</label>
            <div style={S.amountRow}>
              <span style={S.currency}>TZS</span>
              <input
                style={S.amountInput}
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                inputMode="numeric"
              />
            </div>

            <label style={S.label}>{sw.category}</label>
            <select
              style={S.select}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {CATEGORY_ICONS[c.value]} {c.label}
                </option>
              ))}
            </select>

            <label style={S.label}>
              {sw.product} <span style={S.optional}>(hiari)</span>
            </label>
            <input
              style={S.input}
              value={form.product_name}
              onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
              placeholder="mf. Ndizi, Unga, Huduma ya useremala…"
            />

            <label style={S.label}>{sw.date}</label>
            <input
              style={S.input}
              type="date"
              value={form.transaction_date}
              onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
            />

            <label style={S.label}>{sw.description}</label>
            <textarea
              style={{ ...S.input, height: 64, resize: "vertical" }}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Maelezo ya ziada (hiari)…"
            />

            <div style={S.btnRow}>
              <button
                style={S.btnSecondary}
                onClick={() => { recorder.reset(); setTab("rekodi"); }}
              >
                ← Rudi
              </button>
              <button
                style={S.btnPrimary}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Inahifadhi…" : "💾 " + sw.save}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════ DAFTARI TAB ══════════════ */}
        {tab === "daftari" && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <h2 style={{ ...S.cardTitle, margin: 0 }}>📒 Miamala Yangu</h2>
              <button style={S.btnSmall} onClick={reload}>🔄</button>
            </div>

            {transactions.length === 0 ? (
              <div style={S.empty}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>📭</div>
                <div>{sw.noTransactions}</div>
              </div>
            ) : (
              <div style={S.txList}>
                {transactions.map((tx) => (
                  <div key={tx.id} style={S.txItem}>
                    <div style={S.txIcon}>
                      {CATEGORY_ICONS[tx.category] || "💼"}
                    </div>
                    <div style={S.txBody}>
                      <div style={S.txTop}>
                        <span style={S.txCategory}>
                          {tx.category
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                        <span style={{
                          ...S.txAmount,
                          color: tx.type === "mapato" ? "#22c55e" : "#ef4444",
                        }}>
                          {tx.type === "mapato" ? "+" : "−"}{formatTZS(tx.amount)}
                        </span>
                      </div>
                      <div style={S.txMeta}>
                        <span style={S.txDate}>
                          {formatDate(tx.transaction_date)}
                        </span>
                        {tx.source === "voice" && (
                          <span style={S.voiceBadge}>🎙️ sauti</span>
                        )}
                        {!tx.is_synced && (
                          <span style={S.pendingBadge}>⏳ pending</span>
                        )}
                      </div>
                      {tx.description ? (
                        <div style={S.txDesc}>
                          {tx.description.length > 60
                            ? tx.description.slice(0, 60) + "…"
                            : tx.description}
                        </div>
                      ) : null}
                    </div>
                    <button
                      style={S.deleteBtn}
                      onClick={() => handleDelete(tx.id)}
                      title="Futa muamala huu"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ MUHTASARI TAB ══════════════ */}
        {tab === "muhtasari" && (
          <div>
            {summary ? (
              <>
                <div style={S.kpiGrid}>
                  <KPICard label="💰 Mapato" value={formatTZS(summary.total_revenue)} color="#22c55e" />
                  <KPICard label="💸 Gharama" value={formatTZS(summary.total_cost)} color="#ef4444" />
                  <KPICard
                    label="📈 Faida"
                    value={formatTZS(summary.net_profit)}
                    color={summary.net_profit >= 0 ? "#22c55e" : "#ef4444"}
                  />
                  <KPICard label="📊 Margin" value={summary.profit_margin + "%"} color="#f59e0b" />
                </div>

                <div style={{ ...S.card, marginTop: 12 }}>
                  {[
                    ["Idadi ya Miamala", summary.transactions_count],
                    ["Kipindi",          "Siku 30 zilizopita"],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={S.statRow}>
                      <span style={S.statLabel}>{lbl}</span>
                      <span style={S.statValue}>{val}</span>
                    </div>
                  ))}

                  {summary.total_revenue > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={S.statLabel}>Mgawanyo wa Mapato</div>
                      <div style={S.barTrack}>
                        <div style={{
                          ...S.barFill,
                          width: Math.min(
                            100,
                            (summary.net_profit / summary.total_revenue) * 100
                          ) + "%",
                          background: summary.net_profit >= 0 ? "#22c55e" : "#ef4444",
                        }} />
                      </div>
                      <div style={S.barLabels}>
                        <span>
                          Gharama: {Math.round(
                            (summary.total_cost / summary.total_revenue) * 100
                          )}%
                        </span>
                        <span>Faida: {summary.profit_margin}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={S.card}>
                <div style={S.empty}>Inachakua data…</div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ KADI TAB ══════════════ */}
        {tab === "kadi" && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>🏥 Kadi ya Afya ya Biashara</h2>
            <p style={S.hint}>
              Baada ya miamala 30+, unaweza kupakua ripoti ya PDF
              inayofaa kwa maombi ya mkopo.
            </p>

            {summary && (
              <div style={S.eligibilityBox}>
                {summary.transactions_count >= 30 ? (
                  <div style={{ color: "#15803d", fontWeight: 700 }}>
                    ✅ Unastahili! Miamala {summary.transactions_count}/30+
                  </div>
                ) : (
                  <div style={{ color: "#92400e", fontWeight: 600 }}>
                    ⏳ Miamala {summary.transactions_count}/30 —
                    unahitaji {30 - summary.transactions_count} zaidi
                  </div>
                )}
              </div>
            )}

            <div style={S.pdfPreview}>
              <div style={{ fontSize: 56 }}>📄</div>
              <div style={{ fontWeight: 700, color: "#1a6b3a", fontSize: 15 }}>
                Kadi ya Afya ya Biashara
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, lineHeight: 1.8 }}>
                ✔ Mapato &amp; Gharama (Siku 90)<br />
                ✔ Bidhaa Bora 5<br />
                ✔ Gharama kwa Aina<br />
                ✔ Tangazo la Kisheria (SW + EN)
              </div>
            </div>

            <button
              style={{ ...S.btnPrimary, width: "100%" }}
              onClick={handleHealthCard}
              disabled={pdfLoading}
            >
              {pdfLoading ? "Inatengeneza PDF…" : "📥 " + sw.generateHealthCard}
            </button>
          </div>
        )}
      </main>

      {/* ── Bottom navigation ───────────────────────────────────────────────── */}
      <nav style={S.nav}>
        {[
          { id: "rekodi",    icon: "🎙️", label: "Rekodi"    },
          { id: "daftari",   icon: "📒", label: "Daftari"   },
          { id: "muhtasari", icon: "📊", label: "Muhtasari" },
          { id: "kadi",      icon: "🏥", label: "Kadi"      },
        ].map((n) => (
          <button
            key={n.id}
            style={{ ...S.navBtn, ...(tab === n.id ? S.navBtnActive : {}) }}
            onClick={() => setTab(n.id)}
          >
            <span style={{ fontSize: 22 }}>{n.icon}</span>
            <span style={{ fontSize: 10 }}>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── KPI Card sub-component ────────────────────────────────────────────────────
function KPICard({ label, value, color }) {
  return (
    <div style={{ ...S.kpiCard, borderTopColor: color }}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={{ ...S.kpiValue, color }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  app: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    background: "#f0f9f4",
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "linear-gradient(135deg, #1a6b3a 0%, #2e9e5b 100%)",
    padding: "16px 20px",
    color: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  headerInner: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" },
  headerSub:   { fontSize: 12, opacity: 0.8, marginTop: 2 },
  headerRight: { display: "flex", gap: 6, alignItems: "center" },
  badge: { color: "#fff", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 },
  toast: {
    position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)",
    color: "#fff", padding: "10px 22px", borderRadius: 24, fontWeight: 600,
    fontSize: 14, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    whiteSpace: "nowrap", pointerEvents: "none",
  },
  main: { flex: 1, padding: "16px 16px 90px", overflowY: "auto" },
  card: {
    background: "#fff", borderRadius: 16, padding: 20,
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 700, color: "#1a6b3a", margin: "0 0 8px" },
  hint: { fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 },
  recordCenter: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, margin: "28px 0" },
  micBtn: {
    width: 100, height: 100, borderRadius: "50%",
    background: "linear-gradient(135deg, #1a6b3a, #2e9e5b)",
    border: "none", cursor: "pointer", fontSize: 40,
    boxShadow: "0 4px 20px rgba(26,107,58,0.35)",
    transition: "all 0.15s ease",
    display: "flex", alignItems: "center", justifyContent: "center",
    userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
  },
  micBtnActive: {
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    boxShadow: "0 0 0 14px rgba(239,68,68,0.12), 0 4px 20px rgba(239,68,68,0.3)",
  },
  micBtnProcessing: { background: "linear-gradient(135deg, #6b7280, #9ca3af)", cursor: "not-allowed" },
  recordLabel: { fontSize: 13, color: "#6b7280", textAlign: "center", maxWidth: 240 },
  errorText: { color: "#ef4444", fontSize: 13, textAlign: "center" },
  divider: { display: "flex", alignItems: "center", margin: "18px 0" },
  dividerText: { color: "#9ca3af", fontSize: 13, margin: "0 auto" },
  transcriptBox: {
    background: "#f0f9f4", borderRadius: 10, padding: 12,
    borderLeft: "3px solid #2e9e5b", marginBottom: 16,
  },
  transcriptLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600 },
  transcriptText: { fontSize: 14, color: "#1a1a2e", fontStyle: "italic", lineHeight: 1.5 },
  confidence: { fontSize: 11, color: "#9ca3af", marginTop: 6 },
  warning: {
    background: "#fef3c7", borderRadius: 8, padding: "7px 10px",
    fontSize: 12, color: "#92400e", marginBottom: 8,
  },
  typeToggle: { display: "flex", gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, padding: "11px 0", borderRadius: 10,
    border: "2px solid #e5e7eb", background: "#f9fafb",
    cursor: "pointer", fontWeight: 600, fontSize: 14,
  },
  typeBtnIncome:  { borderColor: "#22c55e", background: "#f0fdf4", color: "#15803d" },
  typeBtnExpense: { borderColor: "#ef4444", background: "#fef2f2", color: "#dc2626" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, marginTop: 14 },
  optional: { fontWeight: 400, color: "#9ca3af" },
  amountRow: { display: "flex", alignItems: "center", gap: 8 },
  currency: { fontSize: 13, fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" },
  amountInput: {
    flex: 1, border: "2px solid #e5e7eb", borderRadius: 10,
    padding: "12px 14px", fontSize: 24, fontWeight: 700,
    color: "#1a1a2e", outline: "none", background: "#fafafa", width: "100%",
  },
  input: {
    width: "100%", border: "2px solid #e5e7eb", borderRadius: 10,
    padding: "10px 14px", fontSize: 14, color: "#1a1a2e",
    outline: "none", background: "#fafafa", boxSizing: "border-box", fontFamily: "inherit",
  },
  select: {
    width: "100%", border: "2px solid #e5e7eb", borderRadius: 10,
    padding: "10px 14px", fontSize: 14, color: "#1a1a2e",
    outline: "none", background: "#fafafa", fontFamily: "inherit",
  },
  btnRow: { display: "flex", gap: 10, marginTop: 20 },
  btnPrimary: {
    flex: 1, padding: "14px 0", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #1a6b3a, #2e9e5b)",
    color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
    boxShadow: "0 2px 10px rgba(26,107,58,0.25)", fontFamily: "inherit",
  },
  btnSecondary: {
    flex: 1, padding: "12px 0", borderRadius: 12,
    border: "2px solid #e5e7eb", background: "#fff",
    color: "#374151", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  },
  btnSmall: {
    padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb",
    background: "#fff", cursor: "pointer", fontSize: 16,
  },
  txList: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 },
  txItem: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: 12, borderRadius: 12, background: "#fafafa", border: "1px solid #f3f4f6",
  },
  txIcon: { fontSize: 22, marginTop: 2, flexShrink: 0 },
  txBody: { flex: 1, minWidth: 0 },
  txTop:  { display: "flex", justifyContent: "space-between", alignItems: "center" },
  txCategory: { fontSize: 13, fontWeight: 600, color: "#374151" },
  txAmount:   { fontSize: 14, fontWeight: 700, flexShrink: 0, marginLeft: 8 },
  txMeta:     { display: "flex", alignItems: "center", gap: 6, marginTop: 3 },
  txDate:     { fontSize: 11, color: "#9ca3af" },
  txDesc: { fontSize: 11, color: "#9ca3af", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  voiceBadge: { fontSize: 10, background: "#f0f9f4", color: "#15803d", padding: "1px 6px", borderRadius: 10, border: "1px solid #d1fae5" },
  pendingBadge: { fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 10 },
  deleteBtn: { background: "none", border: "none", color: "#d1d5db", cursor: "pointer", fontSize: 20, padding: "0 4px", lineHeight: 1, flexShrink: 0 },
  empty: { textAlign: "center", color: "#9ca3af", padding: "40px 0", fontSize: 15, lineHeight: 1.6 },
  kpiGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  kpiCard: { background: "#fff", borderRadius: 14, padding: "14px 16px", borderTop: "3px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  kpiLabel: { fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 6 },
  kpiValue: { fontSize: 16, fontWeight: 800 },
  statRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f3f4f6" },
  statLabel: { fontSize: 13, color: "#6b7280" },
  statValue: { fontSize: 13, fontWeight: 700, color: "#1a1a2e" },
  barTrack: { height: 10, background: "#e5e7eb", borderRadius: 6, overflow: "hidden", marginTop: 6 },
  barFill:  { height: "100%", borderRadius: 6, transition: "width 0.5s ease" },
  barLabels: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginTop: 4 },
  eligibilityBox: { background: "#f0f9f4", borderRadius: 10, padding: 14, marginBottom: 16, textAlign: "center", border: "1px solid #d1fae5" },
  pdfPreview: { border: "2px dashed #d1fae5", borderRadius: 14, padding: "28px 20px", textAlign: "center", margin: "16px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  nav: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #e5e7eb",
    display: "flex", padding: "6px 0 8px", boxShadow: "0 -2px 10px rgba(0,0,0,0.07)", zIndex: 100,
  },
  navBtn: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    gap: 2, background: "none", border: "none", cursor: "pointer",
    color: "#9ca3af", padding: "4px 0", fontFamily: "inherit",
  },
  navBtnActive: { color: "#1a6b3a" },
};
