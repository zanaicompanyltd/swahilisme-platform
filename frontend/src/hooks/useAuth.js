// useAuth.js — Swahilisme Platform
// Password-based authentication (phone number + password → JWT tokens).
//
// The SMS/WhatsApp OTP flow was removed: there is no "send code" or "verify
// code" step anymore. Accounts are created with a password, and the password
// is what proves identity at login.

import { useState, useCallback, useEffect } from "react";

// ── Backend base URL — NO /api/v1 prefix (auth routes are at /auth/...) ───────
const API_BASE    = process.env.REACT_APP_API_URL || "http://localhost:8000";
const TOKEN_KEY   = "swahilisme_access_token";
const REFRESH_KEY = "swahilisme_refresh_token";
const USER_KEY    = "swahilisme_user";

export const AUTH_STEP = {
  LOGIN:    "login",
  REGISTER: "register",
  DONE:     "done",
};

export const PASSWORD_MIN_LENGTH = 8;

// ── Safely extract a readable string from any backend detail shape ─────────────
// Backend returns detail as EITHER:
//   "Nambari si sahihi"                      (plain string)
//   {"sw": "Msimbo si sahihi.", "en": "..."}  (bilingual object)
function extractError(detail, lang = "sw") {
  if (!detail) return "Hitilafu isiyojulikana.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => e.msg || JSON.stringify(e)).join(", ");
  }
  if (typeof detail === "object") {
    return detail[lang] || detail.sw || detail.en
      || Object.values(detail)[0]
      || "Hitilafu imetokea.";
  }
  return String(detail);
}

// ── Internal fetch — always throws a proper Error with a readable message ──────
const apiFetch = async (url, options = {}, lang = "sw") => {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (!response.ok) {
    let detail;
    try {
      const body = await response.json();
      detail = body.detail;
    } catch {
      detail = `HTTP error! status: ${response.status}`;
    }
    throw new Error(extractError(detail, lang));
  }
  return response.json();
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export default function useAuth() {
  const [step,  setStep]  = useState(AUTH_STEP.LOGIN);
  const [lang,  setLang]  = useState("sw");
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

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

  // ── Persist tokens + user ──────────────────────────────────────────────────
  const _persistTokens = useCallback((accessToken, refreshTok, userData) => {
    localStorage.setItem(TOKEN_KEY,   accessToken);
    localStorage.setItem(REFRESH_KEY, refreshTok);
    localStorage.setItem(USER_KEY,    JSON.stringify(userData));
    setUser(userData);
    setStep(AUTH_STEP.DONE);
  }, []);

  const _run = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Login  →  POST /auth/login  (phone + password) ─────────────────────────
  const login = useCallback((phoneNumber, password) => _run(async () => {
    const result = await apiFetch(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ phone_number: phoneNumber, password }) },
      lang
    );
    _persistTokens(result.access_token, result.refresh_token, result.user);
    return result;
  }), [_run, lang, _persistTokens]);

  // ── Register  →  POST /auth/register  (creates the account, logs in) ───────
  const register = useCallback((profileData) => _run(async () => {
    const result = await apiFetch(
      "/auth/register",
      { method: "POST", body: JSON.stringify({ preferred_lang: lang, ...profileData }) },
      lang
    );
    _persistTokens(result.access_token, result.refresh_token, result.user);
    return result;
  }), [_run, lang, _persistTokens]);

  // ── Set / change password  →  POST /auth/set-password (Bearer required) ────
  // Migration path for accounts created while OTP was the only credential.
  const setPassword = useCallback((newPassword, currentPassword) => _run(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error("Not authenticated.");
    const result = await apiFetch(
      "/auth/set-password",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          new_password:     newPassword,
          current_password: currentPassword || null,
        }),
      },
      lang
    );
    if (result.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);
    }
    return result;
  }), [_run, lang]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  // JWTs are stateless, so logout clears the credentials from this device.
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setStep(AUTH_STEP.LOGIN);
    setError(null);
  }, []);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  return {
    step, setStep,
    lang, setLang,
    user,
    loading,
    error, setError,
    login,
    register,
    setPassword,
    logout,
    getToken,
    isAuthenticated: step === AUTH_STEP.DONE && !!user,
  };
}
