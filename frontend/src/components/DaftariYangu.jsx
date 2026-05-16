// ============================================================
// DaftariYangu.jsx — SwahiliSME Platform (FIXED)
//
// FIXES vs previous version:
// 1. Analytics tab uses centralised useApi functions (no raw fetch)
// 2. USER_ID correctly defaults to "demo-user-001"
// 3. Error messages surface to toast (not swallowed silently)
// 4. reloadAnalytics dependencies corrected
// 5. All API imports from useApi.js
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
  getDashboardSummary,
  getRevenueCostProfit,
  getTopProducts,
  getSpendingPatterns,
  downloadHealthCard,
  syncOfflineQueue,
  getOfflineCount,
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
  green:"#1a6b3a", greenMid:"#2e9e5b", greenLight:"#e8f5ee",
  blue:"#0071e3", red:"#ff3b30", amber:"#ff9f0a", purple:"#af52de",
  gray50:"#f5f5f7", gray100:"#e8e8ed", gray200:"#d2d2d7",
  gray400:"#86868b", gray600:"#515154", gray900:"#1d1d1f",
  white:"#ffffff",
  chart:["#1a6b3a","#0071e3","#ff9f0a","#af52de","#ff3b30"],
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

/*
async function askMshauri(question, summary) {
  await new Promise((r) => setTimeout(r, 800));
  const rev = summary?.total_revenue || 0;
  const profit = summary?.net_profit || 0;
  const margin = summary?.profit_margin || 0;
  const q = question.toLowerCase();
  if (q.includes("vizuri") || q.includes("hali"))
    return `📊 Biashara yako inafanya vizuri! Mapato: TZS ${rev.toLocaleString()}, Faida: TZS ${profit.toLocaleString()} (${margin}%). Hongera!`;
  if (q.includes("mkopo") || q.includes("loan"))
    return `🏦 Margin yako ya ${margin}% ni nzuri kwa mkopo. Baada ya siku 90 za data, Kadi yako ya Afya ya Biashara itakusaidia kupata mkopo. Endelea kuingiza miamala kila siku!`;
  if (q.includes("tra") || q.includes("kodi") || q.includes("tax"))
    return `📋 TRA: Lazima ujisajili ukizidi TZS 14,000,000 kwa mwaka. Tembelea tra.go.tz au ofisi ya TRA karibu nawe.`;
  if (q.includes("bidhaa") || q.includes("product"))
    return `🏆 Angalia tab ya Takwimu → Bidhaa Bora ili uone bidhaa zinazokuleta mapato zaidi.`;
  return `🤖 Swali lako: "${question}"\n\nNinaweza kukusaidia na:\n• Uchambuzi wa mapato na gharama\n• Ushauri wa mikopo\n• Maswali ya TRA na BRELA\n• Mikakati ya kukuza biashara\n\nNiulize chochote kwa Kiswahili!`;
}
*/
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


const fmt = (n) => "TZS " + Number(n || 0).toLocaleString();

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const today = new Date();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Leo";
  if (d.toDateString() === yest.toDateString()) return "Jana";
  return d.toLocaleDateString("sw-TZ", { day:"numeric", month:"short" });
}

const EMPTY_FORM = {
  type:"mapato", category:"mauzo", amount:"", description:"",
  product_name:"", quantity:"",
  transaction_date: new Date().toISOString().slice(0, 10),
};

export default function DaftariYangu() {
  const [tab, setTab]          = useState("rekodi");
  const [transactions, setTxs] = useState([]);
  const [summary, setSummary]  = useState(null);
  const [offlineCount, setOff] = useState(0);
  const [toast, setToast]      = useState(null);

  const [transcript, setTranscript] = useState("");
  const [nlpData, setNlp]           = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [pdfLoading, setPdf]        = useState(false);
  const [transcribing, setTrans]    = useState(false);

  const [analyticsLoaded, setAL]   = useState(false);
  const [analyticsLoading, setALd] = useState(false);
  const [chartData, setChart]      = useState([]);
  const [topProducts, setTopP]     = useState([]);
  const [spending, setSpend]       = useState([]);
  const [dashSummary, setDashSum]  = useState(null);

  const [aiMessages, setAiMsgs] = useState([{ role:"ai", text:"Habari! Mimi ni Mshauri wako wa AI. Niulize chochote kuhusu biashara yako — mapato, gharama, mikopo, TRA, na zaidi! 🤖" }]);
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
      console.error("[reload]", e.message);
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
          day: label,
          Mapato:  chart.revenue?.[i] || 0,
          Gharama: chart.cost?.[i]    || 0,
          Faida:   chart.profit?.[i]  || 0,
        })));
      }
      setTopP(products?.products || (Array.isArray(products) ? products : []));
      setSpend(spend?.categories  || (Array.isArray(spend)    ? spend    : []));
      setDashSum(dash);
      setAL(true);
    } catch (e) {
      console.error("[analytics]", e.message);
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

  async function handleTranscribe(blob) {
    setTrans(true);
    try {
      const result = await transcribeAudio(USER_ID, blob, "audio.webm");
      setTranscript(result.transcript || "");
      if (result.nlp) {
        const n = result.nlp;
        setNlp(n);
        setForm((f) => ({
          ...f,
          type:             n.transaction_type || f.type,
          category:         n.category         || f.category,
          amount:           n.amount != null    ? String(n.amount)  : f.amount,
          description:      result.transcript   || f.description,
          product_name:     n.product_name      || f.product_name,
          quantity:         n.quantity != null   ? String(n.quantity) : f.quantity,
          transaction_date: n.transaction_date   ? n.transaction_date.slice(0,10) : f.transaction_date,
        }));
      }
      setTab("thibitisha");
    } catch (err) {
      showToast("❌ " + (err.message || "Hitilafu ya kurekodi"), "error");
      recorder.reset();
    } finally { setTrans(false); }
  }

  async function handleSave() {
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) { showToast("Tafadhali weka kiasi sahihi (zaidi ya 0)", "error"); return; }
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
        showToast("✅ Muamala umehifadhiwa kwenye database!", "success");
      }
      setTranscript(""); setNlp(null); setForm(EMPTY_FORM); recorder.reset();
      setAL(false); setTab("daftari"); reload();
    } catch (err) {
      showToast("❌ " + (err.message || "Hitilafu ya kuhifadhi"), "error");
      console.error("[save]", err);
    } finally { setSaving(false); }
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

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.hInner}>
          <div>
            <div style={S.hTitle}>📒 Daftari Yangu</div>
            <div style={S.hSub}>{USER_ID} · {navigator.onLine ? "🟢 Mtandaoni" : "🔴 Nje ya mtandao"}</div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {offlineCount > 0 && <Chip bg={T.amber}>⏳ {offlineCount}</Chip>}
          </div>
        </div>
      </header>

      {toast && (
        <div style={{ ...S.toast, background: toast.type==="error"?T.red:toast.type==="warning"?T.amber:toast.type==="info"?T.blue:T.green }}>
          {toast.msg}
        </div>
      )}

      <main style={S.main}>

        {/* ════ REKODI ════ */}
        {tab === "rekodi" && (
          <Card>
            <STitle icon="🎙️" text="Rekodi Muamala Wako" />
            <p style={S.hint}>Sema kwa Kiswahili — mfano: <em>"Nimeuza ndizi elfu ishirini, gharama ilikuwa elfu tano"</em></p>
            <div style={S.recordCenter}>
              <div style={{ position:"relative" }}>
                <button
                  style={{ ...S.mic, ...(recorder.isRecording?S.micRec:{}), ...(transcribing?S.micWait:{}) }}
                  onMouseDown={recorder.startRecording}
                  onMouseUp={recorder.stopRecording}
                  onTouchStart={(e)=>{ e.preventDefault(); recorder.startRecording(); }}
                  onTouchEnd={(e)  =>{ e.preventDefault(); recorder.stopRecording(); }}
                  disabled={transcribing} aria-label="Rekodi sauti"
                >
                  <span style={{ fontSize:44 }}>{transcribing?"⏳":recorder.isRecording?"⏹":"🎙️"}</span>
                </button>
                {recorder.isRecording && <div style={S.pulseRing} />}
              </div>
              <div style={S.recordLabel}>
                {transcribing?"⚡ Inachakata sauti…":recorder.isRecording?`🔴 Inaandika… (${recorder.duration||0}s)`:"Shikilia kusema · au bonyeza mara moja"}
              </div>
              {recorder.error && <div style={{ color:T.red, fontSize:13 }}>{recorder.error}</div>}
            </div>
            <Divider text="au ingiza kwa mkono" />
            <button style={S.btnOutline} onClick={()=>{ setTranscript(""); setNlp(null); setTab("thibitisha"); }}>✏️ Ingiza Mwenyewe</button>
          </Card>
        )}

        {/* ════ THIBITISHA ════ */}
        {tab === "thibitisha" && (
          <Card>
            <STitle icon="✅" text="Thibitisha Muamala" />
            {transcript && (
              <div style={S.transcriptBox}>
                <div style={{ fontSize:11, color:T.gray400, fontWeight:600, marginBottom:4 }}>Ulichosema:</div>
                <div style={{ fontSize:14, color:T.gray900, fontStyle:"italic", lineHeight:1.5 }}>"{transcript}"</div>
                {nlpData?.confidence!=null && <div style={{ fontSize:11, color:T.gray400, marginTop:4 }}>Uhalisi: {Math.round(nlpData.confidence*100)}%</div>}
              </div>
            )}
            {nlpData?.warnings?.map((w,i)=><div key={i} style={S.warning}>⚠️ {w}</div>)}
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <TogBtn label="💰 Mapato"  active={form.type==="mapato"}  color={T.green} onClick={()=>setForm((f)=>({...f,type:"mapato",  category:"mauzo"}))} />
              <TogBtn label="💸 Gharama" active={form.type==="gharama"} color={T.red}   onClick={()=>setForm((f)=>({...f,type:"gharama", category:"malighafi"}))} />
            </div>
            <FLabel text="Kiasi (TZS)" />
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14, fontWeight:700, color:T.gray400 }}>TZS</span>
              <input style={{ ...S.input, fontSize:28, fontWeight:800, padding:"10px 14px" }}
                type="number" inputMode="numeric" value={form.amount} autoFocus
                onChange={(e)=>setForm((f)=>({...f,amount:e.target.value}))} placeholder="0" />
            </div>
            <FLabel text="Aina ya Biashara" />
            <select style={S.select} value={form.category} onChange={(e)=>setForm((f)=>({...f,category:e.target.value}))}>
              {categories.map((c)=><option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <FLabel text="Bidhaa / Huduma (hiari)" />
            <input style={S.input} value={form.product_name} onChange={(e)=>setForm((f)=>({...f,product_name:e.target.value}))} placeholder="mf. Ndizi, Unga…" />
            <FLabel text="Tarehe" />
            <input style={S.input} type="date" value={form.transaction_date} onChange={(e)=>setForm((f)=>({...f,transaction_date:e.target.value}))} />
            <FLabel text="Maelezo (hiari)" />
            <textarea style={{ ...S.input, height:60, resize:"vertical" }} value={form.description} onChange={(e)=>setForm((f)=>({...f,description:e.target.value}))} placeholder="Maelezo ya ziada…" />
            <div style={{ display:"flex", gap:10, marginTop:18 }}>
              <button style={S.btnOutline} onClick={()=>{ recorder.reset(); setTab("rekodi"); }}>← Rudi</button>
              <button style={{ ...S.btnPrimary, flex:2 }} onClick={handleSave} disabled={saving}>
                {saving?"Inahifadhi…":"💾 Hifadhi kwenye Database"}
              </button>
            </div>
          </Card>
        )}

        {/* ════ DAFTARI ════ */}
        {tab === "daftari" && (
          <>
            {summary && (
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <SumPill label="Mapato"  value={fmt(summary.total_revenue)} color={T.green} />
                <SumPill label="Gharama" value={fmt(summary.total_cost)}    color={T.red} />
                <SumPill label="Faida"   value={fmt(summary.net_profit)}    color={summary.net_profit>=0?T.green:T.red} />
              </div>
            )}
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <STitle icon="📒" text={`Miamala (${transactions.length})`} inline />
                <button style={S.iconBtn} onClick={()=>{ setAL(false); reload(); }}>🔄</button>
              </div>
              {transactions.length === 0 ? (
                <div style={{ textAlign:"center", padding:"36px 0" }}>
                  <div style={{ fontSize:44, marginBottom:10 }}>📭</div>
                  <div style={{ fontSize:15, color:T.gray400 }}>Hakuna miamala bado</div>
                  <div style={{ fontSize:13, color:T.gray200, marginTop:4 }}>Bonyeza 🎙️ hapo chini kuanza</div>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {transactions.map((tx)=>(
                    <div key={tx.id} style={S.txRow}>
                      <div style={{ fontSize:22, marginTop:2, flexShrink:0 }}>{CAT_ICONS[tx.category]||"💼"}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:14, fontWeight:600, color:T.gray900 }}>
                            {(tx.category||"").replace(/_/g," ").replace(/\b\w/g,(l)=>l.toUpperCase())}
                          </span>
                          <span style={{ fontSize:14, fontWeight:700, color:tx.type==="mapato"?"#22c55e":T.red, flexShrink:0, marginLeft:8 }}>
                            {tx.type==="mapato"?"+":"−"}{fmt(tx.amount)}
                          </span>
                        </div>
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:3 }}>
                          <span style={{ fontSize:11, color:T.gray400 }}>{fmtDate(tx.transaction_date)}</span>
                          {tx.source==="voice" && <span style={{ fontSize:10, background:T.greenLight, color:T.green, padding:"1px 7px", borderRadius:10 }}>🎙️</span>}
                          {!tx.is_synced && <span style={{ fontSize:10, background:"#fef3c7", color:"#92400e", padding:"1px 7px", borderRadius:10 }}>⏳</span>}
                        </div>
                        {tx.description && <div style={{ fontSize:11, color:T.gray400, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tx.description}</div>}
                      </div>
                      <button style={{ background:"none", border:"none", color:T.gray200, cursor:"pointer", fontSize:20, padding:"0 4px", lineHeight:1, flexShrink:0 }} onClick={()=>handleDelete(tx.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* ════ TAKWIMU ════ */}
        {tab === "takwimu" && (
          <>
            {(dashSummary||summary) && (()=>{
              const d = dashSummary||summary;
              return (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                  <KPICard icon="💰" label="Mapato"  value={fmt(d.total_revenue)} color={T.green} />
                  <KPICard icon="💸" label="Gharama" value={fmt(d.total_cost)}    color={T.red} />
                  <KPICard icon="📈" label="Faida"   value={fmt(d.net_profit)}    color={d.net_profit>=0?T.green:T.red} />
                  <KPICard icon="📊" label="Margin"  value={`${d.profit_margin||0}%`} color={T.blue} />
                </div>
              );
            })()}
            {analyticsLoading && <div style={{ textAlign:"center", color:T.gray400, padding:32 }}>⏳ Inapakia takwimu…</div>}
            {chartData.length > 0 && (
              <Card>
                <STitle icon="📉" text="Mwelekeo wa Wiki" inline />
                <div style={{ marginTop:14 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top:4, right:8, bottom:0, left:0 }}>
                      <defs>
                        <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={.3}/><stop offset="95%" stopColor={T.green} stopOpacity={0}/></linearGradient>
                        <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.blue}  stopOpacity={.2}/><stop offset="95%" stopColor={T.blue}  stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.gray100} />
                      <XAxis dataKey="day" tick={{ fontSize:11, fill:T.gray400 }} />
                      <YAxis tick={{ fontSize:10 }} tickFormatter={(v)=>`${(v/1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v,name)=>[`TZS ${Number(v).toLocaleString()}`,name]} />
                      <Legend wrapperStyle={{ fontSize:12 }} />
                      <Area type="monotone" dataKey="Mapato"  stroke={T.green} fill="url(#gR)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="Gharama" stroke={T.red}   fill="none"      strokeWidth={2} strokeDasharray="5 5" />
                      <Area type="monotone" dataKey="Faida"   stroke={T.blue}  fill="url(#gP)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            {topProducts.length > 0 && (
              <Card style={{ marginTop:12 }}>
                <STitle icon="🏆" text="Bidhaa Bora" inline />
                <div style={{ marginTop:14 }}>
                  <ResponsiveContainer width="100%" height={Math.max(160, topProducts.length*44)}>
                    <BarChart data={topProducts} layout="vertical" margin={{ left:12, right:24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.gray100} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={(v)=>`${(v/1000).toFixed(0)}K`} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize:10, fill:T.gray600 }} />
                      <Tooltip formatter={(v)=>[`TZS ${Number(v).toLocaleString()}`,"Mapato"]} />
                      <Bar dataKey="revenue" radius={[0,6,6,0]}>
                        {topProducts.map((_,i)=><Cell key={i} fill={T.chart[i%T.chart.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            {spending.length > 0 && (
              <Card style={{ marginTop:12 }}>
                <STitle icon="🥧" text="Mchanganuo wa Gharama" inline />
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center", marginTop:14 }}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={spending} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={3}>
                        {spending.map((_,i)=><Cell key={i} fill={T.chart[i%T.chart.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v)=>`TZS ${Number(v).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex:1, minWidth:140 }}>
                    {spending.map((item,i)=>(
                      <div key={i} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:10, height:10, borderRadius:2, background:T.chart[i%T.chart.length], flexShrink:0 }} />
                            <span style={{ fontSize:12, color:T.gray600 }}>{item.category}</span>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700 }}>{item.percent}%</span>
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
            <button style={{ ...S.btnOutline, width:"100%", marginTop:12 }}
              onClick={()=>{ setAL(false); reloadAnalytics(); }} disabled={analyticsLoading}>
              {analyticsLoading?"⏳ Inapakia…":"🔄 Onyesha Upya Takwimu"}
            </button>
            {!analyticsLoading && chartData.length===0 && (
              <Card style={{ marginTop:12, textAlign:"center", padding:"32px 20px" }}>
                <div style={{ fontSize:40, marginBottom:10 }}>📊</div>
                <div style={{ color:T.gray400, fontSize:14, marginBottom:16 }}>Hakuna takwimu bado. Ongeza miamala kwanza.</div>
                <button style={{ ...S.btnPrimary, padding:"10px 24px", width:"auto" }} onClick={()=>setTab("rekodi")}>+ Ongeza Muamala</button>
              </Card>
            )}
          </>
        )}

        {/* ════ MSHAURI AI ════ */}
        {tab === "mshauri" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <Card>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <div style={{ width:48, height:48, borderRadius:"50%", background:`linear-gradient(135deg,${T.purple},${T.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>🤖</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:T.gray900 }}>Mshauri Wangu AI</div>
                  <div style={{ fontSize:12, color:T.green, marginTop:2 }}>● Mtaalam wa Biashara · Powered by Gemini</div>
                </div>
              </div>
            </Card>
            <Card style={{ minHeight:280, maxHeight:400, overflow:"auto", display:"flex", flexDirection:"column", gap:10 }}>
              {aiMessages.map((m,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                  <div style={{ maxWidth:"85%", background:m.role==="user"?`linear-gradient(135deg,${T.green},${T.greenMid})`:T.gray50, color:m.role==="user"?T.white:T.gray900, borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", padding:"10px 14px", fontSize:14, lineHeight:1.5, whiteSpace:"pre-wrap", boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {aiLoading && <div style={{ display:"flex" }}><div style={{ background:T.gray50, borderRadius:"18px 18px 18px 4px", padding:"12px 18px", fontSize:18, color:T.gray400 }}>···</div></div>}
              <div ref={aiEndRef} />
            </Card>
            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
              {AI_SUGGESTIONS.map((s)=><button key={s} style={S.chip} onClick={()=>setAiInput(s)}>{s}</button>)}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...S.input, flex:1 }} value={aiInput} onChange={(e)=>setAiInput(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleAsk(); } }}
                placeholder="Uliza swali lolote kwa Kiswahili…" />
              <button style={{ ...S.btnPrimary, width:48, height:48, flex:"none", padding:0, borderRadius:12, fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", opacity:aiLoading||!aiInput.trim()?0.5:1 }}
                onClick={handleAsk} disabled={aiLoading||!aiInput.trim()}>↑</button>
            </div>
            <p style={{ fontSize:11, color:T.gray400, textAlign:"center" }}>Jibu la AI ni la ushauri tu · Itaunganishwa na Gemini hivi karibuni</p>
          </div>
        )}

        {/* ════ KADI ════ */}
        {tab === "kadi" && (
          <Card>
            <STitle icon="🏥" text="Kadi ya Afya ya Biashara" />
            <p style={S.hint}>Baada ya miamala 30+ na siku 90, unaweza kupakua ripoti ya PDF inayofaa kwa maombi ya mkopo kwenye benki.</p>
            {summary && (
              <div style={{ background:T.greenLight, borderRadius:12, padding:16, marginBottom:16, border:`1px solid ${T.greenMid}30` }}>
                <div style={{ fontWeight:700, fontSize:14, color:T.green, marginBottom:8 }}>
                  {summary.transactions_count>=30?"✅ Unastahili!":"⏳ Endelea kuingiza miamala"} — {summary.transactions_count}/30
                </div>
                <div style={{ background:T.gray100, borderRadius:6, height:8 }}>
                  <div style={{ width:`${Math.min(100,(summary.transactions_count/30)*100)}%`, height:"100%", borderRadius:6, background:summary.transactions_count>=30?T.green:T.amber, transition:"width 0.6s" }} />
                </div>
              </div>
            )}
            <div style={{ border:`2px dashed ${T.greenMid}50`, borderRadius:16, padding:"24px 20px", textAlign:"center", margin:"16px 0" }}>
              <div style={{ fontSize:52 }}>📄</div>
              <div style={{ fontWeight:700, color:T.green, fontSize:16, marginTop:10 }}>Kadi ya Afya ya Biashara</div>
              <div style={{ fontSize:13, color:T.gray400, marginTop:8, lineHeight:1.9 }}>
                ✔ Mapato &amp; Gharama (Siku 90)<br/>✔ Bidhaa Bora 5<br/>✔ Gharama kwa Aina<br/>✔ Tangazo la Kisheria (SW + EN)
              </div>
            </div>
            <button style={{ ...S.btnPrimary, width:"100%", padding:"16px 0" }} onClick={handleHealthCard} disabled={pdfLoading}>
              {pdfLoading?"⏳ Inatengeneza PDF…":"📥 Pakua Kadi ya Afya (PDF)"}
            </button>
          </Card>
        )}

      </main>

      <nav style={S.nav}>
        {[
          { id:"rekodi",  icon:"🎙️", label:"Rekodi"  },
          { id:"daftari", icon:"📒", label:"Daftari" },
          { id:"takwimu", icon:"📊", label:"Takwimu" },
          { id:"mshauri", icon:"🤖", label:"Mshauri" },
          { id:"kadi",    icon:"🏥", label:"Kadi"    },
        ].map((n)=>(
          <button key={n.id} style={{ ...S.navBtn, ...(tab===n.id?S.navActive:{}) }} onClick={()=>setTab(n.id)}>
            <span style={{ fontSize:21 }}>{n.icon}</span>
            <span style={{ fontSize:9, marginTop:1, fontWeight:tab===n.id?700:400 }}>{n.label}</span>
            {tab===n.id && <div style={S.navDot} />}
          </button>
        ))}
      </nav>
      <style>{`@keyframes pulse-ring{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.18);opacity:.15}}`}</style>
    </div>
  );
}

function Card({ children, style }) { return <div style={{ ...S.card, ...style }}>{children}</div>; }
function STitle({ icon, text, inline }) {
  const el = <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:16, fontWeight:700, color:T.gray900 }}><span>{icon}</span><span>{text}</span></div>;
  return inline ? el : <div style={{ marginBottom:14 }}>{el}</div>;
}
function FLabel({ text }) { return <label style={{ display:"block", fontSize:12, fontWeight:600, color:T.gray600, marginBottom:5, marginTop:14 }}>{text}</label>; }
function TogBtn({ label, active, color, onClick }) {
  return <button style={{ flex:1, padding:"12px 0", borderRadius:10, border:`2px solid ${active?color:T.gray100}`, background:active?color+"15":T.gray50, color:active?color:T.gray400, fontWeight:700, fontSize:14, cursor:"pointer", transition:"all 0.15s" }} onClick={onClick}>{label}</button>;
}
function Divider({ text }) {
  return <div style={{ display:"flex", alignItems:"center", margin:"20px 0", gap:12 }}><div style={{ flex:1, height:1, background:T.gray100 }} /><span style={{ fontSize:13, color:T.gray400 }}>{text}</span><div style={{ flex:1, height:1, background:T.gray100 }} /></div>;
}
function Chip({ bg, children }) { return <span style={{ background:bg, color:"#fff", borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600 }}>{children}</span>; }
function SumPill({ label, value, color }) {
  return <div style={{ flex:1, background:T.white, borderRadius:12, padding:"10px 12px", boxShadow:"0 1px 6px rgba(0,0,0,0.06)", borderTop:`3px solid ${color}`, minWidth:0 }}><div style={{ fontSize:10, color:T.gray400, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div><div style={{ fontSize:12, fontWeight:800, color, marginTop:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</div></div>;
}
function KPICard({ icon, label, value, color }) {
  return <div style={{ background:T.white, borderRadius:14, padding:"14px 16px", borderTop:`3px solid ${color}`, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}><div style={{ fontSize:11, color:T.gray400, fontWeight:600 }}>{icon} {label}</div><div style={{ fontSize:16, fontWeight:800, color, marginTop:6 }}>{value}</div></div>;
}

const S = {
  app:{ fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif", background:T.gray50, minHeight:"100vh", maxWidth:480, margin:"0 auto", display:"flex", flexDirection:"column" },
  header:{ background:`linear-gradient(160deg,${T.green} 0%,#1e7a45 100%)`, padding:"14px 20px 12px", color:T.white, boxShadow:"0 1px 0 rgba(0,0,0,0.1)", position:"sticky", top:0, zIndex:50 },
  hInner:{ display:"flex", justifyContent:"space-between", alignItems:"center" },
  hTitle:{ fontSize:20, fontWeight:700, letterSpacing:"-0.3px" },
  hSub:{ fontSize:11, opacity:0.7, marginTop:2 },
  toast:{ position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", color:T.white, padding:"10px 22px", borderRadius:24, fontWeight:600, fontSize:13, zIndex:1000, boxShadow:"0 4px 20px rgba(0,0,0,0.2)", whiteSpace:"nowrap", pointerEvents:"none", maxWidth:"90vw" },
  main:{ flex:1, padding:"16px 16px 100px", display:"flex", flexDirection:"column", gap:12, overflowY:"auto" },
  card:{ background:T.white, borderRadius:18, padding:20, boxShadow:"0 1px 8px rgba(0,0,0,0.06)" },
  hint:{ fontSize:13, color:T.gray400, lineHeight:1.6, marginBottom:16 },
  recordCenter:{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, margin:"24px 0" },
  mic:{ width:96, height:96, borderRadius:"50%", background:`linear-gradient(145deg,${T.green},${T.greenMid})`, border:"none", cursor:"pointer", boxShadow:`0 4px 24px ${T.green}40`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", userSelect:"none", WebkitUserSelect:"none", touchAction:"none" },
  micRec:{ background:`linear-gradient(145deg,#dc2626,#ef4444)`, boxShadow:"0 0 0 16px rgba(239,68,68,0.1),0 4px 24px rgba(239,68,68,0.4)" },
  micWait:{ background:`linear-gradient(145deg,#6b7280,#9ca3af)`, cursor:"not-allowed" },
  pulseRing:{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:96, height:96, borderRadius:"50%", border:"3px solid rgba(239,68,68,0.35)", animation:"pulse-ring 1.4s ease-out infinite", pointerEvents:"none" },
  recordLabel:{ fontSize:13, color:T.gray400, textAlign:"center", maxWidth:240, lineHeight:1.5 },
  transcriptBox:{ background:T.greenLight, borderRadius:10, padding:12, borderLeft:`3px solid ${T.greenMid}`, marginBottom:12 },
  warning:{ background:"#fef3c7", borderRadius:8, padding:"7px 10px", fontSize:12, color:"#92400e", marginBottom:8 },
  input:{ width:"100%", boxSizing:"border-box", border:`1.5px solid ${T.gray100}`, borderRadius:10, padding:"11px 14px", fontSize:15, color:T.gray900, outline:"none", background:T.gray50, fontFamily:"inherit" },
  select:{ width:"100%", border:`1.5px solid ${T.gray100}`, borderRadius:10, padding:"11px 14px", fontSize:15, color:T.gray900, outline:"none", background:T.gray50, fontFamily:"inherit" },
  btnPrimary:{ flex:1, padding:"14px 0", borderRadius:12, border:"none", background:`linear-gradient(145deg,${T.green},${T.greenMid})`, color:T.white, fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"inherit", letterSpacing:"-0.2px", boxShadow:`0 2px 12px ${T.green}25` },
  btnOutline:{ flex:1, padding:"13px 0", borderRadius:12, border:`1.5px solid ${T.gray100}`, background:T.white, color:T.gray600, fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" },
  iconBtn:{ padding:"6px 10px", borderRadius:8, border:`1px solid ${T.gray100}`, background:T.white, cursor:"pointer", fontSize:16, lineHeight:1 },
  txRow:{ display:"flex", alignItems:"flex-start", gap:10, padding:12, borderRadius:12, background:T.gray50, border:`1px solid ${T.gray100}` },
  chip:{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:`1px solid ${T.gray100}`, background:T.white, color:T.gray600, fontSize:12, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" },
  nav:{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"rgba(255,255,255,0.94)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderTop:`1px solid ${T.gray100}`, display:"flex", padding:"6px 0 env(safe-area-inset-bottom,8px)", boxShadow:"0 -1px 0 rgba(0,0,0,0.06)", zIndex:100 },
  navBtn:{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:1, background:"none", border:"none", cursor:"pointer", color:T.gray200, padding:"4px 0", fontFamily:"inherit", transition:"color 0.15s", position:"relative" },
  navActive:{ color:T.green },
  navDot:{ position:"absolute", bottom:-4, width:4, height:4, borderRadius:"50%", background:T.green },
};
