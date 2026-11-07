// AuthPage.test.js — guards the post-OTP authentication UI.
//
// The login page must offer phone + password and must NOT contain any remnant
// of the removed SMS/OTP flow (code boxes, "resend", countdowns, SMS buttons).
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AuthPage from "../components/AuthPage";

const makeAuth = (step) => ({
  step,
  setStep: () => {},
  setLang: () => {},
  setError: () => {},
  getToken: () => null,
  login: async () => {},
  register: async () => {},
  setPassword: async () => {},
  isAuthenticated: false,
  loading: false,
  error: null,
  user: null,
});

const passwordInputs = (html) => (html.match(/type="password"/g) || []).length;

describe("AuthPage (password login, no OTP)", () => {
  const loginHtml = renderToStaticMarkup(<AuthPage authHook={makeAuth("login")} />);
  const registerHtml = renderToStaticMarkup(<AuthPage authHook={makeAuth("register")} />);

  test("login screen renders", () => {
    expect(loginHtml.length).toBeGreaterThan(500);
  });

  test("login screen has phone + password inputs", () => {
    expect(loginHtml).toMatch(/type="tel"/);
    expect(passwordInputs(loginHtml)).toBeGreaterThanOrEqual(1);
  });

  test("login screen has no OTP wording or code entry", () => {
    expect(loginHtml).not.toMatch(/Msimbo|Enter Code|Verification code/i);
    expect(loginHtml).not.toMatch(/OTPInput|one-time/i);
  });

  test("login screen has no resend button or countdown", () => {
    expect(loginHtml).not.toMatch(/Tuma tena|Resend|sekunde|s\)/);
  });

  test("login screen has no SMS / WhatsApp delivery buttons", () => {
    // No channel picker: no "send via SMS/WhatsApp" control and no WhatsApp SVG.
    // (The footer's "contact us on WhatsApp" help note is unrelated and allowed.)
    expect(loginHtml).not.toMatch(/Tuma OTP|Send OTP|Tuma kwa|Send via/i);
    expect(loginHtml).not.toMatch(/\bSMS\b/);
    expect(loginHtml).not.toMatch(/<svg/);
  });

  test("register screen asks for password twice (password + confirm)", () => {
    expect(passwordInputs(registerHtml)).toBe(2);
  });

  test("register screen shows the minimum-length hint", () => {
    expect(registerHtml).toMatch(/8/);
    expect(registerHtml).toMatch(/herufi|characters/i);
  });

  test("register screen has no OTP wording", () => {
    expect(registerHtml).not.toMatch(/Msimbo|OTP/i);
  });

  test("both screens can switch between login and register", () => {
    expect(loginHtml).toMatch(/Jisajili/);   // "No account? Register"
    expect(registerHtml).toMatch(/Ingia/);    // "Already have an account? Sign in"
  });
});
