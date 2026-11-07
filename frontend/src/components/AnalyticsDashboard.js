/**
 * 1.6  Analytics Dashboard
 * FIXES:
 *   - setIsOffline → setIsOnline (was crashing component, causing infinite loading)
 *   - Removed API from useCallback deps (it's a module-level const, not state)
 *   - fetchAll now always clears loading even on crash
 *   - isRefreshing wired correctly so it doesn't block initial render
 */
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import sw from "../i18n/sw.json";
import { BASE_URL } from "../hooks/useApi";

// ── Config ────────────────────────────────────────────────────────────────────
const API = BASE_URL;

const COLORS = {
  primary:   "#005493",
  secondary: "#009973",
  accent:    "#E67E22",
  danger:    "#C0392B",
  light:     "#ECF0F5",
  pie: ["#005493", "#009973", "#E67E22", "#8E44AD", "#C0392B", "#16A085", "#D35400"],
};

// ── Sub-components ────────────────────────────────────────────────────────────

const OfflineBanner = ({ isOnline, isSyncing }) => {
  if (isOnline && !isSyncing) return null;
  return (
    <div style={{
      background: isSyncing ? COLORS.secondary : "#333",
      color: "#fff", padding: "10px 20px",
      textAlign: "center", fontSize: 13, fontFamily: "Georgia, serif",
    }}>
      {isSyncing ? sw.offline.syncing : sw.offline.banner}
    </div>
  );
};

const StatCard = ({ label, value, color, icon, trend, isCurrency = true }) => (
  <div style={{
    background: "#fff", borderRadius: 16, padding: "18px 22px",
    borderLeft: `5px solid ${color}`,
    boxShadow: "0 2px 14px rgba(0,84,147,0.08)",
    flex: 1, minWidth: 150,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, color: "#888", fontFamily: "Georgia, serif", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700, color: "#1a1a2e", fontFamily: "Georgia, serif" }}>
          {isCurrency ? `TZS ${Number(value || 0).toLocaleString()}` : Number(value || 0).toLocaleString()}
        </p>
      </div>
      <span style={{ fontSize: 26 }}>{icon}</span>
    </div>
    {trend !== undefined && (
      <p style={{ margin: "8px 0 0", fontSize: 12, color: trend >= 0 ? COLORS.secondary : COLORS.danger }}>
        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% wiki iliyopita
      </p>
    )}
  </div>
);

const SectionTitle = ({ text, icon }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "28px 0 14px" }}>
    <span style={{ fontSize: 20 }}>{icon}</span>
    <h3 style={{
      margin: 0, fontSize: 17, fontWeight: 700, color: COLORS.primary,
      fontFamily: "Georgia, serif",
      borderBottom: `3px solid ${COLORS.secondary}`, paddingBottom: 3,
    }}>{text}</h3>
  </div>
);

const ChartCard = ({ children }) => (
  <div style={{
    background: "#fff", borderRadius: 16, padding: "20px 16px",
    boxShadow: "0 2px 14px rgba(0,84,147,0.07)", marginBottom: 4,
  }}>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1a1a2e", borderRadius: 10, padding: "10px 16px",
      color: "#fff", fontSize: 13, fontFamily: "Georgia, serif",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 4 }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "3px 0", color: p.color }}>
          {p.name}: TZS {Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const LoadingSpinner = () => (
  <div style={{ textAlign: "center", padding: 60 }}>
    <div style={{
      width: 48, height: 48,
      border: `4px solid ${COLORS.light}`,
      borderTop: `4px solid ${COLORS.primary}`,
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
      margin: "0 auto 16px",
    }} />
    <p style={{ color: "#888", fontFamily: "Georgia, serif" }}>{sw.errors.loading}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ErrorMessage = ({ message, onRetry }) => (
  <div style={{
    background: "#fff8f8", border: `1px solid ${COLORS.danger}`,
    borderRadius: 12, padding: 24, textAlign: "center", margin: "20px 0",
  }}>
    <p style={{ color: COLORS.danger, fontFamily: "Georgia, serif", marginBottom: 12 }}>⚠️ {message}</p>
    <button onClick={onRetry} style={{
      background: COLORS.primary, color: "#fff", border: "none",
      borderRadius: 20, padding: "8px 20px",
      fontFamily: "Georgia, serif", cursor: "pointer", fontSize: 13,
    }}>Jaribu Tena</button>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
function AnalyticsDashboard({ userId = "demo-user-001" }) {
  const [period, setPeriod]           = useState("week");
  const [summary, setSummary]         = useState(null);
  const [chartData, setChartData]     = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [spending, setSpending]       = useState([]);
  const [healthCard, setHealthCard]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [isOnline, setIsOnline]       = useState(navigator.onLine);
  const [refreshing, setRefreshing]   = useState(false);

  // FIX 1: setIsOffline → setIsOnline (the undefined function was crashing the component)
  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);   // ← was setIsOffline — crashed everything
    window.addEventListener("online",  up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online",  up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // FIX 2: Remove API from deps — it's a module constant, not React state.
  // Having it there caused useCallback to recreate fetchAll every render → infinite loop.
  const fetchAll = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const cfg = { timeout: 15000 };
      const [sumRes, chartRes, prodRes, spendRes, healthRes] = await Promise.all([
        axios.get(`${API}/api/v1/dashboard/summary?user_id=${userId}&period=${period}`, cfg),
        axios.get(`${API}/api/v1/dashboard/revenue-cost-profit?user_id=${userId}`, cfg),
        axios.get(`${API}/api/v1/dashboard/top-products?user_id=${userId}`, cfg),
        axios.get(`${API}/api/v1/dashboard/spending-patterns?user_id=${userId}`, cfg),
        axios.get(`${API}/api/v1/dashboard/health-card-status?user_id=${userId}`, cfg),
      ]);

      setSummary(sumRes.data);

      // Chart: parallel arrays → Recharts objects
      const labels = chartRes.data.labels || [];
      setChartData(labels.map((day, i) => ({
        day,
        [sw.dashboard.revenue]: chartRes.data.revenue?.[i] || 0,
        [sw.dashboard.cost]:    chartRes.data.cost?.[i]    || 0,
        [sw.dashboard.profit]:  chartRes.data.profit?.[i]  || 0,
      })));

      setTopProducts(prodRes.data.products  || []);
      setSpending(spendRes.data.categories  || []);
      setHealthCard(healthRes.data);

    } catch (err) {
      console.error("[Dashboard] fetch error:", err);
      setError(sw.errors.network || "Haiwezi kupata data. Jaribu tena.");
    } finally {
      // FIX 3: Always clear loading — even if something above threw
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, period]); // ← API removed from deps

  // Run on mount and when period/userId changes
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "Georgia, serif", background: "#F4F7FB", minHeight: "100vh" }}>

      <OfflineBanner isOnline={isOnline} isSyncing={false} />

      <div style={{ padding: "24px 20px", maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, #003d6b 100%)`,
          borderRadius: 20, padding: "24px 28px", marginBottom: 24,
          color: "#fff", boxShadow: "0 8px 32px rgba(0,84,147,0.25)",
        }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            📊 {sw.dashboard.title}
          </h1>
          <p style={{ margin: "6px 0 18px", opacity: 0.8, fontSize: 13 }}>
            {sw.app.tagline} • {sw.app.subtitle}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {[
              { key: "day",     label: sw.dashboard.period_day },
              { key: "week",    label: sw.dashboard.period_week },
              { key: "month",   label: sw.dashboard.period_month },
              { key: "quarter", label: sw.dashboard.period_quarter },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setPeriod(key)} style={{
                background: period === key ? COLORS.secondary : "rgba(255,255,255,0.15)",
                color: "#fff", border: "none", borderRadius: 20, padding: "6px 16px",
                fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif",
                fontWeight: period === key ? 700 : 400,
              }}>
                {label}
              </button>
            ))}

            {/* Refresh button */}
            <button
              onClick={() => fetchAll(true)}
              disabled={loading || refreshing}
              style={{
                padding: "6px 14px",
                background: (loading || refreshing) ? "rgba(255,255,255,0.3)" : "#fff",
                color: (loading || refreshing) ? "#aaa" : COLORS.primary,
                borderRadius: 20, border: "2px solid rgba(255,255,255,0.3)",
                cursor: (loading || refreshing) ? "not-allowed" : "pointer",
                fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6, marginLeft: 4,
              }}
            >
              <span style={(loading || refreshing) ? { display: "inline-block", animation: "spin 1s linear infinite" } : {}}>
                🔄
              </span>
              <span>{refreshing ? sw.dashboard.refreshing : sw.dashboard.refresh_btn}</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </button>
          </div>
        </div>

        {/* States */}
        {error   && <ErrorMessage message={error} onRetry={() => fetchAll()} />}
        {loading && <LoadingSpinner />}
        {refreshing && (
          <p style={{ textAlign: "center", color: COLORS.primary, fontSize: 13 }}>
            🔄 {sw.dashboard.refreshing}
          </p>
        )}

        {/* Main content — shown when not loading */}
        {!loading && (
          <>
            {/* Stat Cards */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
              <StatCard label={sw.dashboard.revenue}      value={summary?.total_revenue}       color={COLORS.secondary} icon="💰" trend={8.2} />
              <StatCard label={sw.dashboard.cost}         value={summary?.total_cost}          color={COLORS.accent}    icon="💸" trend={-3.1} />
              <StatCard
                label={summary?.net_profit >= 0 ? sw.dashboard.profit : sw.dashboard.loss}
                value={Math.abs(summary?.net_profit || 0)}
                color={summary?.net_profit >= 0 ? COLORS.primary : COLORS.danger}
                icon={summary?.net_profit >= 0 ? "📈" : "📉"}
                trend={14.5}
              />
              <StatCard label={sw.dashboard.transactions} value={summary?.transactions_count} color={COLORS.danger}    icon="📦" isCurrency={false} />
            </div>

            {/* 1.6.1 Revenue / Cost / Profit Chart */}
            <SectionTitle text={`1.6.1 — ${sw.dashboard.trend_chart}`} icon="📉" />
            <ChartCard>
              {chartData.length === 0 ? (
                <p style={{ textAlign: "center", color: "#aaa", padding: 24 }}>
                  {sw.errors.no_data}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={COLORS.secondary} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={COLORS.primary} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fontFamily: "Georgia, serif" }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: "Georgia, serif", fontSize: 13 }} />
                    <Area type="monotone" dataKey={sw.dashboard.revenue} stroke={COLORS.secondary} fill="url(#revGrad)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey={sw.dashboard.cost}    stroke={COLORS.accent}    fill="none" strokeWidth={2} strokeDasharray="5 5" />
                    <Area type="monotone" dataKey={sw.dashboard.profit}  stroke={COLORS.primary}   fill="url(#profitGrad)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* 1.6.2 Top Products */}
            <SectionTitle text={`1.6.2 — ${sw.dashboard.top_products}`} icon="🏆" />
            <ChartCard>
              {topProducts.length === 0 ? (
                <p style={{ textAlign: "center", color: "#aaa", padding: 24 }}>{sw.errors.no_data}</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topProducts} layout="vertical" margin={{ left: 20, right: 30, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontFamily: "Georgia, serif" }} width={130} />
                      <Tooltip formatter={(v) => [`TZS ${Number(v).toLocaleString()}`, sw.dashboard.revenue]} />
                      <Bar dataKey="revenue" name={sw.dashboard.revenue} radius={[0, 8, 8, 0]}>
                        {topProducts.map((_, i) => <Cell key={i} fill={COLORS.pie[i % COLORS.pie.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div style={{ overflowX: "auto", marginTop: 16 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: COLORS.light }}>
                          {[sw.dashboard.rank, sw.dashboard.product, sw.dashboard.category, sw.dashboard.units, sw.dashboard.revenue].map((h) => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: COLORS.primary, fontFamily: "Georgia, serif", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((p, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f0f4f8" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: COLORS.pie[i % COLORS.pie.length] }}>#{p.rank || i + 1}</td>
                            <td style={{ padding: "10px 12px" }}>{p.name}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ background: COLORS.light, borderRadius: 12, padding: "2px 10px", fontSize: 11, color: COLORS.primary }}>
                                {p.category || "—"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "#666" }}>{p.units}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: COLORS.secondary }}>TZS {Number(p.revenue).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </ChartCard>

            {/* 1.6.3 Spending Patterns */}
            <SectionTitle text={`1.6.3 — ${sw.dashboard.spending}`} icon="🥧" />
            <ChartCard>
              {spending.length === 0 ? (
                <p style={{ textAlign: "center", color: "#aaa", padding: 24 }}>{sw.errors.no_data}</p>
              ) : (
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: "0 0 auto" }}>
                    <ResponsiveContainer width={220} height={220}>
                      <PieChart>
                        <Pie data={spending} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={90} innerRadius={52} paddingAngle={3}>
                          {spending.map((_, i) => <Cell key={i} fill={COLORS.pie[i % COLORS.pie.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `TZS ${Number(v).toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    {spending.map((item, i) => (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS.pie[i % COLORS.pie.length], flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: "#333" }}>{item.category}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary }}>TZS {Number(item.amount).toLocaleString()}</span>
                            <span style={{ fontSize: 11, color: "#999", marginLeft: 6 }}>{item.percent}%</span>
                          </div>
                        </div>
                        <div style={{ background: "#eef2f7", borderRadius: 6, height: 7 }}>
                          <div style={{ width: `${item.percent}%`, height: "100%", borderRadius: 6, background: COLORS.pie[i % COLORS.pie.length], transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>

            {/* Business Health Card Banner */}
            {healthCard && (
              <div style={{
                marginTop: 24,
                background: `linear-gradient(135deg, ${COLORS.secondary}, #007a5c)`,
                borderRadius: 16, padding: "20px 24px", color: "#fff",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexWrap: "wrap", gap: 14, boxShadow: "0 4px 20px rgba(0,153,115,0.3)",
              }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>🏦 {sw.health_card.title}</p>
                  <p style={{ margin: "4px 0 10px", opacity: 0.9, fontSize: 13 }}>
                    {healthCard.eligible
                      ? sw.health_card.eligible
                      : sw.health_card.not_eligible.replace("{days}", healthCard.days_remaining)}
                  </p>
                  <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, height: 8, width: 220 }}>
                    <div style={{
                      width: `${Math.min(100, ((healthCard.days_of_data || 0) / 90) * 100)}%`,
                      height: "100%", borderRadius: 8, background: "#fff", transition: "width 0.6s ease",
                    }} />
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.8 }}>
                    {healthCard.days_of_data}/90 siku • {healthCard.transaction_count} miamala
                  </p>
                </div>
                {healthCard.eligible && (
                  <button style={{
                    background: "#fff", color: COLORS.secondary, border: "none",
                    borderRadius: 20, padding: "10px 22px", fontWeight: 700,
                    fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer",
                  }}>
                    ⬇ {sw.health_card.download}
                  </button>
                )}
              </div>
            )}

            <p style={{ textAlign: "center", color: "#bbb", fontSize: 12, marginTop: 32, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
              SwahiliSME Platform • DASUC 2026 • "{sw.app.tagline}"
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
