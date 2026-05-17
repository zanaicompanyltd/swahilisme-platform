// AuthPage.jsx — Swahilisme Platform
// Bilingual (Swahili / English) phone-first authentication
// Flow: Enter Phone → OTP Code → Register (new users)

import React, { useState, useRef, useEffect } from "react";
import useAuth, { AUTH_STEP } from "../hooks/useAuth";

// ── i18n strings ─────────────────────────────────────────────────────────
const T = {
  sw: {
    appName:         "Daftari Yangu",
    tagline:         "Rekodi za biashara yako kwa urahisi",
    phoneLabel:      "Nambari ya Simu",
    phonePlaceholder:"0712 345 678",
    sendViaSMS:      "Tuma OTP kwa SMS",
    sendViaWA:       "Tuma OTP kwa WhatsApp",
    orSendVia:       "au tuma kwa",
    whatsapp:        "WhatsApp",
    sms:             "SMS",
    otpTitle:        "Ingiza Msimbo",
    otpSentSMS:      (p) => `Msimbo wa tarakimu 6 umetumwa kwa SMS kwenye ${p}`,
    otpSentWA:       (p) => `Msimbo wa tarakimu 6 umetumwa kwa WhatsApp kwenye ${p}`,
    otpLabel:        "Msimbo wa uthibitisho",
    verify:          "Thibitisha",
    resendIn:        (s) => `Tuma tena baada ya sekunde ${s}`,
    resend:          "Tuma tena",
    changePhone:     "Badilisha nambari",
    regTitle:        "Maliza Usajili",
    regSubtitle:     "Habari zako zitasaidia kutengeneza ripoti ya biashara.",
    fullName:        "Jina Kamili *",
    businessName:    "Jina la Biashara",
    category:        "Aina ya Biashara",
    location:        "Mahali (Mji/Mtaa)",
    email:           "Barua Pepe (si lazima)",
    register:        "Jisajili",
    privacyNote:     "Taarifa zako ziko salama na hazitashirikishwa na mtu yeyote.",
    categories:      [
      "Chakula na Vinywaji","Mavazi na Nguo","Kilimo",
      "Biashara ya Jumla","Duka la Rejareja","Huduma",
      "Ujenzi","Teknolojia","Nyingine",
    ],
    langToggle:      "English",
    footerNote:      "Unahitaji msaada? Wasiliana nasi kwa WhatsApp.",
    fieldRequired:   "Sehemu hii inahitajika",
  },
  en: {
    appName:         "Daftari Yangu",
    tagline:         "Your business records, simplified",
    phoneLabel:      "Phone Number",
    phonePlaceholder:"0712 345 678",
    sendViaSMS:      "Send OTP via SMS",
    sendViaWA:       "Send OTP via WhatsApp",
    orSendVia:       "or send via",
    whatsapp:        "WhatsApp",
    sms:             "SMS",
    otpTitle:        "Enter Code",
    otpSentSMS:      (p) => `A 6-digit code was sent via SMS to ${p}`,
    otpSentWA:       (p) => `A 6-digit code was sent via WhatsApp to ${p}`,
    otpLabel:        "Verification code",
    verify:          "Verify",
    resendIn:        (s) => `Resend in ${s}s`,
    resend:          "Resend",
    changePhone:     "Change number",
    regTitle:        "Complete Registration",
    regSubtitle:     "Your details will help generate your business report.",
    fullName:        "Full Name *",
    businessName:    "Business Name",
    category:        "Business Category",
    location:        "Location (City/Area)",
    email:           "Email (optional)",
    register:        "Register",
    privacyNote:     "Your information is secure and will not be shared.",
    categories:      [
      "Food & Beverages","Clothing & Apparel","Agriculture",
      "Wholesale","Retail Shop","Services",
      "Construction","Technology","Other",
    ],
    langToggle:      "Kiswahili",
    footerNote:      "Need help? Contact us on WhatsApp.",
    fieldRequired:   "This field is required",
  },
};

// ── OTP Input (6 boxes) ──────────────────────────────────────────────────
function OTPInput({ onComplete, disabled }) {
  const [digits, setDigits] = useState(Array(6).fill(""));
  const inputs = useRef([]);

  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
    if (next.every(d => d !== "")) onComplete(next.join(""));
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) inputs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputs.current[5]?.focus();
      onComplete(pasted);
    }
  };

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "24px 0" }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{
            width: 44,
            height: 52,
            fontSize: 22,
            fontWeight: 600,
            textAlign: "center",
            border: `1.5px solid ${d ? "#1D9E75" : "#D3D1C7"}`,
            borderRadius: 10,
            outline: "none",
            background: d ? "#E1F5EE" : "#fff",
            color: "#04342C",
            transition: "border-color 0.15s, background 0.15s",
            cursor: disabled ? "not-allowed" : "text",
          }}
        />
      ))}
    </div>
  );
}

// ── Phone Step ────────────────────────────────────────────────────────────
function PhoneStep({ t, auth }) {
  const [phone, setPhone]   = useState("");
  const [touched, setTouched] = useState(false);

  const isValid = /^(\+?255|0)\d{9}$/.test(phone.replace(/\s/g, ""));

  const handleSend = async (method) => {
    setTouched(true);
    if (!isValid) return;
    await auth.sendOTP(phone.replace(/\s/g, ""), method);
  };

  return (
    <div>
      <label style={styles.label}>{t.phoneLabel}</label>
      <div style={{ position: "relative", marginBottom: 6 }}>
        <span style={styles.phonePrefix}>🇹🇿 +255</span>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder={t.phonePlaceholder}
          style={{ ...styles.input, paddingLeft: 80 }}
          onKeyDown={e => e.key === "Enter" && handleSend("sms")}
        />
      </div>
      {touched && !isValid && (
        <p style={styles.fieldError}>{t.fieldRequired}</p>
      )}
      {auth.error && <p style={styles.errorBox}>{auth.error}</p>}

      <button
        onClick={() => handleSend("sms")}
        disabled={auth.loading}
        style={{ ...styles.btnPrimary, marginTop: 16 }}
      >
        {auth.loading ? "..." : t.sendViaSMS}
      </button>

      <div style={styles.orDivider}>
        <span style={styles.orLine} />{t.orSendVia}<span style={styles.orLine} />
      </div>

      <button
        onClick={() => handleSend("whatsapp")}
        disabled={auth.loading}
        style={styles.btnWhatsApp}
      >
        <WhatsAppIcon />
        {t.sendViaWA}
      </button>
    </div>
  );
}

// ── OTP Step ──────────────────────────────────────────────────────────────
function OTPStep({ t, auth }) {
  const [code, setCode]         = useState("");
  const [autoVerify, setAuto]   = useState(false);

  const handleComplete = (fullCode) => {
    setCode(fullCode);
    setAuto(true);
  };

  useEffect(() => {
    if (autoVerify && code.length === 6) {
      auth.verifyOTP(code);
      setAuto(false);
    }
  }, [autoVerify, code]);

  const sentMsg = auth.deliveryMethod === "whatsapp"
    ? t.otpSentWA(auth.phone)
    : t.otpSentSMS(auth.phone);

  return (
    <div>
      <p style={styles.otpHint}>{sentMsg}</p>

      <OTPInput onComplete={handleComplete} disabled={auth.loading} />

      {auth.error && <p style={styles.errorBox}>{auth.error}</p>}

      <button
        onClick={() => code.length === 6 && auth.verifyOTP(code)}
        disabled={auth.loading || code.length < 6}
        style={styles.btnPrimary}
      >
        {auth.loading ? "..." : t.verify}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 13 }}>
        <button
          onClick={() => auth.setStep("phone")}
          style={styles.linkBtn}
        >
          ← {t.changePhone}
        </button>

        {auth.resendCountdown > 0 ? (
          <span style={{ color: "#888780" }}>{t.resendIn(auth.resendCountdown)}</span>
        ) : (
          <button
            onClick={() => auth.sendOTP(auth.phone, auth.deliveryMethod)}
            style={styles.linkBtn}
          >
            {t.resend}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Register Step ─────────────────────────────────────────────────────────
function RegisterStep({ t, auth }) {
  const [form, setForm] = useState({
    full_name: "", business_name: "", business_category: "",
    location: "", email: "",
  });
  const [touched, setTouched] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const touch = (k)  => setTouched(t => ({ ...t, [k]: true }));

  const handleSubmit = async () => {
    setTouched({ full_name: true });
    if (!form.full_name.trim()) return;
    await auth.register(form);
  };

  return (
    <div>
      <p style={{ color: "#5F5E5A", fontSize: 14, marginBottom: 20 }}>{t.regSubtitle}</p>

      {[
        { key: "full_name",        label: t.fullName,     type: "text",  required: true },
        { key: "business_name",    label: t.businessName, type: "text" },
        { key: "location",         label: t.location,     type: "text" },
        { key: "email",            label: t.email,        type: "email" },
      ].map(({ key, label, type, required }) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <label style={styles.label}>{label}</label>
          <input
            type={type}
            value={form[key]}
            onChange={e => set(key, e.target.value)}
            onBlur={() => touch(key)}
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
          onChange={e => set("business_category", e.target.value)}
          style={{ ...styles.input, appearance: "auto" }}
        >
          <option value="">—</option>
          {t.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {auth.error && <p style={styles.errorBox}>{auth.error}</p>}

      <button
        onClick={handleSubmit}
        disabled={auth.loading}
        style={{ ...styles.btnPrimary, marginTop: 6 }}
      >
        {auth.loading ? "..." : t.register}
      </button>

      <p style={styles.privacyNote}>{t.privacyNote}</p>
    </div>
  );
}

// ── WhatsApp SVG icon ─────────────────────────────────────────────────────
function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.374 0 0 5.373 0 12c0 2.117.554 4.105 1.523 5.837L.057 23.888a.5.5 0 0 0 .611.61l6.053-1.47A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.883a9.876 9.876 0 0 1-5.04-1.374l-.361-.214-3.735.907.935-3.633-.235-.374A9.86 9.86 0 0 1 2.118 12c0-5.441 4.442-9.883 9.882-9.883 5.44 0 9.882 4.442 9.882 9.883 0 5.44-4.441 9.883-9.882 9.883z" />
    </svg>
  );
}

// ── Main AuthPage ─────────────────────────────────────────────────────────
export default function AuthPage({ authHook, onAuthenticated }) {
  // Use auth hook passed from App.js so both share the same state
  const auth = authHook;
  const [lang, setLang] = useState("sw");
  const t = T[lang];

  // Sync lang into auth hook
  useEffect(() => { auth.setLang(lang); }, [lang]);

  // Notify parent when done
  useEffect(() => {
    if (auth.isAuthenticated && onAuthenticated) {
      onAuthenticated(auth.user, auth.getToken);
    }
  }, [auth.isAuthenticated]);

  const stepTitles = {
    [AUTH_STEP.PHONE]:    t.appName,
    [AUTH_STEP.OTP]:      t.otpTitle,
    [AUTH_STEP.REGISTER]: t.regTitle,
  };

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
            <h1 style={styles.appTitle}>{stepTitles[auth.step]}</h1>
            {auth.step === AUTH_STEP.PHONE && (
              <p style={styles.tagline}>{t.tagline}</p>
            )}
          </div>
          {/* Language toggle */}
          <button
            onClick={() => setLang(l => l === "sw" ? "en" : "sw")}
            style={styles.langToggle}
          >
            {t.langToggle}
          </button>
        </div>

        {/* Step indicator */}
        <div style={styles.stepBar}>
          {[AUTH_STEP.PHONE, AUTH_STEP.OTP, AUTH_STEP.REGISTER].map((s, i) => (
            <div key={s} style={{
              ...styles.stepDot,
              background: [AUTH_STEP.PHONE, AUTH_STEP.OTP, AUTH_STEP.REGISTER].indexOf(auth.step) >= i
                ? "#1D9E75" : "#D3D1C7",
            }} />
          ))}
        </div>

        {/* Steps */}
        <div style={styles.stepContent}>
          {auth.step === AUTH_STEP.PHONE    && <PhoneStep    t={t} auth={auth} />}
          {auth.step === AUTH_STEP.OTP      && <OTPStep      t={t} auth={auth} />}
          {auth.step === AUTH_STEP.REGISTER && <RegisterStep t={t} auth={auth} />}
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
  stepBar: {
    display: "flex",
    gap: 6,
    marginBottom: 24,
  },
  stepDot: {
    height: 3,
    flex: 1,
    borderRadius: 2,
    transition: "background 0.3s",
  },
  stepContent: {
    minHeight: 160,
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
  },
  btnWhatsApp: {
    width: "100%",
    padding: "12px",
    background: "#fff",
    color: "#1a7a45",
    border: "1.5px solid #25D366",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  orDivider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "14px 0",
    fontSize: 12,
    color: "#888780",
  },
  orLine: {
    flex: 1,
    height: 1,
    background: "#D3D1C7",
    display: "block",
  },
  otpHint: {
    fontSize: 13,
    color: "#5F5E5A",
    textAlign: "center",
    margin: 0,
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