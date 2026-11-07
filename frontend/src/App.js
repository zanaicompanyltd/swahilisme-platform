// App.js — SwahiliSME Platform
// Auth gate: shows AuthPage (phone + password login/registration) until the
// user is authenticated, then loads the app. No OTP step is involved.

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import DaftariYangu from "./components/DaftariYangu";
import AuthPage from "./components/AuthPage";
import useAuth from "./hooks/useAuth";
import sw from "./i18n/sw.json";

function App() {
  const auth = useAuth();

  // ── Show login page until authenticated ───────────────────────────────
  if (!auth.isAuthenticated) {
    return <AuthPage authHook={auth} />;
  }

  // ── Authenticated — show the full app ─────────────────────────────────
  return (
    <Router>
      <div
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
          minHeight: "100vh",
          background: "#f5f5f7",
        }}
      >
        <NavBar user={auth.user} onLogout={auth.logout} />
        <Routes>
          <Route path="/"        element={<HomePage />} />
          <Route path="/daftari" element={<DaftariYangu user={auth.user} getToken={auth.getToken} />} />
        </Routes>
      </div>
    </Router>
  );
}

// ── NavBar ─────────────────────────────────────────────────────────────────────
function NavBar({ user, onLogout }) {
  const location = useLocation();
  const links = [
    { to: "/",        label: "Nyumbani" },
    { to: "/daftari", label: "Daftari Yangu" },
  ];

  return (
    <nav
      style={{
        background: "linear-gradient(160deg, #1a6b3a 0%, #1e8449 100%)",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        gap: 4,
        height: 52,
        boxShadow: "0 1px 0 rgba(0,0,0,0.12)",
        position: "sticky",
        top: 0,
        zIndex: 200,
      }}
    >
      <span
        style={{
          color: "#fff",
          fontWeight: 800,
          fontSize: 15,
          marginRight: 16,
          letterSpacing: "-0.3px",
        }}
      >
        🌍 SwahiliSME
      </span>

      {links.map(({ to, label }) => (
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
            background:
              location.pathname === to
                ? "rgba(255,255,255,0.22)"
                : "transparent",
            transition: "background 0.2s",
          }}
        >
          {label}
        </Link>
      ))}

      {/* User info + logout — right side */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
          👤 {user?.full_name || user?.phone_number || "Mtumiaji"}
        </span>
        <button
          onClick={onLogout}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 20,
            padding: "4px 12px",
            color: "#fff",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Toka
        </button>
      </div>
    </nav>
  );
}

// ── Home page ─────────────────────────────────────────────────────────────────
function HomePage() {
  return (
    <div style={{ padding: "32px 20px", maxWidth: 960, margin: "0 auto" }}>
      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(160deg, #1a6b3a 0%, #0d5c8a 100%)",
          borderRadius: 24,
          padding: "44px 36px",
          color: "#fff",
          textAlign: "center",
          marginBottom: 32,
          boxShadow: "0 8px 32px rgba(26,107,58,0.2)",
        }}
      >
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: "-0.5px",
          }}
        >
          🌍 SwahiliSME Platform
        </h1>
        <p style={{ margin: "0 0 6px", fontSize: 17, opacity: 0.9, fontWeight: 400 }}>
          {sw.app?.tagline || "Teknolojia kwa Lugha Yetu"}
        </p>
        <p style={{ margin: "0 0 24px", fontSize: 13, opacity: 0.7 }}>
          {sw.app?.subtitle || "Usimamizi wa biashara ndogo kwa Kiswahili"}
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {["DASUC Project 2026", "CBAP BABOK v3", "PMP PMBOK 7", "Offline-First PWA"].map(
            (t) => (
              <span
                key={t}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 20,
                  padding: "4px 12px",
                  fontSize: 12,
                  color: "#fff",
                }}
              >
                {t}
              </span>
            )
          )}
        </div>
      </div>

      {/* Single unified module card */}
      <Link
        to="/daftari"
        style={{
          display: "block",
          background: "#fff",
          borderRadius: 20,
          padding: 28,
          textDecoration: "none",
          color: "#1d1d1f",
          boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
          borderTop: "4px solid #1a6b3a",
          transition: "transform 0.15s, box-shadow 0.15s",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 44 }}>📒</span>
          <span
            style={{
              fontSize: 12, fontWeight: 600, padding: "4px 12px",
              borderRadius: 20, background: "#e8f5ee", color: "#1a6b3a",
            }}
          >
            ✅ Tayari
          </span>
        </div>
        <div
          style={{ fontWeight: 800, fontSize: 20, color: "#1a6b3a", marginBottom: 4 }}
        >
          Daftari Yangu
        </div>
        <div style={{ fontSize: 12, color: "#86868b", marginBottom: 12 }}>
          Rekodi · Daftari · Takwimu · Mshauri AI · Kadi ya Afya
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#515154", lineHeight: 1.6 }}>
          Rekodi mapato na gharama kwa sauti au maandishi. Angalia takwimu za biashara.
          Pata ushauri wa AI wa biashara kwa Kiswahili. Pakua Kadi ya Afya kwa mkopo.
        </p>
        <div
          style={{
            padding: "12px 20px", borderRadius: 24,
            background: "linear-gradient(145deg, #1a6b3a, #2e9e5b)",
            color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 15,
          }}
        >
          Fungua Daftari Yangu →
        </div>
      </Link>

      <p
        style={{
          textAlign: "center",
          color: "#86868b",
          fontSize: 12,
          marginTop: 40,
          fontStyle: "italic",
        }}
      >
        SwahiliSME Platform • DASUC Project 2026 • "Teknolojia kwa Lugha Yetu"
      </p>
    </div>
  );
}

export default App;