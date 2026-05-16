import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import DaftariYangu from "./components/DaftariYangu";
import SalesExpenseTracker from "./components/SalesExpenseTracker";
import sw from "./i18n/sw.json";

function App() {
  return (
    <Router>
      <div style={{ fontFamily: "Georgia, serif", minHeight: "100vh", background: "#F4F7FB" }}>
        <NavBar />
        <Routes>
          <Route path="/"          element={<HomePage />} />
          <Route path="/analytics" element={<AnalyticsDashboard userId="demo-user-001" />} />
          <Route path="/daftari"   element={<DaftariYangu />} />
          <Route path="/tracker"   element={<SalesExpenseTracker />} />
        </Routes>
      </div>
    </Router>
  );
}

function NavBar() {
  const location = useLocation();
  const links = [
    { to: "/",          icon: "🏠", label: "Nyumbani"     },
    { to: "/daftari",   icon: "📒", label: "Daftari Yangu" },
    { to: "/analytics", icon: "📊", label: "Analytics"    },
    { to: "/tracker",   icon: "💼", label: "Mauzo & Gharama" },
  ];
  return (
    <nav style={{
      background: "linear-gradient(135deg, #1a6b3a 0%, #2e9e5b 100%)",
      padding: "12px 20px",
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center",
      boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
    }}>
      <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, marginRight: 12 }}>
        🌍 SwahiliSME
      </span>
      {links.map(({ to, icon, label }) => (
        <Link
          key={to}
          to={to}
          style={{
            color: "#fff",
            textDecoration: "none",
            fontWeight: location.pathname === to ? 700 : 400,
            padding: "6px 14px",
            borderRadius: 20,
            fontSize: 13,
            background: location.pathname === to
              ? "rgba(255,255,255,0.25)"
              : "transparent",
            border: location.pathname === to
              ? "1px solid rgba(255,255,255,0.4)"
              : "1px solid transparent",
            transition: "all 0.2s",
          }}
        >
          {icon} {label}
        </Link>
      ))}
    </nav>
  );
}

function HomePage() {
  const modules = [
    {
      to: "/daftari",
      icon: "📒",
      title: "Daftari Yangu",
      subtitle: "1.3 — Sauti + Maandishi",
      desc: "Rekodi mapato na gharama kwa sauti au maandishi kwa Kiswahili.",
      color: "#1a6b3a",
      status: "✅ Tayari",
    },
    {
      to: "/analytics",
      icon: "📊",
      title: "Analytics Dashboard",
      subtitle: "1.6 — Takwimu za Biashara",
      desc: "Mwelekeo wa mapato, gharama, faida. Bidhaa bora. Mchanganuo wa matumizi.",
      color: "#005493",
      status: "✅ Tayari",
    },
    {
      to: "/tracker",
      icon: "💼",
      title: "Mauzo & Gharama",
      subtitle: "1.5 — Ingiza Rekodi",
      desc: "Ingiza miamala kwa maandishi. Ona faida mara moja.",
      color: "#E67E22",
      status: "✅ Tayari",
    },
    {
      to: "#",
      icon: "🎓",
      title: "Mshauri Wangu",
      subtitle: "1.4 — AI ya Kisheria",
      desc: "Maswali ya TRA, BRELA, SIDO kwa Kiswahili. RAG + Claude AI.",
      color: "#8E44AD",
      status: "🚧 v1.2",
    },
  ];

  return (
    <div style={{ padding: "32px 20px", maxWidth: 960, margin: "0 auto" }}>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #1a6b3a 0%, #005493 100%)",
        borderRadius: 20,
        padding: "36px 32px",
        color: "#fff",
        textAlign: "center",
        marginBottom: 32,
        boxShadow: "0 8px 32px rgba(0,84,147,0.2)",
      }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 800 }}>
          🌍 SwahiliSME Platform
        </h1>
        <p style={{ margin: "0 0 6px", fontSize: 16, opacity: 0.9 }}>
          {sw.app.tagline}
        </p>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
          {sw.app.subtitle}
        </p>
        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <span style={pill}>DASUC Project 2026</span>
          <span style={pill}>CBAP BABOK v3</span>
          <span style={pill}>PMP PMBOK 7</span>
          <span style={pill}>Offline-First PWA</span>
        </div>
      </div>

      {/* Module cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
      }}>
        {modules.map(({ to, icon, title, subtitle, desc, color, status }) => (
          <Link
            key={title}
            to={to}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              textDecoration: "none",
              color: "#1a1a2e",
              boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
              borderTop: `4px solid ${color}`,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 32 }}>{icon}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px",
                borderRadius: 20, background: color + "18", color,
              }}>
                {status}
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color }}>{title}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{subtitle}</div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.6 }}>{desc}</p>
            {to !== "#" && (
              <div style={{
                marginTop: 4, padding: "8px 16px", borderRadius: 20,
                background: color, color: "#fff", textAlign: "center",
                fontWeight: 700, fontSize: 13,
              }}>
                Fungua →
              </div>
            )}
          </Link>
        ))}
      </div>

      <p style={{ textAlign: "center", color: "#bbb", fontSize: 12, marginTop: 32, fontStyle: "italic" }}>
        SwahiliSME Platform • DASUC Project 2026 • "Teknolojia kwa Lugha Yetu"
      </p>
    </div>
  );
}

const pill = {
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 20,
  padding: "4px 12px",
  fontSize: 12,
  color: "#fff",
};

export default App;
