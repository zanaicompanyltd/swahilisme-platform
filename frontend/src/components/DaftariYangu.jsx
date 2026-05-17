// ============================================================
// DaftariYangu.jsx — SwahiliSME Platform
// Polished UI + Multi-transaction support
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

import {
  transcribeAudio, createTransaction, listTransactions,
  deleteTransaction, getSummary, getDashboardSummary,
  getRevenueCostProfit, getTopProducts, getSpendingPatterns,
  downloadHealthCard, syncOfflineQueue, getOfflineCount,
} from "../hooks/useApi";

import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import sw from "../i18n/sw";

// ── USER ID ───────────────────────────────────────────────────────────────────
const USER_ID = (() => {
  const stored = localStorage.getItem("daftari_user_id");
  if (stored) return stored;
  const id = "demo-user-001";
  localStorage.setItem("daftari_user_id", id);
  return id;
})();

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  green:      "#0d5c2f",
  greenMid:   "#1a8a47",
  greenLight: "#d6f0e0",
  greenGlow:  "rgba(26,138,71,0.15)",
  blue:       "#1a56db",
  red:        "#e02424",
  amber:      "#d97706",
  purple:     "#7e3af2",
  gray50:     "#f9fafb",
  gray100:    "#f3f4f6",
  gray200:    "#e5e7eb",
  gray400:    "#9ca3af",
  gray600:    "#4b5563",
  gray900:    "#111827",
  white:      "#ffffff",
  chart:      ["#0d5c2f","#1a56db","#d97706","#7e3af2","#e02424"],
  cardShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
  cardShadowHover: "0 4px 12px rgba(0,0,0,0.1)",
};

const INCOME_CATS = [
  { value:"mauzo",              label:"🛒 Mauzo (Bidhaa)" },
  { value:"huduma",             label:"🛠️ Huduma" },
  { value:"mkopo_uliopokelewa", label:"💵 Mkopo Uliopokelewa" },
  { value:"nyingine_mapato",    label:"💰 Mapato Mengine" },
];
const EXPENSE_CATS = [
  { value:"malighafi",        label:"📦 Malighafi" },
  { value:"mishahara",        label:"👷 Mishahara" },
  { value:"kodi",             label:"🏠 Kodi / Pango" },
  { value:"umeme",            label:"⚡ Umeme" },
  { value:"usafiri",          label:"🚗 Usafiri" },
  { value:"matangazo",        label:"📢 Matangazo" },
  { value:"mkopo_uliolipwa",  label:"🏦 Mkopo Uliolipwa" },
  { value:"nyingine_gharama", label:"💸 Gharama Nyingine" },
];
const CAT_ICONS = {
  mauzo:"🛒",huduma:"🛠️",mkopo_uliopokelewa:"💵",nyingine_mapato:"💰",
  malighafi:"📦",mishahara:"👷",kodi:"🏠",umeme:"⚡",
  usafiri:"🚗",matangazo:"📢",mkopo_uliolipwa:"🏦",nyingine_gharama:"💸",
};

const AI_SUGGESTIONS = [
  "Je, biashara yangu inafanya vizuri?",
  "Ninaweza kukopa mkopo?",
  "Ninajisajili vipi TRA?",
  "Bidhaa gani inaleta faida zaidi?",
];

export async function askMshauri(question, summary) {
  const apiKey = process.env.REACT_APP_GEMINI_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `
    Wewe ni 'Mshauri Wangu', mshauri wa biashara Tanzania.
    Jibu kwa Kiswahili rahisi na mistari michache tu (si zaidi ya 3).
    Tumia muktadha wa TRA, ZRB, BRELA, NSSF ukipatikana.
    Kama hakuna, toa ushauri wa jumla wa biashara na faida.
  `;

  const body = {
    contents: [
      { role: "system", parts: [{ text: systemPrompt }] },
      { role: "user",   parts: [{ text: question }] }
    ]
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ Hakuna jibu.";
  } catch (err) {
    console.error("Gemini error:", err);
    return "⚠️ Hitilafu ya mtandao au API.";
  }
}

// DaftariYangu.jsx
export async function askMshauri(question, summary) {
  const apiKey = process.env.REACT_APP_GEMINI_KEY; // put in .env
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `
    Wewe ni 'Mshauri Wangu', mshauri wa biashara Tanzania.
    Jibu kwa Kiswahili rahisi na mistari michache tu (si zaidi ya 3).
    Tumia muktadha wa TRA, ZRB, BRELA, NSSF ukipatikana.
    Kama hakuna, toa ushauri wa jumla wa biashara na faida.
  `;

  const body = {
    contents: [
      { role: "system", parts: [{ text: systemPrompt }] },
      { role: "user", parts: [{ text: question }] }
    ]
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ Hakuna jibu.";
  } catch (err) {
    console.error("Gemini error:", err);
    return "⚠️ Hitilafu ya mtandao au API.";
  }
}

const fmt    = (n) => "TZS " + Number(n || 0).toLocaleString();
const fmtNum = (n) => Number(n || 0).toLocaleString();

function fmtDate(iso) {
  if (!iso) return "";
  const d     = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const today = new Date();
  const yest  = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Leo";
  if (d.toDateString() === yest.toDateString())  return "Jana";
  return d.toLocaleDateString("sw-TZ", { day:"numeric", month:"short" });
}

const EMPTY_FORM = {
  type:"mapato", category:"mauzo", amount:"", description:"",
  product_name:"", quantity:"",
  transaction_date: new Date().toISOString().slice(0, 10),
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function DaftariYangu() {
  const [tab, setTab]          = useState("rekodi");
  const [transactions, setTxs] = useState([]);
  const [summary, setSummary]  = useState(null);
  const [offlineCount, setOff] = useState(0);
  const [toast, setToast]      = useState(null);

  const [transcript, setTranscript]     = useState("");
  const [nlpData, setNlp]               = useState(null);
  const [allTransactions, setAllTxs]    = useState([]);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [pdfLoading, setPdf]            = useState(false);
  const [transcribing, setTrans]        = useState(false);

  const [analyticsLoaded, setAL]   = useState(false);
  const [analyticsLoading, setALd] = useState(false);
  const [chartData, setChart]      = useState([]);
  const [topProducts, setTopP]     = useState([]);
  const [spending, setSpend]       = useState([]);
  const [dashSummary, setDashSum]  = useState(null);

  const [aiMessages, setAiMsgs] = useState([{
    role:"ai",
    text:"Habari! Mimi ni Mshauri wako wa AI. Niulize chochote kuhusu biashara yako — mapato, gharama, mikopo, TRA, na zaidi! 🤖"
  }]);
  const [aiInput, setAiInput]   = useState("");
  const [aiLoading, setAiLoad]  = useState(false);
  const aiEndRef                 = useRef(null);
  const recorder = useVoiceRecorder();

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const reload = useCallback(async () => {
    try {
      const [txs, sum] = await Promise.all([
        listTransactions(USER_ID, { limit:50 }),
        getSummary(USER_ID, 30),
      ]);
      setTxs(Array.isArray(txs) ? txs : []);
      setSummary(sum);
    } catch (e) {
      showToast("⚠️ " + e.message, "error");
    }
    setOff(getOfflineCount());
  }, []); // eslint-disable-line

  const reloadAnalytics = useCallback(async () => {
    if (analyticsLoaded) return;
    setALd(true);
    try {
      const [chart, products, spend, dash] = await Promise.all([
        getRevenueCostProfit(USER_ID, 7),
        getTopProducts(USER_ID, "week"),
        getSpendingPatterns(USER_ID, "week"),
        getDashboardSummary(USER_ID, "week"),
      ]);
      if (chart?.labels?.length) {
        setChart(chart.labels.map((label, i) => ({
          day:     label,
          Mapato:  chart.revenue?.[i] || 0,
          Gharama: chart.cost?.[i]    || 0,
          Faida:   chart.profit?.[i]  || 0,
        })));
      }
      setTopP(products?.products || (Array.isArray(products) ? products : []));
      setSpend(spend?.categories  || (Array.isArray(spend)   ? spend    : []));
      setDashSum(dash);
      setAL(true);
    } catch (e) {
      showToast("⚠️ Takwimu: " + e.message, "error");
    }
    setALd(false);
  }, [analyticsLoaded]); // eslint-disable-line

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (tab === "takwimu") reloadAnalytics(); }, [tab]); // eslint-disable-line
  useEffect(() => {
    const go = async () => {
      if (getOfflineCount() > 0) {
        showToast("🔄 Inasawazisha…", "info");
        const res = await syncOfflineQueue(USER_ID);
        if (res.synced > 0) { showToast(`✅ ${res.synced} imesawazishwa`, "success"); reload(); }
      }
    };
    window.addEventListener("online", go);
    return () => window.removeEventListener("online", go);
  }, [reload]);
  useEffect(() => {
    if (recorder.audioBlob && recorder.state === "processing") handleTranscribe(recorder.audioBlob);
  }, [recorder.audioBlob, recorder.state]); // eslint-disable-line
  useEffect(() => {
    if (tab === "mshauri") aiEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [aiMessages, tab]);

  // ── Transcribe ──────────────────────────────────────────────────────────────
  async function handleTranscribe(blob) {
    setTrans(true);
    try {
      const result = await transcribeAudio(USER_ID, blob, "audio.webm");
      setTranscript(result.transcript || "");
      if (result.nlp) {
        const n   = result.nlp;
        const all = n.all_transactions || [];
        setNlp(n);
        if (all.length > 1) {
          setAllTxs(all);
          setForm(EMPTY_FORM);
        } else {
          setAllTxs([]);
          setForm((f) => ({
            ...f,
            type:             n.transaction_type || f.type,
            category:         n.category         || f.category,
            amount:           n.amount != null    ? String(n.amount)   : f.amount,
            description:      result.transcript   || f.description,
            product_name:     n.product_name      || f.product_name,
            quantity:         n.quantity != null   ? String(n.quantity) : f.quantity,
            transaction_date: n.transaction_date   ? n.transaction_date.slice(0,10) : f.transaction_date,
          }));
        }
      }
      setTab("thibitisha");
    } catch (err) {
      showToast("❌ " + (err.message || "Hitilafu ya kurekodi"), "error");
      recorder.reset();
    } finally { setTrans(false); }
  }

  // ── Save single ─────────────────────────────────────────────────────────────
  async function handleSave() {
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) {
      showToast("Tafadhali weka kiasi sahihi (zaidi ya 0)", "error"); return;
    }
    setSaving(true);
    try {
      const result = await createTransaction({
        user_id:          USER_ID,
        type:             form.type,
        category:         form.category,
        amount,
        description:      form.description || null,
        transaction_date: form.transaction_date,
        source:           transcript ? "voice" : "manual",
        raw_transcript:   transcript  || null,
        nlp_confidence:   nlpData?.confidence || null,
        product_name:     form.product_name   || null,
        quantity:         form.quantity ? parseFloat(form.quantity) : null,
        nlp_entities:     nlpData || null,
      });
      if (result.offline) {
        showToast("📴 Imehifadhiwa nje ya mtandao. Itasawazishwa baadaye.", "warning");
      } else {
        showToast("✅ Muamala umehifadhiwa!", "success");
      }
      setTranscript(""); setNlp(null); setAllTxs([]); setForm(EMPTY_FORM); recorder.reset();
      setAL(false); setTab("daftari"); reload();
    } catch (err) {
      showToast("❌ " + (err.message || "Hitilafu ya kuhifadhi"), "error");
    } finally { setSaving(false); }
  }

  // ── Save all (multiple) ─────────────────────────────────────────────────────
  async function handleSaveAll() {
    if (!allTransactions.length) return;
    setSaving(true);
    let saved = 0; let failed = 0;
    for (const tx of allTransactions) {
      try {
        await createTransaction({
          user_id:          USER_ID,
          type:             tx.transaction_type,
          category:         tx.category,
          amount:           parseFloat(tx.amount),
          description:      tx.description || transcript || "",
          transaction_date: tx.transaction_date ? tx.transaction_date.slice(0,10) : new Date().toISOString().slice(0,10),
          source:           "voice",
          raw_transcript:   transcript || null,
          nlp_confidence:   tx.confidence || nlpData?.confidence || null,
          product_name:     tx.product_name || null,
          quantity:         tx.quantity ? parseFloat(tx.quantity) : null,
          nlp_entities:     tx || null,
        });
        saved++;
      } catch (err) { console.error("[saveAll]", err); failed++; }
    }
    setSaving(false);
    if (failed === 0) showToast(`✅ Miamala ${saved} imehifadhiwa!`, "success");
    else showToast(`⚠️ ${saved} imehifadhiwa, ${failed} imeshindwa`, "warning");
    setTranscript(""); setNlp(null); setAllTxs([]); setForm(EMPTY_FORM); recorder.reset();
    setAL(false); setTab("daftari"); reload();
  }

  async function handleDelete(id) {
    if (!window.confirm("Futa muamala huu?")) return;
    try {
      await deleteTransaction(id, USER_ID);
      showToast("🗑️ Imefutwa", "info");
      setAL(false); reload();
    } catch (err) { showToast("❌ " + err.message, "error"); }
  }

  async function handleHealthCard() {
    setPdf(true);
    try { await downloadHealthCard(USER_ID, 90); showToast("✅ PDF imepakuliwa!", "success"); }
    catch (err) { showToast("❌ " + err.message, "error"); }
    finally { setPdf(false); }
  }

  async function handleAsk() {
    const q = aiInput.trim();
    if (!q || aiLoading) return;
    setAiMsgs((m) => [...m, { role:"user", text:q }]);
    setAiInput(""); setAiLoad(true);
    try {
      const answer = await askMshauri(q, summary);
      setAiMsgs((m) => [...m, { role:"ai", text:answer }]);
    } catch { setAiMsgs((m) => [...m, { role:"ai", text:"Samahani, hitilafu imetokea. Jaribu tena." }]); }
    finally { setAiLoad(false); }
  }

  const categories = form.type === "mapato" ? INCOME_CATS : EXPENSE_CATS;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.app}>
      <style>{CSS}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={S.hInner}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={S.headerLogo}>📒</div>
            <div>
              <div style={S.hTitle}>Daftari Yangu</div>
              <div style={S.hSub}>
                {navigator.onLine
                  ? <span style={{ color:"#6ee7b7" }}>● Mtandaoni</span>
                  : <span style={{ color:"#fca5a5" }}>● Nje ya mtandao</span>}
                {" · "}{USER_ID}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {offlineCount > 0 && (
              <span style={S.badge}>⏳ {offlineCount}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          ...S.toast,
          background: toast.type==="error" ? T.red : toast.type==="warning" ? T.amber : toast.type==="info" ? T.blue : T.greenMid,
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main style={S.main}>

        {/* ════ REKODI ════ */}
        {tab === "rekodi" && (
          <div className="fadeIn">
            <Card>
              <STitle icon="🎙️" text="Rekodi Muamala Wako" />
              <p style={S.hint}>
                Sema kwa Kiswahili — mfano: <em style={{ color:T.greenMid }}>"Nimeuza ndizi elfu ishirini"</em>
              </p>

              <div style={S.recordCenter}>
                <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {recorder.isRecording && <div style={S.pulseOuter} className="pulse" />}
                  {recorder.isRecording && <div style={S.pulseInner} className="pulse2" />}
                  <button
                    style={{
                      ...S.mic,
                      ...(recorder.isRecording ? S.micRec : {}),
                      ...(transcribing ? S.micWait : {}),
                    }}
                    onMouseDown={recorder.startRecording}
                    onMouseUp={recorder.stopRecording}
                    onTouchStart={(e) => { e.preventDefault(); recorder.startRecording(); }}
                    onTouchEnd={(e)   => { e.preventDefault(); recorder.stopRecording(); }}
                    disabled={transcribing}
                  >
                    <span style={{ fontSize:44, lineHeight:1 }}>
                      {transcribing ? "⏳" : recorder.isRecording ? "⏹" : "🎙️"}
                    </span>
                  </button>
                </div>

                <div style={S.recordLabel}>
                  {transcribing
                    ? <span style={{ color:T.greenMid, fontWeight:600 }}>⚡ Inachakata sauti…</span>
                    : recorder.isRecording
                    ? <span style={{ color:T.red, fontWeight:600 }}>🔴 Inaandika… ({recorder.duration||0}s)</span>
                    : <span>Shikilia kurekodi · au bonyeza mara moja</span>}
                </div>

                {recorder.error && (
                  <div style={{ color:T.red, fontSize:13, textAlign:"center", padding:"8px 16px", background:"#fff1f2", borderRadius:8 }}>
                    {recorder.error}
                  </div>
                )}
              </div>

              <div style={S.divider}><span style={S.dividerTxt}>au ingiza kwa mkono</span></div>

              <button
                style={S.btnOutline}
                onClick={() => { setTranscript(""); setNlp(null); setAllTxs([]); setTab("thibitisha"); }}
              >
                ✏️ Ingiza Mwenyewe
              </button>
            </Card>

            {/* Tips */}
            <div style={{ marginTop:16, padding:"14px 16px", background:T.greenLight, borderRadius:14, border:`1px solid ${T.greenMid}30` }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.green, marginBottom:8 }}>💡 Mifano ya kusema:</div>
              {[
                "Nimeuza samaki kilo tano, shilingi elfu kumi na tano",
                "Nililipa kodi ya duka shilingi laki moja",
                "Nimenunua unga mifuko kumi kwa shilingi elfu thelathini",
              ].map((tip, i) => (
                <div key={i} style={{ fontSize:12, color:T.gray600, marginBottom:4, display:"flex", gap:6 }}>
                  <span style={{ color:T.greenMid }}>→</span>
                  <em>"{tip}"</em>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ THIBITISHA ════ */}
        {tab === "thibitisha" && (
          <div className="fadeIn">
            <Card>
              <STitle icon="✅" text="Thibitisha Muamala" />

              {transcript && (
                <div style={S.transcriptBox}>
                  <div style={{ fontSize:11, color:T.gray400, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>
                    🎙️ Ulichosema
                  </div>
                  <div style={{ fontSize:14, color:T.gray900, fontStyle:"italic", lineHeight:1.6 }}>
                    "{transcript}"
                  </div>
                  {nlpData?.confidence != null && (
                    <div style={{ fontSize:11, color:T.greenMid, marginTop:6, fontWeight:600 }}>
                      ✓ Uhalisi wa AI: {Math.round(nlpData.confidence * 100)}%
                    </div>
                  )}
                </div>
              )}

              {nlpData?.warnings?.map((w, i) => (
                <div key={i} style={S.warning}>⚠️ {w}</div>
              ))}

              {/* ── MULTIPLE TRANSACTIONS ── */}
              {allTransactions.length > 1 ? (
                <>
                  <div style={{ fontSize:13, fontWeight:700, color:T.gray900, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ background:T.greenLight, color:T.green, padding:"2px 10px", borderRadius:20, fontSize:12 }}>
                      {allTransactions.length} Miamala
                    </span>
                    imepatikana kutoka sauti yako
                  </div>

                  <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
                    {allTransactions.map((tx, i) => (
                      <div key={i} style={{
                        padding:"12px 14px",
                        borderRadius:12,
                        background: tx.transaction_type === "mapato" ? "#f0fdf4" : "#fff5f5",
                        border:`1.5px solid ${tx.transaction_type === "mapato" ? "#bbf7d0" : "#fecaca"}`,
                        display:"flex",
                        justifyContent:"space-between",
                        alignItems:"flex-start",
                        gap:8,
                      }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                            <span style={{ fontSize:16 }}>
                              {tx.transaction_type === "mapato" ? "💰" : "💸"}
                            </span>
                            <span style={{ fontSize:13, fontWeight:700, color:T.gray900 }}>
                              {(tx.category||"").replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}
                            </span>
                          </div>
                          {tx.description && (
                            <div style={{ fontSize:11, color:T.gray600, marginBottom:2 }}>{tx.description}</div>
                          )}
                          {tx.product_name && (
                            <div style={{ fontSize:11, color:T.gray400 }}>
                              📦 {tx.product_name}{tx.quantity ? ` × ${tx.quantity}` : ""}
                            </div>
                          )}
                        </div>
                        <div style={{
                          fontSize:15, fontWeight:800, flexShrink:0,
                          color: tx.transaction_type === "mapato" ? "#16a34a" : T.red,
                        }}>
                          {tx.transaction_type === "mapato" ? "+" : "−"}
                          {fmt(tx.amount)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:"flex", gap:10 }}>
                    <button style={S.btnOutline} onClick={() => { recorder.reset(); setTab("rekodi"); }}>← Rudi</button>
                    <button style={{ ...S.btnPrimary, flex:2 }} onClick={handleSaveAll} disabled={saving}>
                      {saving ? "Inahifadhi…" : `💾 Hifadhi Miamala Yote (${allTransactions.length})`}
                    </button>
                  </div>
                </>
              ) : (
                /* ── SINGLE TRANSACTION ── */
                <>
                  <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                    <TogBtn label="💰 Mapato"  active={form.type==="mapato"}  color={T.greenMid}
                      onClick={() => setForm((f) => ({ ...f, type:"mapato",  category:"mauzo" }))} />
                    <TogBtn label="💸 Gharama" active={form.type==="gharama"} color={T.red}
                      onClick={() => setForm((f) => ({ ...f, type:"gharama", category:"malighafi" }))} />
                  </div>

                  <FLabel text="Kiasi (TZS)" />
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:T.gray400, flexShrink:0 }}>TZS</span>
                    <input
                      style={{ ...S.input, fontSize:26, fontWeight:800, color:T.gray900, padding:"10px 14px" }}
                      type="number" inputMode="numeric" value={form.amount} autoFocus
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                    />
                  </div>

                  <FLabel text="Aina ya Biashara" />
                  <select style={S.select} value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>

                  <FLabel text="Bidhaa / Huduma (hiari)" />
                  <input style={S.input} value={form.product_name}
                    onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                    placeholder="mf. Ndizi, Unga, Useremala…" />

                  <FLabel text="Tarehe" />
                  <input style={S.input} type="date" value={form.transaction_date}
                    onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />

                  <FLabel text="Maelezo (hiari)" />
                  <textarea style={{ ...S.input, height:64, resize:"vertical" }}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Maelezo ya ziada…" />

                  <div style={{ display:"flex", gap:10, marginTop:18 }}>
                    <button style={S.btnOutline} onClick={() => { recorder.reset(); setTab("rekodi"); }}>← Rudi</button>
                    <button style={{ ...S.btnPrimary, flex:2 }} onClick={handleSave} disabled={saving}>
                      {saving ? "Inahifadhi…" : "💾 Hifadhi kwenye Database"}
                    </button>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {/* ════ DAFTARI ════ */}
        {tab === "daftari" && (
          <div className="fadeIn">
            {/* Summary row */}
            {summary && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                {[
                  { label:"Mapato",  value:summary.total_revenue, color:T.greenMid, icon:"📈" },
                  { label:"Gharama", value:summary.total_cost,    color:T.red,      icon:"📉" },
                  { label:"Faida",   value:summary.net_profit,    color:summary.net_profit>=0?T.greenMid:T.red, icon:"💎" },
                ].map((s) => (
                  <div key={s.label} style={{
                    background:T.white, borderRadius:14, padding:"12px 10px",
                    boxShadow:T.cardShadow, borderTop:`3px solid ${s.color}`,
                    textAlign:"center",
                  }}>
                    <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontSize:10, color:T.gray400, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px" }}>{s.label}</div>
                    <div style={{ fontSize:11, fontWeight:800, color:s.color, marginTop:4, wordBreak:"break-all" }}>
                      {fmt(s.value)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <STitle icon="📒" text={`Miamala (${transactions.length})`} inline />
                <button style={S.iconBtn} onClick={() => { setAL(false); reload(); }} title="Onyesha upya">🔄</button>
              </div>

              {transactions.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px" }}>
                  <div style={{ fontSize:52, marginBottom:12 }}>📭</div>
                  <div style={{ fontSize:15, fontWeight:600, color:T.gray600 }}>Hakuna miamala bado</div>
                  <div style={{ fontSize:13, color:T.gray400, marginTop:6 }}>Bonyeza 🎙️ hapo chini kuanza</div>
                  <button style={{ ...S.btnPrimary, marginTop:16, padding:"10px 24px", width:"auto" }}
                    onClick={() => setTab("rekodi")}>
                    + Ongeza Muamala
                  </button>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {transactions.map((tx) => (
                    <div key={tx.id} style={S.txRow} className="txRow">
                      <div style={{ width:40, height:40, borderRadius:12, background:tx.type==="mapato"?"#f0fdf4":"#fff5f5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                        {CAT_ICONS[tx.category] || "💼"}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:13, fontWeight:700, color:T.gray900 }}>
                            {(tx.category||"").replace(/_/g," ").replace(/\b\w/g,(l)=>l.toUpperCase())}
                          </span>
                          <span style={{ fontSize:14, fontWeight:800, color:tx.type==="mapato"?"#16a34a":T.red, flexShrink:0, marginLeft:8 }}>
                            {tx.type==="mapato"?"+":"−"}{fmt(tx.amount)}
                          </span>
                        </div>
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:4 }}>
                          <span style={{ fontSize:11, color:T.gray400 }}>{fmtDate(tx.transaction_date)}</span>
                          {tx.source==="voice" && (
                            <span style={{ fontSize:10, background:T.greenLight, color:T.green, padding:"1px 8px", borderRadius:10, fontWeight:600 }}>🎙️ sauti</span>
                          )}
                          {!tx.is_synced && (
                            <span style={{ fontSize:10, background:"#fef3c7", color:"#92400e", padding:"1px 8px", borderRadius:10 }}>⏳</span>
                          )}
                        </div>
                        {tx.description && (
                          <div style={{ fontSize:11, color:T.gray400, marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {tx.description}
                          </div>
                        )}
                      </div>
                      <button style={S.deleteBtn} onClick={() => handleDelete(tx.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ════ TAKWIMU ════ */}
        {tab === "takwimu" && (
          <div className="fadeIn">
            {(dashSummary || summary) && (() => {
              const d = dashSummary || summary;
              return (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                  {[
                    { icon:"💰", label:"Mapato",  value:fmt(d.total_revenue), color:T.greenMid },
                    { icon:"💸", label:"Gharama", value:fmt(d.total_cost),    color:T.red },
                    { icon:"📈", label:"Faida",   value:fmt(d.net_profit),    color:d.net_profit>=0?T.greenMid:T.red },
                    { icon:"📊", label:"Margin",  value:`${d.profit_margin||0}%`, color:T.blue },
                  ].map((k) => (
                    <div key={k.label} style={{ background:T.white, borderRadius:14, padding:"14px 16px", borderTop:`3px solid ${k.color}`, boxShadow:T.cardShadow }}>
                      <div style={{ fontSize:11, color:T.gray400, fontWeight:600 }}>{k.icon} {k.label}</div>
                      <div style={{ fontSize:15, fontWeight:800, color:k.color, marginTop:6 }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {analyticsLoading && (
              <div style={{ textAlign:"center", color:T.gray400, padding:32, fontSize:14 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>⏳</div>
                Inapakia takwimu…
              </div>
            )}

            {chartData.length > 0 && (
              <Card style={{ marginBottom:12 }}>
                <STitle icon="📉" text="Mwelekeo wa Wiki" inline />
                <div style={{ marginTop:16 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top:4, right:8, bottom:0, left:0 }}>
                      <defs>
                        <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={T.greenMid} stopOpacity={.35}/>
                          <stop offset="95%" stopColor={T.greenMid} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={T.blue} stopOpacity={.25}/>
                          <stop offset="95%" stopColor={T.blue} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.gray100} />
                      <XAxis dataKey="day" tick={{ fontSize:11, fill:T.gray400 }} />
                      <YAxis tick={{ fontSize:10 }} tickFormatter={(v)=>`${(v/1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v,name)=>[`TZS ${Number(v).toLocaleString()}`,name]} contentStyle={{ borderRadius:10, border:"none", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }} />
                      <Legend wrapperStyle={{ fontSize:12 }} />
                      <Area type="monotone" dataKey="Mapato"  stroke={T.greenMid} fill="url(#gR)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="Gharama" stroke={T.red}      fill="none"      strokeWidth={2} strokeDasharray="5 5" />
                      <Area type="monotone" dataKey="Faida"   stroke={T.blue}     fill="url(#gP)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {topProducts.length > 0 && (
              <Card style={{ marginBottom:12 }}>
                <STitle icon="🏆" text="Bidhaa Bora" inline />
                <div style={{ marginTop:16 }}>
                  <ResponsiveContainer width="100%" height={Math.max(160, topProducts.length * 44)}>
                    <BarChart data={topProducts} layout="vertical" margin={{ left:12, right:24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.gray100} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={(v)=>`${(v/1000).toFixed(0)}K`} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize:10, fill:T.gray600 }} />
                      <Tooltip formatter={(v)=>[`TZS ${Number(v).toLocaleString()}`,"Mapato"]} contentStyle={{ borderRadius:10, border:"none", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }} />
                      <Bar dataKey="revenue" radius={[0,8,8,0]}>
                        {topProducts.map((_,i)=><Cell key={i} fill={T.chart[i%T.chart.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {spending.length > 0 && (
              <Card style={{ marginBottom:12 }}>
                <STitle icon="🥧" text="Mchanganuo wa Gharama" inline />
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center", marginTop:16 }}>
                  <ResponsiveContainer width={170} height={170}>
                    <PieChart>
                      <Pie data={spending} dataKey="amount" nameKey="category" cx="50%" cy="50%"
                        outerRadius={80} innerRadius={50} paddingAngle={3}>
                        {spending.map((_,i)=><Cell key={i} fill={T.chart[i%T.chart.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v)=>`TZS ${Number(v).toLocaleString()}`} contentStyle={{ borderRadius:10, border:"none" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex:1, minWidth:140 }}>
                    {spending.map((item,i)=>(
                      <div key={i} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:9, height:9, borderRadius:2, background:T.chart[i%T.chart.length], flexShrink:0 }} />
                            <span style={{ fontSize:11, color:T.gray600 }}>{item.category}</span>
                          </div>
                          <span style={{ fontSize:11, fontWeight:700 }}>{item.percent}%</span>
                        </div>
                        <div style={{ background:T.gray100, borderRadius:4, height:5 }}>
                          <div style={{ width:`${item.percent}%`, height:"100%", borderRadius:4, background:T.chart[i%T.chart.length], transition:"width 0.5s" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <button
              style={{ ...S.btnOutline, width:"100%", marginBottom:12 }}
              onClick={() => { setAL(false); reloadAnalytics(); }}
              disabled={analyticsLoading}
            >
              {analyticsLoading ? "⏳ Inapakia…" : "🔄 Onyesha Upya Takwimu"}
            </button>

            {!analyticsLoading && chartData.length === 0 && (
              <Card style={{ textAlign:"center", padding:"32px 20px" }}>
                <div style={{ fontSize:44, marginBottom:12 }}>📊</div>
                <div style={{ color:T.gray400, fontSize:14, marginBottom:16 }}>
                  Hakuna takwimu bado. Ongeza miamala kwanza.
                </div>
                <button style={{ ...S.btnPrimary, padding:"10px 24px", width:"auto" }}
                  onClick={() => setTab("rekodi")}>
                  + Ongeza Muamala
                </button>
              </Card>
            )}
          </div>
        )}

        {/* ════ MSHAURI AI ════ */}
        {tab === "mshauri" && (
          <div className="fadeIn" style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <Card>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <div style={{ width:50, height:50, borderRadius:"50%", background:`linear-gradient(135deg,${T.purple},${T.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0, boxShadow:`0 4px 12px ${T.purple}40` }}>🤖</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:T.gray900 }}>Mshauri Wangu AI</div>
                  <div style={{ fontSize:12, color:T.green, marginTop:2 }}>● Mtaalam wa Biashara · Powered by Gemini</div>
                </div>
              </div>
            </Card>

            <Card style={{ minHeight:280, maxHeight:420, overflow:"auto", display:"flex", flexDirection:"column", gap:10 }}>
              {aiMessages.map((m, i) => (
                <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                  <div style={{
                    maxWidth:"85%",
                    background: m.role==="user" ? `linear-gradient(135deg,${T.green},${T.greenMid})` : T.gray50,
                    color: m.role==="user" ? T.white : T.gray900,
                    borderRadius: m.role==="user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    padding:"11px 15px", fontSize:14, lineHeight:1.6,
                    whiteSpace:"pre-wrap", boxShadow:T.cardShadow,
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display:"flex" }}>
                  <div style={{ background:T.gray50, borderRadius:"18px 18px 18px 4px", padding:"12px 18px", fontSize:18, color:T.gray400 }}>···</div>
                </div>
              )}
              <div ref={aiEndRef} />
            </Card>

            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, scrollbarWidth:"none" }}>
              {AI_SUGGESTIONS.map((s) => (
                <button key={s} style={S.chip} onClick={() => setAiInput(s)}>{s}</button>
              ))}
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <input
                style={{ ...S.input, flex:1 }}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); }}}
                placeholder="Uliza swali lolote kwa Kiswahili…"
              />
              <button
                style={{ ...S.btnPrimary, width:48, height:48, flex:"none", padding:0, borderRadius:12, fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", opacity:aiLoading||!aiInput.trim()?0.5:1 }}
                onClick={handleAsk} disabled={aiLoading||!aiInput.trim()}
              >↑</button>
            </div>
            <p style={{ fontSize:11, color:T.gray400, textAlign:"center" }}>
              Jibu la AI ni la ushauri tu · Itaunganishwa na Gemini hivi karibuni
            </p>
          </div>
        )}

        {/* ════ KADI ════ */}
        {tab === "kadi" && (
          <div className="fadeIn">
            <Card>
              <STitle icon="🏥" text="Kadi ya Afya ya Biashara" />
              <p style={S.hint}>
                Baada ya miamala 30+ na siku 90, unaweza kupakua ripoti ya PDF inayofaa kwa maombi ya mkopo kwenye benki.
              </p>

              {summary && (
                <div style={{ background:T.greenLight, borderRadius:14, padding:16, marginBottom:16, border:`1px solid ${T.greenMid}30` }}>
                  <div style={{ fontWeight:700, fontSize:14, color:T.green, marginBottom:10 }}>
                    {summary.transactions_count >= 30
                      ? "✅ Unastahili kupata Kadi!"
                      : `⏳ Unahitaji miamala ${30 - summary.transactions_count} zaidi`}
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:12, color:T.gray600 }}>Maendeleo</span>
                    <span style={{ fontSize:12, fontWeight:700, color:T.green }}>{summary.transactions_count}/30</span>
                  </div>
                  <div style={{ background:"rgba(0,0,0,0.08)", borderRadius:6, height:8 }}>
                    <div style={{ width:`${Math.min(100,(summary.transactions_count/30)*100)}%`, height:"100%", borderRadius:6, background:summary.transactions_count>=30?T.greenMid:T.amber, transition:"width 0.6s" }} />
                  </div>
                </div>
              )}

              <div style={{ border:`2px dashed ${T.greenMid}50`, borderRadius:16, padding:"28px 20px", textAlign:"center", margin:"8px 0 20px" }}>
                <div style={{ fontSize:56, marginBottom:10 }}>📄</div>
                <div style={{ fontWeight:700, color:T.green, fontSize:16, marginBottom:10 }}>Kadi ya Afya ya Biashara</div>
                <div style={{ fontSize:13, color:T.gray600, lineHeight:2 }}>
                  ✔ Mapato &amp; Gharama (Siku 90)<br/>
                  ✔ Bidhaa Bora 5<br/>
                  ✔ Gharama kwa Aina<br/>
                  ✔ Tangazo la Kisheria (SW + EN)
                </div>
              </div>

              <button style={{ ...S.btnPrimary, width:"100%", padding:"16px 0", fontSize:16 }}
                onClick={handleHealthCard} disabled={pdfLoading}>
                {pdfLoading ? "⏳ Inatengeneza PDF…" : "📥 Pakua Kadi ya Afya (PDF)"}
              </button>
            </Card>
          </div>
        )}

      </main>

      {/* ── Bottom Nav ─────────────────────────────────────────────────────── */}
      <nav style={S.nav}>
        {[
          { id:"rekodi",  icon:"🎙️", label:"Rekodi"  },
          { id:"daftari", icon:"📒", label:"Daftari" },
          { id:"takwimu", icon:"📊", label:"Takwimu" },
          { id:"mshauri", icon:"🤖", label:"Mshauri" },
          { id:"kadi",    icon:"🏥", label:"Kadi"    },
        ].map((n) => (
          <button key={n.id} style={{ ...S.navBtn, ...(tab===n.id ? S.navActive : {}) }}
            onClick={() => setTab(n.id)}>
            <span style={{ fontSize:22 }}>{n.icon}</span>
            <span style={{ fontSize:9, marginTop:1, fontWeight:tab===n.id?700:500 }}>{n.label}</span>
            {tab===n.id && <div style={S.navDot} />}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return <div style={{ ...S.card, ...style }}>{children}</div>;
}
function STitle({ icon, text, inline }) {
  const el = (
    <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:16, fontWeight:700, color:T.gray900 }}>
      <span>{icon}</span><span>{text}</span>
    </div>
  );
  return inline ? el : <div style={{ marginBottom:14 }}>{el}</div>;
}
function FLabel({ text }) {
  return <label style={{ display:"block", fontSize:12, fontWeight:600, color:T.gray600, marginBottom:5, marginTop:14, textTransform:"uppercase", letterSpacing:"0.4px" }}>{text}</label>;
}
function TogBtn({ label, active, color, onClick }) {
  return (
    <button style={{
      flex:1, padding:"12px 0", borderRadius:10,
      border:`2px solid ${active ? color : T.gray200}`,
      background: active ? color + "14" : T.gray50,
      color: active ? color : T.gray400,
      fontWeight:700, fontSize:14, cursor:"pointer",
      transition:"all 0.15s",
    }} onClick={onClick}>{label}</button>
  );
}
function Divider({ text }) {
  return (
    <div style={{ display:"flex", alignItems:"center", margin:"20px 0", gap:12 }}>
      <div style={{ flex:1, height:1, background:T.gray200 }} />
      <span style={{ fontSize:12, color:T.gray400 }}>{text}</span>
      <div style={{ flex:1, height:1, background:T.gray200 }} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app:{ fontFamily:"'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background:"#f0f4f0", minHeight:"100vh", maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column", position:"relative" },
  header:{ background:`linear-gradient(160deg, ${T.green} 0%, #1a6b3a 100%)`, padding:"14px 20px 12px", color:T.white, boxShadow:"0 2px 8px rgba(0,0,0,0.15)", position:"sticky", top:0, zIndex:50 },
  hInner:{ display:"flex", justifyContent:"space-between", alignItems:"center" },
  headerLogo:{ width:38, height:38, background:"rgba(255,255,255,0.15)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, backdropFilter:"blur(4px)" },
  hTitle:{ fontSize:19, fontWeight:800, letterSpacing:"-0.4px" },
  hSub:{ fontSize:11, opacity:0.8, marginTop:2 },
  badge:{ background:"rgba(255,255,255,0.2)", color:T.white, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600 },
  toast:{ position:"fixed", top:72, left:"50%", transform:"translateX(-50%)", color:T.white, padding:"10px 22px", borderRadius:24, fontWeight:600, fontSize:13, zIndex:1000, boxShadow:"0 4px 20px rgba(0,0,0,0.25)", whiteSpace:"nowrap", pointerEvents:"none", maxWidth:"88vw", textAlign:"center" },
  main:{ flex:1, padding:"14px 14px 100px", display:"flex", flexDirection:"column", gap:12, overflowY:"auto" },
  card:{ background:T.white, borderRadius:18, padding:20, boxShadow:T.cardShadow },
  hint:{ fontSize:13, color:T.gray400, lineHeight:1.65, marginBottom:16 },
  recordCenter:{ display:"flex", flexDirection:"column", alignItems:"center", gap:18, margin:"28px 0" },
  mic:{ width:100, height:100, borderRadius:"50%", background:`linear-gradient(145deg, ${T.greenMid}, ${T.green})`, border:"none", cursor:"pointer", boxShadow:`0 6px 28px ${T.green}45`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", userSelect:"none", WebkitUserSelect:"none", touchAction:"none", position:"relative", zIndex:2 },
  micRec:{ background:`linear-gradient(145deg, #dc2626, #b91c1c)`, boxShadow:"0 6px 28px rgba(220,38,38,0.45)" },
  micWait:{ background:`linear-gradient(145deg, #6b7280, #4b5563)`, cursor:"not-allowed", boxShadow:"none" },
  pulseOuter:{ position:"absolute", width:130, height:130, borderRadius:"50%", border:"2px solid rgba(220,38,38,0.25)", pointerEvents:"none" },
  pulseInner:{ position:"absolute", width:115, height:115, borderRadius:"50%", border:"2px solid rgba(220,38,38,0.15)", pointerEvents:"none" },
  recordLabel:{ fontSize:13, color:T.gray400, textAlign:"center", maxWidth:250, lineHeight:1.5 },
  divider:{ display:"flex", alignItems:"center", margin:"20px 0", gap:12 },
  dividerTxt:{ fontSize:12, color:T.gray400, whiteSpace:"nowrap" },
  transcriptBox:{ background:"#f0fdf4", borderRadius:12, padding:"12px 14px", borderLeft:`3px solid ${T.greenMid}`, marginBottom:14 },
  warning:{ background:"#fffbeb", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#92400e", marginBottom:8, border:"1px solid #fde68a" },
  input:{ width:"100%", boxSizing:"border-box", border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:"11px 14px", fontSize:15, color:T.gray900, outline:"none", background:T.gray50, fontFamily:"inherit", transition:"border-color 0.15s", marginBottom:0 },
  select:{ width:"100%", border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:"11px 14px", fontSize:15, color:T.gray900, outline:"none", background:T.gray50, fontFamily:"inherit" },
  btnPrimary:{ display:"block", flex:1, padding:"14px 0", borderRadius:12, border:"none", background:`linear-gradient(145deg, ${T.greenMid}, ${T.green})`, color:T.white, fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"inherit", letterSpacing:"-0.2px", boxShadow:`0 3px 14px ${T.green}35`, textAlign:"center" },
  btnOutline:{ display:"block", flex:1, padding:"13px 0", borderRadius:12, border:`1.5px solid ${T.gray200}`, background:T.white, color:T.gray600, fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit", textAlign:"center", width:"100%" },
  iconBtn:{ padding:"7px 11px", borderRadius:9, border:`1px solid ${T.gray200}`, background:T.white, cursor:"pointer", fontSize:15, lineHeight:1, color:T.gray600 },
  txRow:{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 10px", borderRadius:12, background:T.gray50, border:`1px solid ${T.gray200}`, transition:"background 0.15s" },
  deleteBtn:{ background:"none", border:"none", color:T.gray400, cursor:"pointer", fontSize:20, padding:"0 4px", lineHeight:1, flexShrink:0, borderRadius:6, transition:"color 0.15s" },
  chip:{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:`1px solid ${T.gray200}`, background:T.white, color:T.gray600, fontSize:12, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit", transition:"all 0.15s" },
  nav:{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"rgba(255,255,255,0.96)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderTop:`1px solid ${T.gray200}`, display:"flex", padding:"6px 0 env(safe-area-inset-bottom,8px)", boxShadow:"0 -1px 0 rgba(0,0,0,0.06)", zIndex:100 },
  navBtn:{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:1, background:"none", border:"none", cursor:"pointer", color:T.gray400, padding:"4px 0", fontFamily:"inherit", transition:"color 0.15s", position:"relative" },
  navActive:{ color:T.green },
  navDot:{ position:"absolute", bottom:-3, width:4, height:4, borderRadius:"50%", background:T.green },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  .fadeIn { animation: fadeIn 0.25s ease; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .pulse { animation: pulseRing 1.5s ease-out infinite; }
  .pulse2 { animation: pulseRing 1.5s ease-out infinite 0.4s; }
  @keyframes pulseRing { 0% { transform:scale(1); opacity:0.6; } 100% { transform:scale(1.5); opacity:0; } }
  .txRow:hover { background: #f0fdf4 !important; }
  input:focus, select:focus, textarea:focus { border-color: #1a8a47 !important; box-shadow: 0 0 0 3px rgba(26,138,71,0.1); }
  button:active { transform: scale(0.97); }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
`;
