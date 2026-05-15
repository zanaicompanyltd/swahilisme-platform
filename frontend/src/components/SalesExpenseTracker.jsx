import { useState, useMemo } from "react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"

// ── Categories (WBS 1.5.2) ──────────────────────────────────────────────────
const REVENUE_CATS = ["Mauzo ya Bidhaa", "Huduma", "Mkopo Uliolipwa", "Nyingine"]
const EXPENSE_CATS = ["Usafiri", "Malighafi", "Pango", "Mshahara", "Umeme/Maji", "Nyingine"]
const COLORS = ["#1B5E20", "#2ECC71", "#E67E22", "#8E44AD", "#C0392B"]

export default function SalesExpenseTracker() {
  const [activeTab, setActiveTab] = useState("ingiza")
  const [type, setType] = useState("revenue")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState(REVENUE_CATS[0])
  const [error, setError] = useState("")
  const [transactions, setTransactions] = useState([])

  const handleTypeChange = (newType) => {
    setType(newType)
    setCategory(newType === "revenue" ? REVENUE_CATS[0] : EXPENSE_CATS[0])
  }

  // WBS 1.5.1 - Submit with RULE02 validation
  const handleSubmit = () => {
    if (!amount || Number(amount) <= 0) {
      setError("Tafadhali ingiza kiasi sahihi.")
      return
    }
    const newTransaction = {
      id: Date.now(),
      type,
      amount: Number(amount),
      category,
      description,
      date: new Date().toLocaleDateString()
    }
    setTransactions([newTransaction, ...transactions])
    setAmount("")
    setDescription("")
    setError("")
  }

  // WBS 1.5.3 - Calculation engine (RULE01: Profit = Revenue - Cost)
  const { totalRevenue, totalCost, profit } = useMemo(() => {
    const totalRevenue = transactions
      .filter((t) => t.type === "revenue")
      .reduce((sum, t) => sum + t.amount, 0)
    const totalCost = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0)
    return { totalRevenue, totalCost, profit: totalRevenue - totalCost }
  }, [transactions])

  // ── Dashboard chart data derived from local transactions ──────────────────

  // 1.6.1 - Daily revenue/cost/profit trend
  const trendData = useMemo(() => {
    const map = {}
    transactions.forEach((t) => {
      if (!map[t.date]) map[t.date] = { day: t.date, revenue: 0, cost: 0, profit: 0 }
      if (t.type === "revenue") map[t.date].revenue += t.amount
      else map[t.date].cost += t.amount
      map[t.date].profit = map[t.date].revenue - map[t.date].cost
    })
    return Object.values(map).slice(-7) // last 7 days
  }, [transactions])

  // 1.6.2 - Top products/categories by revenue
  const topProducts = useMemo(() => {
    const map = {}
    transactions
      .filter((t) => t.type === "revenue")
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + t.amount
      })
    return Object.entries(map)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [transactions])

  // 1.6.3 - Spending patterns by category
  const spendingData = useMemo(() => {
    const map = {}
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + t.amount
      })
    return Object.entries(map).map(([category, amount]) => ({ category, amount }))
  }, [transactions])

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>D</div>
        <div>
          <h1 style={styles.headerTitle}>Daftari Yangu</h1>
          <p style={styles.headerSub}>Rekodi mauzo na matumizi yako</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={styles.kpiRow}>
        <div style={{ ...styles.kpiCard, borderTop: "4px solid #2ECC71" }}>
          <p style={styles.kpiLabel}>Mapato</p>
          <p style={{ ...styles.kpiValue, color: "#27AE60" }}>
            TZS {totalRevenue.toLocaleString()}
          </p>
        </div>
        <div style={{ ...styles.kpiCard, borderTop: "4px solid #E74C3C" }}>
          <p style={styles.kpiLabel}>Gharama</p>
          <p style={{ ...styles.kpiValue, color: "#E74C3C" }}>
            TZS {totalCost.toLocaleString()}
          </p>
        </div>
        <div style={{ ...styles.kpiCard, borderTop: `4px solid ${profit >= 0 ? "#2ECC71" : "#E74C3C"}` }}>
          <p style={styles.kpiLabel}>Faida</p>
          <p style={{ ...styles.kpiValue, color: profit >= 0 ? "#27AE60" : "#E74C3C" }}>
            TZS {profit.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: profit >= 0 ? "#27AE60" : "#E74C3C" }}>
            {profit >= 0 ? "✓ Ina Faida" : "⚠ Ina Hasara"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          ["ingiza", "Ingiza"],
          ["orodha", "Orodha"],
          ["dashibodi", "Dashibodi"]
        ].map(([key, label]) => (
          <button
            key={key}
            style={activeTab === key ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Ingiza ── */}
      {activeTab === "ingiza" && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Ingiza Rekodi Mpya</h3>

          <div style={styles.typeRow}>
            <button
              style={type === "revenue" ? styles.typeBtnActive : styles.typeBtn}
              onClick={() => handleTypeChange("revenue")}
            >↑ Mapato</button>
            <button
              style={type === "expense" ? styles.typeBtnDanger : styles.typeBtn}
              onClick={() => handleTypeChange("expense")}
            >↓ Gharama</button>
          </div>

          {error && <div style={styles.error}>⚠ {error}</div>}

          <label style={styles.label}>Kategoria</label>
          <select style={styles.input} value={category}
            onChange={(e) => setCategory(e.target.value)}>
            {(type === "revenue" ? REVENUE_CATS : EXPENSE_CATS).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <label style={styles.label}>Kiasi (TZS) *</label>
          <input style={styles.input} type="number"
            placeholder="mfano: 5000" value={amount}
            onChange={(e) => setAmount(e.target.value)} />

          <label style={styles.label}>Maelezo (hiari)</label>
          <input style={styles.input} type="text"
            placeholder="mfano: Niliuza samaki 10" value={description}
            onChange={(e) => setDescription(e.target.value)} />

          <button style={styles.submitBtn} onClick={handleSubmit}>
            Hifadhi Rekodi ✓
          </button>
        </div>
      )}

      {/* ── TAB 2: Orodha ── */}
      {activeTab === "orodha" && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Orodha ya Rekodi</h3>
          {transactions.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center", padding: 20 }}>
              Hakuna rekodi bado. Ingiza rekodi kwanza.
            </p>
          ) : (
            transactions.map((t) => (
              <div key={t.id} style={{
                ...styles.txRow,
                borderLeft: `4px solid ${t.type === "revenue" ? "#2ECC71" : "#E74C3C"}`
              }}>
                <div>
                  <p style={styles.txCat}>{t.category}</p>
                  {t.description && <p style={styles.txDesc}>{t.description}</p>}
                  <p style={styles.txDate}>{t.date}</p>
                </div>
                <p style={{ ...styles.txAmount, color: t.type === "revenue" ? "#27AE60" : "#E74C3C" }}>
                  {t.type === "revenue" ? "+" : "−"} TZS {t.amount.toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 3: Dashibodi ── */}
      {activeTab === "dashibodi" && (
        <div>
          {transactions.length === 0 ? (
            <div style={{ ...styles.card, textAlign: "center", padding: 30 }}>
              <p style={{ color: "#999" }}>
                Ingiza rekodi kwanza ili kuona dashibodi.
              </p>
            </div>
          ) : (
            <>
              {/* 1.6.1 - Trend Chart */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>📈 1.6.1 Mwelekeo wa Mapato & Gharama</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => `TZS ${v.toLocaleString()}`} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name="Mapato"
                      stroke="#27AE60" fill="#27AE60" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="cost" name="Gharama"
                      stroke="#E74C3C" fill="#E74C3C" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="profit" name="Faida"
                      stroke="#1B5E20" fill="#1B5E20" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* 1.6.2 - Top Products */}
              {topProducts.length > 0 && (
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>🏆 1.6.2 Mapato kwa Kategoria</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number"
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                        tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name"
                        width={120} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => `TZS ${v.toLocaleString()}`} />
                      <Bar dataKey="revenue" name="Mapato">
                        {topProducts.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 1.6.3 - Spending Patterns */}
              {spendingData.length > 0 && (
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>🥧 1.6.3 Mchanganuo wa Matumizi</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={spendingData} dataKey="amount"
                        nameKey="category" cx="50%" cy="50%"
                        outerRadius={90}
                        label={({ name, percent }) =>
                          `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`
                        }>
                        {spendingData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `TZS ${v.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <p style={{ textAlign: "center", color: "#AAA", fontSize: 11, padding: "20px 0" }}>
        SwahiliSME Platform • DASUC 2026
      </p>

    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    backgroundColor: "#F0F4F0", minHeight: "100vh",
    fontFamily: "'Segoe UI', sans-serif", paddingBottom: 40,
  },
  header: {
    backgroundColor: "#1B5E20", padding: "16px 20px",
    display: "flex", alignItems: "center", gap: 12,
  },
  logo: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#2ECC71", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: 20, color: "#1B5E20",
  },
  headerTitle: { margin: 0, color: "#FFFFFF", fontSize: 18, fontWeight: 700 },
  headerSub: { margin: 0, color: "#A5D6A7", fontSize: 12 },
  kpiRow: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10, padding: "16px 16px 0",
  },
  kpiCard: {
    backgroundColor: "#FFFFFF", borderRadius: 10,
    padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  kpiLabel: { margin: 0, fontSize: 11, color: "#777", textTransform: "uppercase", letterSpacing: 1 },
  kpiValue: { margin: "4px 0 0", fontSize: 16, fontWeight: 700 },
  tabs: { display: "flex", gap: 4, padding: "16px 16px 0" },
  tab: {
    flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
    backgroundColor: "#FFFFFF", color: "#999",
    fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  tabActive: {
    flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
    backgroundColor: "#1B5E20", color: "#FFFFFF",
    fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 12,
    padding: 16, margin: "16px 16px 0",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  cardTitle: { margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#1B5E20" },
  typeRow: { display: "flex", gap: 8, marginBottom: 12 },
  typeBtn: {
    flex: 1, padding: "9px 0", borderRadius: 8,
    border: "1.5px solid #DDD", background: "transparent",
    color: "#999", fontWeight: 600, cursor: "pointer", fontSize: 13,
  },
  typeBtnActive: {
    flex: 1, padding: "9px 0", borderRadius: 8,
    border: "1.5px solid #2ECC71", background: "#F0FFF4",
    color: "#27AE60", fontWeight: 600, cursor: "pointer", fontSize: 13,
  },
  typeBtnDanger: {
    flex: 1, padding: "9px 0", borderRadius: 8,
    border: "1.5px solid #E74C3C", background: "#FFF5F5",
    color: "#E74C3C", fontWeight: 600, cursor: "pointer", fontSize: 13,
  },
  error: {
    backgroundColor: "#FFF5F5", border: "1px solid #E74C3C",
    color: "#E74C3C", borderRadius: 8, padding: "8px 12px",
    fontSize: 13, marginBottom: 10,
  },
  label: { display: "block", fontSize: 12, color: "#555", marginBottom: 4 },
  input: {
    width: "100%", boxSizing: "border-box", padding: "10px 12px",
    borderRadius: 8, border: "1px solid #DDD", fontSize: 14,
    marginBottom: 10, outline: "none", backgroundColor: "#FAFAFA",
  },
  submitBtn: {
    width: "100%", padding: 12, borderRadius: 10, border: "none",
    backgroundColor: "#1B5E20", color: "#FFFFFF",
    fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 4,
  },
  txRow: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", padding: "10px 12px",
    borderRadius: 8, marginBottom: 8, backgroundColor: "#F9F9F9",
  },
  txCat: { margin: 0, fontWeight: 600, fontSize: 13, color: "#222" },
  txDesc: { margin: "2px 0 0", fontSize: 11, color: "#888" },
  txDate: { margin: "2px 0 0", fontSize: 11, color: "#AAA" },
  txAmount: { margin: 0, fontWeight: 700, fontSize: 15 },
}