import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

import AnalyticsDashboard from "./components/AnalyticsDashboard";
import DaftariYangu from "./components/DaftariYangu";
// import MshauriWangu from "./components/MshauriWangu";
// import SalesExpenseTracker from "./components/SalesExpenseTracker";

import sw from "./i18n/sw.json";

function App() {
  return (
    <Router>
      <div style={{ fontFamily: "Georgia, serif", minHeight: "100vh" }}>
        {/* Top Navigation Bar */}
        <nav style={{
          background: "#1a6b3a", color: "#fff", padding: "12px 20px",
          display: "flex", gap: "20px", flexWrap: "wrap"
        }}>
          <Link to="/" style={navLink}>🏠 Home</Link>
          <Link to="/daftari" style={navLink}>📒 Daftari Yangu</Link>
          <Link to="/analytics" style={navLink}>📊 Analytics</Link>
          <Link to="/tracker" style={navLink}>💼 Mauzo & Gharama</Link>
          {/* <Link to="/mshauri" style={navLink}>🎓 Mshauri Wangu</Link> */}
        </nav>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analytics" element={<AnalyticsDashboard userId="demo-user-001" />} />
          <Route path="/daftari" element={<DaftariYangu />} />
          <Route path="/tracker" element={<SalesExpenseTracker />} />
          {/* Add more routes */}
        </Routes>
      </div>
    </Router>
  );
}

const navLink = {
  color: "#fff", textDecoration: "none", fontWeight: 600, padding: "8px 12px", borderRadius: 8
};

function HomePage() {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", background: "#F4F7FB" }}>
      <h1>🌍 SwahiliSME Platform</h1>
      <p>{sw.app.tagline || "Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu"}</p>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", maxWidth: 1000, margin: "40px auto" }}>
        <ModuleCard title="📒 Daftari Yangu" desc="Voice + Text Bookkeeping" link="/daftari" />
        <ModuleCard title="📊 Analytics Dashboard" desc="Charts & Business Insights" link="/analytics" />
        <ModuleCard title="💼 Sales & Expense Tracker" desc="Simple transaction entry" link="/tracker" />
        {/* Add more cards */}
      </div>
    </div>
  );
}

function ModuleCard({ title, desc, link }) {
  return (
    <Link to={link} style={{
      background: "#fff", padding: "24px", borderRadius: 16,
      textDecoration: "none", color: "#1a1a2e", boxShadow: "0 4px 15px rgba(0,0,0,0.08)"
    }}>
      <h3>{title}</h3>
      <p>{desc}</p>
      <button style={{ marginTop: 12 }}>Fungua →</button>
    </Link>
  );
}

export default App;
