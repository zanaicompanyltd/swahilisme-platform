// AuthPage.jsx — Swahilisme Platform
// Bilingual (Swahili / English) authentication page.
//
// Flow: Login (phone + password)  or  Register (phone + password + profile).
// The SMS/WhatsApp OTP step has been removed — there is no code to request,
// no code to type, no countdown and no resend button.

import React, { useState, useEffect } from "react";
import { AUTH_STEP, PASSWORD_MIN_LENGTH } from "../hooks/useAuth";
import { checkApiHealth } from "../hooks/useApi";

// ── i18n strings ─────────────────────────────────────────────────────────
const T = {
  sw: {
    appName:          "Daftari Yangu",
    tagline:          "Rekodi za biashara yako kwa urahisi",
    loginTitle:       "Karibu tena",
    loginSubtitle:    "Ingia kwa nambari yako ya simu na nenosiri.",
    registerTitle:    "Fungua akaunti",
    regSubtitle:      "Habari zako zitasaidia kutengeneza ripoti ya biashara.",
    phoneLabel:       "Nambari ya Simu",
    phonePlaceholder: "0712 345 678",
    passwordLabel:    "Nenosiri",
    passwordHint:     `Angalau herufi ${PASSWORD_MIN_LENGTH}`,
    confirmLabel:     "Rudia nenosiri",
    show:             "Onyesha",
    hide:             "Ficha",
    login:            "Ingia",
    register:         "Jisajili",
    noAccount:        "Huna akaunti? Jisajili",
    haveAccount:      "Tayari una akaunti? Ingia",
    fullName:         "Jina Kamili *",
    businessName:     "Jina la Biashara",
    category:         "Aina ya Biashara",
    location:         "Mahali (Mji/Mtaa)",
    email:            "Barua Pepe (si lazima)",
    privacyNote:      "Nenosiri lako limehifadhiwa kwa usimbaji fiche. Taarifa zako hazitashirikishwa na mtu yeyote.",
    footerNote:       "Unahitaji msaada? Wasiliana nasi kwa WhatsApp.",
    apiDown:          "Seva haipatikani. Angalia uunganishaji wa API.",
    fieldRequired:    "Sehemu hii inahitajika",
    phoneInvalid:     "Nambari ya simu si sahihi",
    passwordTooShort: `Nenosiri lazima liwe na herufi ${PASSWORD_MIN_LENGTH} au zaidi`,
    passwordMismatch: "Manenosiri hayafanani",
    langToggle:       "English",
    categories: [
      "Chakula na Vinywaji", "Mavazi na Nguo", "Kilimo",
      "Biashara ya Jumla", "Duka la Rejareja", "Huduma",
      "Ujenzi", "Teknolojia", "Nyingine",
    ],
  },
  en: {
    appName:          "Daftari Yangu",
    tagline:          "Your business records, simplified",
    loginTitle:       "Welcome back",
    loginSubtitle:    "Sign in with your phone number and password.",
    registerTitle:    "Create an account",
    regSubtitle:      "Your details will help generate your business report.",
    phoneLabel:       "Phone Number",
    phonePlaceholder: "0712 345 678",
    passwordLabel:    "Password",
    passwordHint:     `At least ${PASSWORD_MIN_LENGTH} characters`,
    confirmLabel:     "Confirm password",
    show:             "Show",
    hide:             "Hide",
    login:            "Sign in",
    register:         "Register",
    noAccount:        "No account yet? Register",
    haveAccount:      "Already have an account? Sign in",
    fullName:         "Full Name *",
    businessName:     "Business Name",
    category:         "Business Category",
    location:         "Location (City/Area)",
    email:            "Email (optional)",
    privacyNote:      "Your password is stored only as a secure hash. Your information will not be shared.",
    footerNote:       "Need help? Contact us on WhatsApp.",
    apiDown:          "Cannot reach the server. Check the API connection.",
    fieldRequired:    "This field is required",
    phoneInvalid:     "Invalid phone number",
    passwordTooShort: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    passwordMismatch: "Passwords do not match",
    langToggle:       "Kiswahili",
    categories: [
      "Food & Beverages", "Clothing & Apparel", "Agriculture",
      "Wholesale", "Retail Shop", "Services",
      "Construction", "Technology", "Other",
    ],
  },
};

const TZ_PHONE_RE = /^(\+?255|0)\d{9}$/;

// ── Reusable password input with show/hide ────────────────────────────────
function PasswordField({ label, value, onChange, placeholder, hint, error, showKey, onToggle, t, autoComplete }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          style={{ ...styles.input, paddingRight: 70 }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={styles.showBtn}
          tabIndex={-1}
        >
          {showKey ? t.hide : t.show}
        </button>
      </div>
      {error
        ? <p style={styles.fieldError}>{error}</p>
        : hint && <p style={styles.hint}>{hint}</p>}
    </div>
  );
}

// ── API reachability banner ───────────────────────────────────────────────
// Shows the exact backend URL the browser is calling when it cannot be
// reached (wrong REACT_APP_API_URL, service asleep, domain not provisioned…).
// A wrong/dead API host is what produces the bare "Failed to fetch" error.
function ApiStatusBanner({ t }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    checkApiHealth().then((result) => { if (alive) setStatus(result); });
    return () => { alive = false; };
  }, []);

  if (!status || status.ok) return null;

  return (
    <div style={styles.apiDown} role="status">
      <p style={styles.apiDownText}>{t.apiDown}</p>
      <code style={styles.apiDownUrl}>{status.url}</code>
    </div>
  );
}

// ── Login form ────────────────────────────────────────────────────────────
function LoginForm({ t, auth }) {
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [touched,  setTouched]  = useState({});

  const cleanPhone = phone.replace(/\s/g, "");
  const phoneOk    = TZ_PHONE_RE.test(cleanPhone);
  const passOk     = password.length >= PASSWORD_MIN_LENGTH;

  const submit = async (e) => {
    e?.preventDefault();
    setTouched({ phone: true, password: true });
    if (!phoneOk || !passOk) return;
    try {
      await auth.login(cleanPhone, password);
    } catch {
      /* error already surfaced through auth.error */
    }
  };

  return (
    <form onSubmit={submit}>
      <p style={styles.subtitle}>{t.loginSubtitle}</p>

      <div style={{ marginBottom: 14 }}>
        <label style={styles.label}>{t.phoneLabel}</label>
        <div style={{ position: "relative" }}>
          <span style={styles.phonePrefix}>🇹🇿 +255</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((x) => ({ ...x, phone: true }))}
            placeholder={t.phonePlaceholder}
            autoComplete="tel"
            style={{ ...styles.input, paddingLeft: 80 }}
          />
        </div>
        {touched.phone && !phoneOk && <p style={styles.fieldError}>{t.phoneInvalid}</p>}
      </div>

      <PasswordField
        label={t.passwordLabel}
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        hint={t.passwordHint}
        error={touched.password && !passOk ? t.passwordTooShort : null}
        showKey={show}
        onToggle={() => setShow((s) => !s)}
        t={t}
        autoComplete="current-password"
      />

      {auth.error && <p style={styles.errorBox}>{auth.error}</p>}

      <button type="submit" disabled={auth.loading} style={styles.btnPrimary}>
        {auth.loading ? "..." : t.login}
      </button>

      <div style={styles.switchRow}>
        <button type="button" onClick={() => { auth.setError(null); auth.setStep(AUTH_STEP.REGISTER); }} style={styles.linkBtn}>
          {t.noAccount}
        </button>
      </div>
    </form>
  );
}

// ── Register form ─────────────────────────────────────────────────────────
function RegisterForm({ t, auth }) {
  const [form, setForm] = useState({
    phone_number: "", password: "", confirm: "",
    full_name: "", business_name: "", business_category: "",
    location: "", email: "",
  });
  const [show,    setShow]    = useState(false);
  const [touched, setTouched] = useState({});

  const set   = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k)    => setTouched((x) => ({ ...x, [k]: true }));

  const cleanPhone = form.phone_number.replace(/\s/g, "");
  const phoneOk    = TZ_PHONE_RE.test(cleanPhone);
  const passOk     = form.password.length >= PASSWORD_MIN_LENGTH;
  const matchOk    = form.password === form.confirm;

  const submit = async (e) => {
    e?.preventDefault();
    setTouched({ phone: true, password: true, confirm: true, full_name: true });
    if (!phoneOk || !passOk || !matchOk || !form.full_name.trim()) return;
    try {
      await auth.register({
        phone_number:      cleanPhone,
        password:          form.password,
        full_name:         form.full_name.trim(),
        business_name:     form.business_name,
        business_category: form.business_category,
        location:          form.location,
        email:             form.email,
      });
    } catch {
      /* error already surfaced through auth.error */
    }
  };

  return (
    <form onSubmit={submit}>
      <p style={styles.subtitle}>{t.regSubtitle}</p>

      <div style={{ marginBottom: 14 }}>
        <label style={styles.label}>{t.phoneLabel}</label>
        <div style={{ position: "relative" }}>
          <span style={styles.phonePrefix}>🇹🇿 +255</span>
          <input
            type="tel"
            value={form.phone_number}
            onChange={(e) => set("phone_number", e.target.value)}
            onBlur={() => touch("phone")}
            placeholder={t.phonePlaceholder}
            autoComplete="tel"
            style={{ ...styles.input, paddingLeft: 80 }}
          />
        </div>
        {touched.phone && !phoneOk && <p style={styles.fieldError}>{t.phoneInvalid}</p>}
      </div>

      <PasswordField
        label={t.passwordLabel}
        value={form.password}
        onChange={(v) => set("password", v)}
        placeholder="••••••••"
        hint={t.passwordHint}
        error={touched.password && !passOk ? t.passwordTooShort : null}
        showKey={show}
        onToggle={() => setShow((s) => !s)}
        t={t}
        autoComplete="new-password"
      />

      <PasswordField
        label={t.confirmLabel}
        value={form.confirm}
        onChange={(v) => set("confirm", v)}
        placeholder="••••••••"
        error={
          !touched.confirm ? null
            : !form.confirm ? t.fieldRequired
            : !matchOk      ? t.passwordMismatch
            : null
        }
        showKey={show}
        onToggle={() => setShow((s) => !s)}
        t={t}
        autoComplete="new-password"
      />

      {[
        { key: "full_name",     label: t.fullName,     type: "text",  required: true },
        { key: "business_name", label: t.businessName, type: "text" },
        { key: "location",      label: t.location,     type: "text" },
        { key: "email",         label: t.email,        type: "email" },
      ].map(({ key, label, type, required }) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <label style={styles.label}>{label}</label>
          <input
            type={type}
            value={form[key]}
            onChange={(e) => set(key, e.target.value)}
            onBlur={() => touch(key)}
            autoComplete={key === "email" ? "email" : "off"}
            style={styles.input}
          />
          {required && touched[key] && !form[key].trim() && (
            <p style={styles.fieldError}>{t.fieldRequired}</p>
          )}
        </div>
      ))}

      <div style={{ marginBottom: 14 }}>
        <label style={styles.label}>{t.category}</label>
        <select
          value={form.business_category}
          onChange={(e) => set("business_category", e.target.value)}
          style={{ ...styles.input, appearance: "auto" }}
        >
          <option value="">—</option>
          {t.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {auth.error && <p style={styles.errorBox}>{auth.error}</p>}

      <button type="submit" disabled={auth.loading} style={styles.btnPrimary}>
        {auth.loading ? "..." : t.register}
      </button>

      <p style={styles.privacyNote}>{t.privacyNote}</p>

      <div style={styles.switchRow}>
        <button type="button" onClick={() => { auth.setError(null); auth.setStep(AUTH_STEP.LOGIN); }} style={styles.linkBtn}>
          {t.haveAccount}
        </button>
      </div>
    </form>
  );
}

// ── Main AuthPage ─────────────────────────────────────────────────────────
export default function AuthPage({ authHook, onAuthenticated }) {
  // Use auth hook passed from App.js so both share the same state
  const auth = authHook;
  const [lang, setLang] = useState("sw");
  const t = T[lang];

  const isRegister = auth.step === AUTH_STEP.REGISTER;

  // Sync lang into auth hook
  useEffect(() => { auth.setLang(lang); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent when done
  useEffect(() => {
    if (auth.isAuthenticated && onAuthenticated) {
      onAuthenticated(auth.user, auth.getToken);
    }
  }, [auth.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.page}>
      {/* Background decoration */}
      <div style={styles.bgCircle1} />
      <div style={styles.bgCircle2} />

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.cardHeader}>
          <div style={styles.logoMark}>D</div>
          <div style={{ flex: 1 }}>
            <h1 style={styles.appTitle}>{isRegister ? t.registerTitle : t.loginTitle}</h1>
            {!isRegister && <p style={styles.tagline}>{t.tagline}</p>}
          </div>
          {/* Language toggle */}
          <button
            onClick={() => setLang((l) => (l === "sw" ? "en" : "sw"))}
            style={styles.langToggle}
          >
            {t.langToggle}
          </button>
        </div>

        <ApiStatusBanner t={t} />

        {/* Login / Register switch */}
        <div style={styles.tabBar}>
          {[AUTH_STEP.LOGIN, AUTH_STEP.REGISTER].map((s) => (
            <button
              key={s}
              onClick={() => { auth.setError(null); auth.setStep(s); }}
              style={{
                ...styles.tab,
                background: auth.step === s ? "#1D9E75" : "transparent",
                color:      auth.step === s ? "#fff"     : "#5F5E5A",
              }}
            >
              {s === AUTH_STEP.LOGIN ? t.login : t.register}
            </button>
          ))}
        </div>

        <div style={styles.stepContent}>
          {isRegister
            ? <RegisterForm t={t} auth={auth} />
            : <LoginForm    t={t} auth={auth} />}
        </div>

        {/* Footer */}
        <p style={styles.footer}>{t.footerNote}</p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#04342C",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    padding: "24px 16px",
    position: "relative",
    overflow: "hidden",
  },
  bgCircle1: {
    position: "absolute", top: -120, right: -120,
    width: 400, height: 400, borderRadius: "50%",
    background: "rgba(29,158,117,0.15)", pointerEvents: "none",
  },
  bgCircle2: {
    position: "absolute", bottom: -80, left: -80,
    width: 280, height: 280, borderRadius: "50%",
    background: "rgba(186,117,23,0.12)", pointerEvents: "none",
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 420,
    position: "relative",
    zIndex: 1,
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 20,
  },
  logoMark: {
    width: 44, height: 44,
    borderRadius: 12,
    background: "#1D9E75",
    color: "#fff",
    fontSize: 22,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  appTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "#04342C",
    lineHeight: 1.2,
  },
  tagline: {
    margin: "4px 0 0",
    fontSize: 13,
    color: "#5F5E5A",
  },
  langToggle: {
    border: "1px solid #D3D1C7",
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: 12,
    color: "#444441",
    background: "transparent",
    cursor: "pointer",
    flexShrink: 0,
    fontWeight: 500,
  },
  tabBar: {
    display: "flex",
    gap: 4,
    background: "#F1F0EC",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    border: "none",
    borderRadius: 8,
    padding: "9px 0",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  },
  stepContent: {
    minHeight: 160,
  },
  subtitle: {
    margin: "0 0 16px",
    fontSize: 13,
    color: "#5F5E5A",
    lineHeight: 1.5,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#2C2C2A",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "11px 14px",
    fontSize: 15,
    border: "1.5px solid #D3D1C7",
    borderRadius: 10,
    outline: "none",
    color: "#2C2C2A",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
    background: "#fff",
  },
  showBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    color: "#1D9E75",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 6px",
  },
  phonePrefix: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 14,
    color: "#444441",
    pointerEvents: "none",
  },
  btnPrimary: {
    width: "100%",
    padding: "13px",
    background: "#1D9E75",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s, transform 0.1s",
    marginTop: 6,
  },
  hint: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#888780",
  },
  apiDown: {
    background: "#FFF4E5",
    border: "1px solid #E0A100",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 16,
  },
  apiDownText: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    color: "#7A4B00",
  },
  apiDownUrl: {
    display: "block",
    marginTop: 4,
    fontSize: 11,
    color: "#7A4B00",
    wordBreak: "break-all",
  },
  errorBox: {
    background: "#FCEBEB",
    color: "#A32D2D",
    border: "1px solid #F7C1C1",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    margin: "10px 0",
  },
  fieldError: {
    color: "#A32D2D",
    fontSize: 12,
    margin: "4px 0 0",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#1D9E75",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    fontWeight: 500,
  },
  switchRow: {
    display: "flex",
    justifyContent: "center",
    marginTop: 16,
    fontSize: 13,
  },
  privacyNote: {
    fontSize: 12,
    color: "#888780",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 1.5,
  },
  footer: {
    fontSize: 12,
    color: "#B4B2A9",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 0,
  },
};
