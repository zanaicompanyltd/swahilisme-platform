// ============================================================
// DaftariYangu.jsx — SwahiliSME Platform
// Unified App: Rekodi · Daftari · Takwimu · Mshauri AI · Kadi
//
// FIXES:
//  1. USER_ID defaults to "demo-user-001" (matches DB seed)
//  2. SalesExpenseTracker duplicate REMOVED — analytics live here
//  3. Mshauri AI chat tab added (Gemini-ready placeholder)
//  4. Apple/Meta/Google-inspired minimal, premium design
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
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

// ── API base ──────────────────────────────────────────────────────────────────
const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://swahilisme-platform-production.up.railway.app";

// ── FIX #1: USER_ID — default to demo-user-001 so it matches DB seed ─────────
// Production: replace with real auth (JWT / phone OTP)
const USER_ID = (() => {
  const stored = localStorage.getItem("daftari_user_id");
  if (stored) return stored;
  // First time: use demo account so data is immediately visible
  const id = "demo-user-001";
  localStorage.setItem("daftari_user_id", id);
  return id;
})();

// ── Design tokens (Apple/Google/Meta-inspired) ────────────────────────────────
const T = {
  green:     "#1a6b3a",
  greenMid:  "#2e9e5b",
  greenLight:"#e8f5ee",
  blue:      "#0071e3",   // Apple blue
  red:       "#ff3b30",
  amber:     "#ff9f0a",
  purple:    "#af52de",
  gray50:    "#f5f5f7",   // Apple system gray
  gray100:   "#e8e8ed",
  gray200:   "#d2d2d7",
  gray400:   "#86868b",
  gray600:   "#515154",
  gray900:   "#1d1d1f",
  white:     "#ffffff",
  chartColors: ["#1a6b3a", "#0071e3", "#ff9f0a", "#af52de", "#ff3b30"],
};

// ── Category maps ─────────────────────────────────────────────────────────────
const INCOME_CATS = [
  { value: "mauzo",              label: "🛒 Mauzo (Bidhaa)" },
  { value: "huduma",             label: "🛠️ Huduma" },
  { value: "mkopo_uliopokelewa", label: "💵 Mkopo Uliopokelewa" },
  { value: "nyingine_mapato",    label: "💰 Mapato Mengine" },
];
const EXPENSE_CATS = [
  { value: "malighafi",        label: "📦 Malighafi" },
  { value: "mishahara",        label: "👷 Mishahara" },
  { value: "kodi",             label: "🏠 Kodi / Pango" },
  { value: "umeme",            label: "⚡ Umeme" },
  { value: "usafiri",          label: "🚗 Usafiri" },
  { value: "matangazo",        label: "📢 Matangazo" },
  { value: "mkopo_uliolipwa",  label: "🏦 Mkopo Uliolipwa" },
  { value: "nyingine_gharama", label: "💸 Gharama Nyingine" },
];
const CAT_ICONS = {
  mauzo:"🛒", huduma:"🛠️", mkopo_uliopokelewa:"💵", nyingine_mapato:"💰",
  malighafi:"📦", mishahara:"👷", kodi:"🏠", umeme:"⚡",
  usafiri:"🚗", matangazo:"📢", mkopo_uliolipwa:"🏦", nyingine_gharama:"💸",
};

// ── Mshauri AI — canned responses (replace with Gemini API call) ──────────────
const MSHAURI_SUGGESTIONS = [
  "Je, biashara yangu inafanya vizuri?",
  "Ninaweza kukopa mkopo wa TZS 5,000,000?",
  "Ninajisajili vipi TRA?",
  "Bidhaa gani inaleta faida zaidi?",
];

async function askMshauri(question, summary) {
  // ── Placeholder — swap this fetch() for your Gemini API call ──
  // Example Gemini call (when you're ready):
  // const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_KEY", {...})
  await new Promise((r) => setTimeout(r, 900)); // simulate latency
  const rev = summary?.total_revenue || 462000;
  const profit = summary?.net_profit || 237000;
  const margin = summary?.profit_margin || 51.3;

  const q = question.toLowerCase();
  if (q.includes("vizuri") || q.includes("hali")) {
    return `📊 Biashara yako inafanya vizuri sana! Mapato ya wiki hii ni TZS ${rev.toLocaleString()} na faida halisi ni TZS ${profit.toLocaleString()} (${margin}%). Endelea hivyo!`;
  }
  if (q.includes("mkopo") || q.includes("loan")) {
    return `🏦 Kulingana na data yako, una margin ya ${margin}% ambayo ni nzuri kwa mkopo. Baada ya siku 90 za data, Kadi yako ya Afya ya Biashara itakusaidia kupata mkopo wa TZS 1M–5M kwenye benki nyingi Tanzania.`;
  }
  if (q.includes("tra") || q.includes("kodi") || q.includes("tax")) {
    return `📋 Kwa TRA: Lazima ujisajili ukizidi TZS 14,000,000 kwa mwaka. Tembelea tra.go.tz au ofisi ya TRA karibu nawe. Nitakusaidia kujaza fomu — niulize swali lolote!`;
  }
  if (q.includes("bidhaa") || q.includes("product")) {
    return `🏆 Kulingana na data yako ya wiki hii, bidhaa zinazoongoza mapato ni kutoka mauzo yako ya mauzo ya kawaida. Jaribu kuongeza akiba ya bidhaa hizo ili kuongeza faida.`;
  }
  return `🤖 Asante kwa swali lako: "${question}"\n\nNimi Mshauri wako wa AI wa biashara. Ninaweza kukusaidia na:\n• Uchambuzi wa mapato na gharama\n• Ushauri wa mikopo\n• Maswali ya TRA na BRELA\n• Mikakati ya kukuza biashara\n\nNiulize swali lolote kwa Kiswahili!`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => "TZS " + Number(n || 0).toLocaleString();
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Leo";
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Jana";
  return d.toLocaleDateString("sw-TZ", { day: "numeric", month: "short" });
}

const EMPTY_FORM = {
  type: "mapato", category: "mauzo", amount: "", description: "",
  product_name: "", quantity: "",
  transaction_date: new Date().toISOString().slice(0, 10),
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function DaftariYangu() {
  const [tab, setTab]             = useState("rekodi");
  const [transactions, setTxs]   = useState([]);
  const [summary, setSummary]     = useState(null);
  const [chartData, setChart]     = useState([]);
  const [topProducts, setTopP]    = useState([]);
  const [spending, setSpend]      = useState([]);
  const [offlineCount, setOff]    = useState(0);
  const [toast, setToast]         = useState(null);
  const [transcript, setTranscript] = useState("");
  const [nlpData, setNlp]         = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [pdfLoading, setPdf]      = useState(false);
  const [transcribing, setTrans]  = useState(false);
  const [analyticsLoading, setAL] = useState(false);

  // Mshauri AI state
  const [aiMessages, setAiMsgs]  = useState([
    { role: "ai", text: "Habari! Mimi ni Mshauri wako wa AI wa biashara. Ninaweza kukusaidia na uchambuzi wa biashara, ushauri wa mikopo, maswali ya TRA, na zaidi. Niulize chochote! 🤖" }
  ]);
  const [aiInput, setAiInput]    = useState("");
  const [aiLoading, setAiLoading]= useState(false);
  const aiEndRef                  = useRef(null);

  const recorder = useVoiceRecorder();

  // ── Load data ───────────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    try {
      const [txs, sum] = await Promise.all([
        listTransactions(USER_ID, { limit: 50 }),
        getSummary(USER_ID, 30),
      ]);
      setTxs(Array.isArray(txs) ? txs : []);
      setSummary(sum);
    } catch (e) {
      console.error("[reload]", e);
      setTxs([]);
    }
    setOff(getOfflineCount());
  }, []);

  const reloadAnalytics = useCallback(async () => {
    setAL(true);
    try {
      const [chart, products, spend] = await Promise.all([
        fetch(`${API_BASE}/api/v1/dashboard/revenue-cost-profit?user_id=${USER_ID}&days=7`).then(r=>r.json()),
        fetch(`${API_BASE}/api/v1/dashboard/top-products?user_id=${USER_ID}&period=week`).then(r=>r.json()),
        fetch(`${API_BASE}/api/v1/dashboard/spending-patterns?user_id=${USER_ID}&period=week`).then(r=>r.json()),
      ]);
      if (chart.labels) {
        setChart(chart.labels.map((l, i) => ({
          day: l,
          Mapato: chart.revenue[i] || 0,
          Gharama: chart.cost[i] || 0,
          Faida: chart.profit[i] || 0,
        })));
      }
      setTopP(products.products || []);
      setSpend(products.categories || spend.categories || []);
    } catch (e) {
      console.error("[analytics]", e);
    }
    setAL(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (tab === "takwimu") reloadAnalytics();
  }, [tab, reloadAnalytics]);

  // Auto-sync
  useEffect(() => {
    const go = async () => {
      if (getOfflineCount() > 0) {
        showToast("🔄 Inasawazisha…", "info");
        const res = await syncOfflineQueue(USER_ID);
        if (res?.synced > 0) { showToast(`✅ ${res.synced} imesawazishwa`, "success"); reload(); }
      }
    };
    window.addEventListener("online", go);
    return () => window.removeEventListener("online", go);
  }, [reload]);

  // Auto-transcribe
  useEffect(() => {
    if (recorder.audioBlob && recorder.state === "processing") {
      handleTranscribe(recorder.audioBlob);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob, recorder.state]);

  // AI scroll
  useEffect(() => {
    if (tab === "mshauri") aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, tab]);

  // ── Toast ───────────────────────────────────────────────────────────────────
  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Transcribe ──────────────────────────────────────────────────────────────
  async function handleTranscribe(blob) {
    setTrans(true);
    try {
      const result = await transcribeAudio(USER_ID, blob, "audio.webm");
      setTranscript(result.transcript);
      if (result.nlp) {
        const n = result.nlp;
        setNlp(n);
        setForm((f) => ({
          ...f,
          type:             n.transaction_type || f.type,
          category:         n.category         || f.category,
          amount:           n.amount != null   ? String(n.amount) : f.amount,
          description:      result.transcript,
          product_name:     n.product_name     || f.product_name,
          quantity:         n.quantity != null  ? String(n.quantity) : f.quantity,
          transaction_date: n.transaction_date  ? n.transaction_date.slice(0,10) : f.transaction_date,
        }));
      }
      setTab("thibitisha");
    } catch (err) {
      showToast("❌ " + (err.message || "Hitilafu ya kurekodi"), "error");
      recorder.reset();
    } finally {
      setTrans(false);
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
        raw_transcript:   transcript || null,
        nlp_confidence:   nlpData?.confidence || null,
        product_name:     form.product_name   || null,
        quantity:         form.quantity ? parseFloat(form.quantity) : null,
        nlp_entities:     nlpData || null,
      });
      showToast("✅ Muamala umehifadhiwa!", "success");
      setTranscript(""); setNlp(null); setForm(EMPTY_FORM); recorder.reset();
      setTab("daftari");
      reload();
    } catch {
      showToast("⚠️ Hitilafu ya kuhifadhi. Itajaribu tena.", "warning");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteTransaction(id, USER_ID);
      showToast("🗑️ Imefutwa", "info");
      reload();
    } catch {
      showToast("❌ Hitilafu ya kufuta", "error");
    }
  }

  async function handleHealthCard() {
    setPdf(true);
    try {
      await downloadHealthCard(USER_ID, 90);
      showToast("✅ PDF imepakuliwa!", "success");
    } catch (err) {
      showToast("❌ " + (err.message || "Hitilafu ya PDF"), "error");
    } finally {
      setPdf(false);
    }
  }

  async function handleAsk() {
    const q = aiInput.trim();
    if (!q || aiLoading) return;
    const userMsg = { role: "user", text: q };
    setAiMsgs((m) => [...m, userMsg]);
    setAiInput("");
    setAiLoading(true);
    try {
      const answer = await askMshauri(q, summary);
      setAiMsgs((m) => [...m, { role: "ai", text: answer }]);
    } catch {
      setAiMsgs((m) => [...m, { role: "ai", text: "Samahani, hitilafu imetokea. Jaribu tena." }]);
    } finally {
      setAiLoading(false);
    }
  }

  const categories = form.type === "mapato" ? INCOME_CATS : EXPENSE_CATS;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.app}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div>
            <div style={S.headerTitle}>📒 Daftari Yangu</div>
            <div style={S.headerSub}>SwahiliSME · {USER_ID}</div>
          </div>
          <div style={S.headerRight}>
            {offlineCount > 0 && <Chip color={T.amber}>⏳ {offlineCount}</Chip>}
            {!navigator.onLine && <Chip color={T.red}>📵 Offline</Chip>}
          </div>
        </div>
      </header>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          ...S.toast,
          background:
            toast.type === "error"   ? T.red   :
            toast.type === "warning" ? T.amber :
            toast.type === "info"    ? T.blue  : T.green,
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Content area ──────────────────────────────────────────────────── */}
      <main style={S.main}>

        {/* ══════ REKODI TAB ══════ */}
        {tab === "rekodi" && (
          <Section>
            <CardTitle icon="🎙️" text="Rekodi Muamala" />
            <p style={S.hint}>Sema kwa Kiswahili — mfano: <em>"Nimeuza ndizi elfu ishirini"</em></p>

            {/* Mic button */}
            <div style={S.recordCenter}>
              <button
                style={{
                  ...S.micBtn,
                  ...(recorder.isRecording ? S.micActive : {}),
                  ...(transcribing ? S.micProcessing : {}),
                }}
                onMouseDown={recorder.startRecording}
                onMouseUp={recorder.stopRecording}
                onTouchStart={(e) => { e.preventDefault(); recorder.startRecording(); }}
                onTouchEnd={(e)   => { e.preventDefault(); recorder.stopRecording(); }}
                disabled={transcribing}
                aria-label="Rekodi sauti"
              >
                <span style={{ fontSize: 44 }}>
                  {transcribing ? "⏳" : recorder.isRecording ? "⏹" : "🎙️"}
                </span>
              </button>

              {/* Pulse ring when recording */}
              {recorder.isRecording && <div style={S.pulse} />}

              <div style={S.recordLabel}>
                {transcribing        ? "⚡ Inachakata sauti…"
                : recorder.isRecording ? `🔴 Inaandika… (${recorder.duration}s)`
                : "Shikilia kusema · au bonyeza mara moja"}
              </div>
              {recorder.error && <div style={{ color: T.red, fontSize: 13 }}>{recorder.error}</div>}
            </div>

            {/* Divider */}
            <div style={S.divider}><span style={S.dividerTxt}>au ingiza kwa mkono</span></div>

            <button style={S.btnOutline} onClick={() => { setTranscript(""); setNlp(null); setTab("thibitisha"); }}>
              ✏️ Ingiza Mwenyewe
            </button>
          </Section>
        )}

        {/* ══════ THIBITISHA TAB (confirm form) ══════ */}
        {tab === "thibitisha" && (
          <Section>
            <CardTitle icon="✅" text="Thibitisha Muamala" />

            {transcript && (
              <div style={S.transcriptBox}>
                <div style={{ fontSize: 11, color: T.gray400, fontWeight: 600, marginBottom: 4 }}>Ulichosema:</div>
                <div style={{ fontSize: 14, color: T.gray900, fontStyle: "italic", lineHeight: 1.5 }}>"{transcript}"</div>
                {nlpData?.confidence != null && (
                  <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>
                    Uhalisi: {Math.round(nlpData.confidence * 100)}%
                  </div>
                )}
              </div>
            )}

            {nlpData?.warnings?.map((w, i) => (
              <div key={i} style={S.warning}>⚠️ {w}</div>
            ))}

            {/* Type toggle */}
            <div style={S.typeRow}>
              <TypeBtn label="💰 Mapato"  active={form.type === "mapato"}  color={T.green} onClick={() => setForm((f)=>({...f, type:"mapato",  category:"mauzo"}))} />
              <TypeBtn label="💸 Gharama" active={form.type === "gharama"} color={T.red}   onClick={() => setForm((f)=>({...f, type:"gharama", category:"malighafi"}))} />
            </div>

            {/* Amount */}
            <Label text="Kiasi" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.gray400, whiteSpace: "nowrap" }}>TZS</span>
              <input
                style={{ ...S.input, fontSize: 28, fontWeight: 800, color: T.gray900, padding: "10px 14px" }}
                type="number" inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
              />
            </div>

            <Label text="Aina ya Biashara" />
            <select style={S.select} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>

            <Label text="Bidhaa / Huduma (hiari)" />
            <input style={S.input} value={form.product_name}
              onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
              placeholder="mf. Ndizi, Unga, Useremala…" />

            <Label text="Tarehe" />
            <input style={S.input} type="date" value={form.transaction_date}
              onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />

            <Label text="Maelezo (hiari)" />
            <textarea style={{ ...S.input, height: 60, resize: "vertical" }}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Maelezo ya ziada…" />

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={S.btnOutline} onClick={() => { recorder.reset(); setTab("rekodi"); }}>← Rudi</button>
              <button style={{ ...S.btnPrimary, flex: 2 }} onClick={handleSave} disabled={saving}>
                {saving ? "Inahifadhi…" : "💾 Hifadhi"}
              </button>
            </div>
          </Section>
        )}

        {/* ══════ DAFTARI TAB (ledger) ══════ */}
        {tab === "daftari" && (
          <>
            {/* Summary pills */}
            {summary && (
              <div style={S.pillRow}>
                <SumPill label="Mapato" value={fmt(summary.total_revenue)}  color={T.green} />
                <SumPill label="Gharama" value={fmt(summary.total_cost)}    color={T.red} />
                <SumPill label="Faida"  value={fmt(summary.net_profit)}     color={summary.net_profit >= 0 ? T.green : T.red} />
              </div>
            )}

            <div style={{ ...S.card, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <CardTitle icon="📒" text="Miamala Yangu" inline />
                <button style={S.iconBtn} onClick={reload} title="Onyesha upya">🔄</button>
              </div>

              {transactions.length === 0 ? (
                <div style={S.empty}>
                  <div style={{ fontSize: 44, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 15, color: T.gray400 }}>Hakuna miamala bado</div>
                  <div style={{ fontSize: 13, color: T.gray200, marginTop: 4 }}>Bonyeza 🎙️ kuanza kurekodi</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {transactions.map((tx) => (
                    <div key={tx.id} style={S.txItem}>
                      <div style={S.txIconBox}>{CAT_ICONS[tx.category] || "💼"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>
                            {tx.category?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: tx.type === "mapato" ? "#22c55e" : T.red, flexShrink: 0, marginLeft: 8 }}>
                            {tx.type === "mapato" ? "+" : "−"}{fmt(tx.amount)}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                          <span style={{ fontSize: 11, color: T.gray400 }}>{fmtDate(tx.transaction_date)}</span>
                          {tx.source === "voice" && <span style={S.badge}>🎙️ sauti</span>}
                          {!tx.is_synced && <span style={{ ...S.badge, background: "#fef3c7", color: "#92400e" }}>⏳</span>}
                        </div>
                        {tx.description && (
                          <div style={{ fontSize: 11, color: T.gray400, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {tx.description.length > 55 ? tx.description.slice(0, 55) + "…" : tx.description}
                          </div>
                        )}
                      </div>
                      <button style={S.deleteBtn} onClick={() => handleDelete(tx.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════ TAKWIMU TAB (analytics — replaces AnalyticsDashboard duplicate) ══════ */}
        {tab === "takwimu" && (
          <>
            {/* KPI cards */}
            {summary && (
              <div style={S.kpiGrid}>
                <KPICard icon="💰" label="Mapato"     value={fmt(summary.total_revenue)} color={T.green} />
                <KPICard icon="💸" label="Gharama"    value={fmt(summary.total_cost)}    color={T.red} />
                <KPICard icon="📈" label="Faida"      value={fmt(summary.net_profit)}    color={summary.net_profit >= 0 ? T.green : T.red} />
                <KPICard icon="📊" label="Margin"     value={(summary.profit_margin || 0) + "%"} color={T.blue} />
              </div>
            )}

            {analyticsLoading && (
              <div style={{ textAlign: "center", color: T.gray400, padding: 32, fontSize: 14 }}>
                ⏳ Inapakia takwimu…
              </div>
            )}

            {/* Revenue / Cost / Profit chart */}
            {chartData.length > 0 && (
              <div style={{ ...S.card, marginTop: 12 }}>
                <CardTitle icon="📉" text="Mwelekeo wa Wiki" inline />
                <div style={{ marginTop: 12 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={T.green} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={T.green} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={T.blue} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.gray100} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: T.gray400 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v) => `TZS ${Number(v).toLocaleString()}`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="Mapato"  stroke={T.green} fill="url(#gRev)"    strokeWidth={2.5} />
                      <Area type="monotone" dataKey="Gharama" stroke={T.red}   fill="none"           strokeWidth={2} strokeDasharray="5 5" />
                      <Area type="monotone" dataKey="Faida"   stroke={T.blue}  fill="url(#gProfit)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top products */}
            {topProducts.length > 0 && (
              <div style={{ ...S.card, marginTop: 12 }}>
                <CardTitle icon="🏆" text="Bidhaa Bora" inline />
                <div style={{ marginTop: 12 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={topProducts} layout="vertical" margin={{ left: 16, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.gray100} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: T.gray600 }} />
                      <Tooltip formatter={(v) => `TZS ${Number(v).toLocaleString()}`} />
                      <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                        {topProducts.map((_, i) => <Cell key={i} fill={T.chartColors[i % T.chartColors.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Spending donut */}
            {spending.length > 0 && (
              <div style={{ ...S.card, marginTop: 12 }}>
                <CardTitle icon="🥧" text="Mchanganuo wa Gharama" inline />
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={spending} dataKey="amount" nameKey="category" cx="50%" cy="50%"
                        outerRadius={80} innerRadius={48} paddingAngle={3}>
                        {spending.map((_, i) => <Cell key={i} fill={T.chartColors[i % T.chartColors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `TZS ${Number(v).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    {spending.map((item, i) => (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: T.chartColors[i % T.chartColors.length], flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: T.gray600 }}>{item.category}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.gray900 }}>{item.percent}%</span>
                        </div>
                        <div style={{ background: T.gray100, borderRadius: 4, height: 5 }}>
                          <div style={{ width: `${item.percent}%`, height: "100%", borderRadius: 4, background: T.chartColors[i % T.chartColors.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!analyticsLoading && chartData.length === 0 && topProducts.length === 0 && (
              <div style={{ ...S.card, marginTop: 12, textAlign: "center", padding: "32px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
                <div style={{ color: T.gray400, fontSize: 14 }}>Hakuna takwimu bado. Ongeza miamala kwanza.</div>
                <button style={{ ...S.btnPrimary, marginTop: 16, width: "auto", padding: "10px 24px" }} onClick={() => setTab("rekodi")}>
                  + Ongeza Muamala
                </button>
              </div>
            )}
          </>
        )}

        {/* ══════ MSHAURI AI TAB ══════ */}
        {tab === "mshauri" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "60vh" }}>
            {/* Chat header */}
            <div style={{ ...S.card, marginBottom: 8, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: `linear-gradient(135deg, ${T.purple}, ${T.blue})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0,
              }}>🤖</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.gray900 }}>Mshauri Wangu AI</div>
                <div style={{ fontSize: 12, color: T.green }}>● Mtaalam wa Biashara ya SME</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ ...S.card, flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10, padding: 12, minHeight: 300, maxHeight: 420 }}>
              {aiMessages.map((m, i) => (
                <div key={i} style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}>
                  <div style={{
                    maxWidth: "85%",
                    background: m.role === "user"
                      ? `linear-gradient(135deg, ${T.green}, ${T.greenMid})`
                      : T.gray50,
                    color: m.role === "user" ? T.white : T.gray900,
                    borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    padding: "10px 14px",
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex" }}>
                  <div style={{ background: T.gray50, borderRadius: "18px 18px 18px 4px", padding: "10px 16px", fontSize: 20 }}>
                    <span style={{ animation: "bounce 1s infinite" }}>⋯</span>
                  </div>
                </div>
              )}
              <div ref={aiEndRef} />
            </div>

            {/* Quick suggestions */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 0", scrollbarWidth: "none" }}>
              {MSHAURI_SUGGESTIONS.map((s) => (
                <button key={s} style={S.suggestionBtn} onClick={() => setAiInput(s)}>
                  {s}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                style={{ ...S.input, flex: 1, margin: 0 }}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                placeholder="Uliza swali lolote kwa Kiswahili…"
              />
              <button
                style={{
                  ...S.btnPrimary,
                  flex: "none",
                  width: 48, height: 48, padding: 0, borderRadius: 12,
                  fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: aiLoading || !aiInput.trim() ? 0.5 : 1,
                }}
                onClick={handleAsk}
                disabled={aiLoading || !aiInput.trim()}
              >
                ↑
              </button>
            </div>

            <p style={{ fontSize: 11, color: T.gray400, textAlign: "center", marginTop: 8 }}>
              Mshauri wa AI · Itaunganishwa na Gemini hivi karibuni
            </p>
          </div>
        )}

        {/* ══════ KADI TAB (health card) ══════ */}
        {tab === "kadi" && (
          <Section>
            <CardTitle icon="🏥" text="Kadi ya Afya ya Biashara" />
            <p style={S.hint}>Baada ya miamala 30+ na siku 90, unaweza kupakua ripoti ya PDF inayofaa kwa maombi ya mkopo.</p>

            {summary && (
              <div style={{
                background: T.greenLight, borderRadius: 12, padding: 14,
                marginBottom: 16, textAlign: "center", border: `1px solid ${T.greenMid}30`,
              }}>
                {summary.transactions_count >= 30 ? (
                  <div style={{ color: T.green, fontWeight: 700, fontSize: 15 }}>
                    ✅ Unastahili! Miamala {summary.transactions_count}/30+
                  </div>
                ) : (
                  <div>
                    <div style={{ color: "#92400e", fontWeight: 600, marginBottom: 8 }}>
                      ⏳ Miamala {summary.transactions_count}/30 · Unahitaji {30 - summary.transactions_count} zaidi
                    </div>
                    <div style={{ background: T.gray100, borderRadius: 6, height: 8 }}>
                      <div style={{
                        width: `${Math.min(100, (summary.transactions_count / 30) * 100)}%`,
                        height: "100%", borderRadius: 6, background: T.amber, transition: "width 0.6s",
                      }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ border: `2px dashed ${T.greenMid}60`, borderRadius: 16, padding: "28px 20px", textAlign: "center", margin: "16px 0" }}>
              <div style={{ fontSize: 52 }}>📄</div>
              <div style={{ fontWeight: 700, color: T.green, fontSize: 15, marginTop: 8 }}>Kadi ya Afya ya Biashara</div>
              <div style={{ fontSize: 13, color: T.gray400, marginTop: 8, lineHeight: 1.9 }}>
                ✔ Mapato & Gharama (Siku 90)<br />
                ✔ Bidhaa Bora 5<br />
                ✔ Gharama kwa Aina<br />
                ✔ Tangazo la Kisheria (SW + EN)
              </div>
            </div>

            <button style={{ ...S.btnPrimary, width: "100%" }} onClick={handleHealthCard} disabled={pdfLoading}>
              {pdfLoading ? "Inatengeneza PDF…" : "📥 Pakua Kadi ya Afya (PDF)"}
            </button>
          </Section>
        )}

      </main>

      {/* ── Bottom Navigation ──────────────────────────────────────────────── */}
      <nav style={S.nav}>
        {[
          { id: "rekodi",    icon: "🎙️", label: "Rekodi"   },
          { id: "daftari",   icon: "📒", label: "Daftari"  },
          { id: "takwimu",   icon: "📊", label: "Takwimu"  },
          { id: "mshauri",   icon: "🤖", label: "Mshauri"  },
          { id: "kadi",      icon: "🏥", label: "Kadi"     },
        ].map((n) => (
          <button key={n.id} style={{ ...S.navBtn, ...(tab === n.id ? S.navActive : {}) }} onClick={() => setTab(n.id)}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span style={{ fontSize: 9, marginTop: 1, fontWeight: tab === n.id ? 700 : 400 }}>{n.label}</span>
            {tab === n.id && <div style={S.navDot} />}
          </button>
        ))}
      </nav>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.15);opacity:0.3} }
        @keyframes bounce { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ children }) {
  return <div style={S.card}>{children}</div>;
}

function CardTitle({ icon, text, inline }) {
  const el = <div style={{ fontSize: 17, fontWeight: 700, color: T.gray900, display: "flex", alignItems: "center", gap: 6 }}><span>{icon}</span><span>{text}</span></div>;
  return inline ? el : <div style={{ marginBottom: 12 }}>{el}</div>;
}

function Label({ text }) {
  return <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.gray600, marginBottom: 5, marginTop: 12 }}>{text}</label>;
}

function Chip({ color, children }) {
  return <span style={{ background: color, color: "#fff", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{children}</span>;
}

function TypeBtn({ label, active, color, onClick }) {
  return (
    <button style={{
      flex: 1, padding: "11px 0", borderRadius: 10, border: `2px solid ${active ? color : T.gray100}`,
      background: active ? color + "18" : T.gray50, cursor: "pointer",
      fontWeight: 700, fontSize: 14, color: active ? color : T.gray400, transition: "all 0.15s",
    }} onClick={onClick}>{label}</button>
  );
}

function SumPill({ label, value, color }) {
  return (
    <div style={{ background: T.white, borderRadius: 12, padding: "10px 14px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", flex: 1, minWidth: 0, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: T.gray400, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function KPICard({ icon, label, value, color }) {
  return (
    <div style={{ background: T.white, borderRadius: 14, padding: "14px 16px", borderTop: `3px solid ${color}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 11, color: T.gray400, fontWeight: 600 }}>{icon} {label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 6 }}>{value}</div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
    background: T.gray50,
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  header: {
    background: `linear-gradient(160deg, ${T.green} 0%, #1e8449 100%)`,
    padding: "14px 20px 12px",
    color: T.white,
    boxShadow: "0 1px 0 rgba(0,0,0,0.12)",
  },
  headerInner:  { display: "flex", justifyContent: "space-between", alignItems: "center" },
  headerTitle:  { fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px" },
  headerSub:    { fontSize: 11, opacity: 0.7, marginTop: 2 },
  headerRight:  { display: "flex", gap: 6 },
  toast: {
    position: "fixed", top: 68, left: "50%", transform: "translateX(-50%)",
    color: T.white, padding: "10px 22px", borderRadius: 24, fontWeight: 600,
    fontSize: 14, zIndex: 1000, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    whiteSpace: "nowrap", pointerEvents: "none",
    animation: "fadeInDown 0.2s ease",
  },
  main: { flex: 1, padding: "16px 16px 100px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 },
  card: { background: T.white, borderRadius: 18, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" },
  recordCenter: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, margin: "24px 0", position: "relative" },
  micBtn: {
    width: 96, height: 96, borderRadius: "50%",
    background: `linear-gradient(145deg, ${T.green}, ${T.greenMid})`,
    border: "none", cursor: "pointer",
    boxShadow: `0 4px 24px ${T.green}50`,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s", userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
    position: "relative", zIndex: 2,
  },
  micActive: {
    background: `linear-gradient(145deg, #dc2626, #ef4444)`,
    boxShadow: "0 0 0 16px rgba(239,68,68,0.12), 0 4px 24px rgba(239,68,68,0.4)",
  },
  micProcessing: { background: `linear-gradient(145deg, #6b7280, #9ca3af)`, cursor: "not-allowed" },
  pulse: {
    position: "absolute", top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    width: 96, height: 96, borderRadius: "50%",
    border: "3px solid rgba(239,68,68,0.4)",
    animation: "pulse 1.5s ease-out infinite",
    pointerEvents: "none",
  },
  recordLabel: { fontSize: 13, color: T.gray400, textAlign: "center", maxWidth: 240, lineHeight: 1.5 },
  divider:     { display: "flex", alignItems: "center", margin: "20px 0" },
  dividerTxt:  { color: T.gray400, fontSize: 13, margin: "0 auto", background: T.white, padding: "0 12px" },
  transcriptBox: { background: T.greenLight, borderRadius: 10, padding: 12, borderLeft: `3px solid ${T.greenMid}`, marginBottom: 12 },
  warning: { background: "#fef3c7", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#92400e", marginBottom: 8 },
  typeRow: { display: "flex", gap: 8, marginBottom: 14 },
  input: {
    width: "100%", boxSizing: "border-box",
    border: `1.5px solid ${T.gray100}`, borderRadius: 10,
    padding: "11px 14px", fontSize: 15, color: T.gray900,
    outline: "none", background: T.gray50, fontFamily: "inherit",
    transition: "border-color 0.15s",
  },
  select: {
    width: "100%", border: `1.5px solid ${T.gray100}`, borderRadius: 10,
    padding: "11px 14px", fontSize: 15, color: T.gray900,
    outline: "none", background: T.gray50, fontFamily: "inherit",
    marginBottom: 0,
  },
  btnPrimary: {
    flex: 1, padding: "14px 0", borderRadius: 12, border: "none",
    background: `linear-gradient(145deg, ${T.green}, ${T.greenMid})`,
    color: T.white, fontWeight: 700, fontSize: 15, cursor: "pointer",
    boxShadow: `0 2px 12px ${T.green}30`, fontFamily: "inherit", letterSpacing: "-0.2px",
  },
  btnOutline: {
    flex: 1, padding: "13px 0", borderRadius: 12,
    border: `1.5px solid ${T.gray100}`, background: T.white,
    color: T.gray600, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  },
  iconBtn: {
    padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.gray100}`,
    background: T.white, cursor: "pointer", fontSize: 16, lineHeight: 1,
  },
  hint: { fontSize: 13, color: T.gray400, marginBottom: 16, lineHeight: 1.6 },
  pillRow: { display: "flex", gap: 8, marginBottom: 0 },
  txItem: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: 12, borderRadius: 12, background: T.gray50,
    border: `1px solid ${T.gray100}`, transition: "background 0.15s",
  },
  txIconBox: { fontSize: 22, marginTop: 2, flexShrink: 0 },
  badge: { fontSize: 10, background: T.greenLight, color: T.green, padding: "2px 7px", borderRadius: 10, border: `1px solid ${T.greenMid}30` },
  deleteBtn: { background: "none", border: "none", color: T.gray200, cursor: "pointer", fontSize: 20, padding: "0 4px", lineHeight: 1, flexShrink: 0 },
  empty: { textAlign: "center", padding: "36px 0" },
  kpiGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  suggestionBtn: {
    flexShrink: 0, padding: "7px 14px", borderRadius: 20,
    border: `1px solid ${T.gray100}`, background: T.white,
    color: T.gray600, fontSize: 12, fontWeight: 500, cursor: "pointer",
    whiteSpace: "nowrap", fontFamily: "inherit",
  },
  nav: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 480, background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    borderTop: `1px solid ${T.gray100}`,
    display: "flex", padding: "6px 0 env(safe-area-inset-bottom, 8px)",
    boxShadow: "0 -1px 0 rgba(0,0,0,0.06)", zIndex: 100,
  },
  navBtn: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    gap: 1, background: "none", border: "none", cursor: "pointer",
    color: T.gray200, padding: "4px 0", fontFamily: "inherit", position: "relative",
    transition: "color 0.15s",
  },
  navActive: { color: T.green },
  navDot: {
    position: "absolute", bottom: -6, width: 4, height: 4, borderRadius: "50%",
    background: T.green,
  },
};
