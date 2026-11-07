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

// ── Field-level validation (interaction tests) ───────────────────────────────
// Regression guard for a bug where a touched password field always showed its
// error string: users saw "Manenosiri hayafanani" with two identical passwords
// and "Nenosiri lazima liwe na herufi 8 au zaidi" while typing a long one.
import ReactDOM from "react-dom/client";
import { act } from "react-dom/test-utils";

global.IS_REACT_ACT_ENVIRONMENT = true;

const setValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const submitForm = (container) =>
  container.querySelector("form").dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true })
  );

async function renderPage(step) {
  const auth = makeAuth(step);
  auth.login = jest.fn(async () => ({}));
  auth.register = jest.fn(async () => ({}));

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);
  await act(async () => {
    root.render(<AuthPage authHook={auth} />);
    await Promise.resolve();
  });

  return {
    auth,
    container,
    passwords: () => container.querySelectorAll('input[type="password"]'),
    textInputs: () => container.querySelectorAll('input[type="text"], input[type="email"]'),
    phone: () => container.querySelector('input[type="tel"]'),
    text: () => container.textContent,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("password validation feedback", () => {
  beforeEach(() => {
    // Keep the API health probe from making a real request.
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200 }));
  });

  test("login form: 8+ characters shows the hint, never the length error", async () => {
    const page = await renderPage("login");
    const [pw] = page.passwords();

    await act(async () => { setValue(pw, "abcdefgh"); });

    expect(page.text()).toMatch(/Angalau herufi 8/);
    expect(page.text()).not.toMatch(/Nenosiri lazima liwe na herufi 8 au zaidi/);
    await page.unmount();
  });

  test("login with a short password surfaces the length error on submit", async () => {
    const page = await renderPage("login");
    const [pw] = page.passwords();

    await act(async () => {
      setValue(pw, "abc");
      submitForm(page.container);
    });

    expect(page.text()).toMatch(/Nenosiri lazima liwe na herufi 8 au zaidi/);
    expect(page.auth.login).not.toHaveBeenCalled();
    await page.unmount();
  });

  test("register with identical 8+ character passwords submits without errors", async () => {
    const page = await renderPage("register");
    const [pw, confirm] = page.passwords();
    const [fullName] = page.textInputs();

    await act(async () => {
      setValue(pw, "NenosiriSalama1");
      setValue(confirm, "NenosiriSalama1");
      setValue(fullName, "Mama Zena");
      setValue(page.phone(), "0712345678");
      submitForm(page.container);
    });

    expect(page.text()).not.toMatch(/Manenosiri hayafanani/);
    expect(page.text()).not.toMatch(/Nenosiri lazima liwe na herufi 8 au zaidi/);
    expect(page.auth.register).toHaveBeenCalledTimes(1);
    expect(page.auth.register.mock.calls[0][0]).toMatchObject({
      phone_number: "0712345678",
      password: "NenosiriSalama1",
      full_name: "Mama Zena",
    });
    await page.unmount();
  });

  test("register with different passwords surfaces the mismatch error on submit", async () => {
    const page = await renderPage("register");
    const [pw, confirm] = page.passwords();
    const [fullName] = page.textInputs();

    await act(async () => {
      setValue(pw, "NenosiriSalama1");
      setValue(confirm, "NenosiriSalama2");
      setValue(fullName, "Mama Zena");
      setValue(page.phone(), "0712345678");
      submitForm(page.container);
    });

    expect(page.text()).toMatch(/Manenosiri hayafanani/);
    expect(page.auth.register).not.toHaveBeenCalled();
    await page.unmount();
  });

  test("an unreachable API is reported together with the URL being used", async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch")));

    const page = await renderPage("login");
    await act(async () => { await Promise.resolve(); });

    expect(page.text()).toMatch(/Seva haipatikani/);
    expect(page.text()).toMatch(/\/health/);
    await page.unmount();
  });
});
