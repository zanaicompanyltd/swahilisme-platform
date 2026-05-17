// useAuth.js — Swahilisme Platform
// Manages the full auth flow: send OTP → verify → register/login
// Bilingual (sw/en). Phone primary, email optional
//
// FIX 1: API_BASE now reads REACT_APP_API_URL (same as useApi.js)
//         Backend has NO /api/v1 prefix — auth routes are at /auth/...
// FIX 2: apiFetch throws proper Error (never plain object → no [object Object])

import { useState, useCallback, useEffect } from "react";

// ── Backend base URL — NO /api/v1 prefix (auth routes are at /auth/...) ───────
const API_BASE    = process.env.REACT_APP_API_URL || "http://localhost:8000";
const TOKEN_KEY   = "swahilisme_access_token";
const REFRESH_KEY = "swahilisme_refresh_token";
const USER_KEY    = "swahilisme_user";

export const AUTH_STEP = {
  PHONE:    "phone",
  OTP:      "otp",
  REGISTER: "register",
  DONE:     "done",
};

// ── Safely extract a readable string from any backend detail shape ─────────────
// Backend returns detail as EITHER:
//   "Nambari si sahihi"                      (plain string)
//   {"sw": "Msimbo si sahihi.", "en": "..."}  (bilingual object)
function extractError(detail, lang = "sw") {
  if (!detail) return "Hitilafu isiyojulikana.";
  if (typeof detail === "string") return detail;
  if (typeof detail === "object") {
    return detail[lang] || detail.sw || detail.en
      || Object.values(detail)[0]
      || "Hitilafu imetokea.";
  }
  return String(detail);
}

// ── Internal fetch — always throws a proper Error with a readable message ──────
// useAuth.js
const apiFetch = async (url, options) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    // This catches "Failed to fetch" (network errors) and manual throws
    console.error("Network or CORS error:", error);
    throw error;
  }
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export default function useAuth() {
  const [step,           setStep]           = useState(AUTH_STEP.PHONE);
  const [phone,          setPhone]          = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("sms");
  const [lang,           setLang]           = useState("sw");
  const [user,           setUser]           = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    const token     = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setStep(AUTH_STEP.DONE);
      } catch {}
    }
  }, []);

  // ── Resend countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  // ── Persist tokens + user ──────────────────────────────────────────────────
  const _persistTokens = useCallback((accessToken, refreshTok, userData) => {
    localStorage.setItem(TOKEN_KEY,   accessToken);
    localStorage.setItem(REFRESH_KEY, refreshTok);
    localStorage.setItem(USER_KEY,    JSON.stringify(userData));
    setUser(userData);
    setStep(AUTH_STEP.DONE);
  }, []);

  // ── Step 1: Send OTP  →  POST /auth/send-otp ──────────────────────────────
  const sendOTP = useCallback(async (phoneNumber, method = "sms") => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(
        "/auth/send-otp",
        {
          method: "POST",
          body: JSON.stringify({
            phone_number:    phoneNumber,
            delivery_method: method,
            lang,
            purpose:         "login",
          }),
        },
        lang
      );
      setPhone(phoneNumber);
      setDeliveryMethod(result.delivery_method || method);
      setStep(AUTH_STEP.OTP);
      setResendCountdown(60);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [lang]);

  // ── Step 2: Verify OTP  →  POST /auth/verify-otp ─────────────────────────
  const verifyOTP = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(
        "/auth/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ phone_number: phone, code, purpose: "login" }),
        },
        lang
      );
      if (result.needs_registration) {
        setStep(AUTH_STEP.REGISTER);
      } else {
        _persistTokens(result.access_token, result.refresh_token, result.user);
      }
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [phone, lang, _persistTokens]);

  // ── Step 3: Register (new users)  →  POST /auth/register ─────────────────
  const register = useCallback(async (profileData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ phone_number: phone, preferred_lang: lang, ...profileData }),
        },
        lang
      );
      _persistTokens(result.access_token, result.refresh_token, result.user);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [phone, lang, _persistTokens]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setStep(AUTH_STEP.PHONE);
    setPhone("");
    setError(null);
  }, []);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  return {
    step, setStep,
    phone, setPhone,
    deliveryMethod,
    lang, setLang,
    user,
    loading,
    error, setError,
    resendCountdown,
    sendOTP,
    verifyOTP,
    register,
    logout,
    getToken,
    isAuthenticated: step === AUTH_STEP.DONE && !!user,
  };
}
