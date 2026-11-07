// useApi.test.js — REACT_APP_API_URL must always become an absolute origin.
//
// A value without a scheme ("my-service.up.railway.app") is not an absolute
// URL: the browser resolves it against the Vercel origin, the request lands on
// the SPA rewrite, and the API is never called.
import { resolveApiBase } from "../hooks/useApi";

describe("resolveApiBase", () => {
  test("keeps an absolute https URL as-is", () => {
    expect(resolveApiBase("https://api.example.com")).toBe("https://api.example.com");
  });

  test("adds https:// to a bare host", () => {
    expect(resolveApiBase("swahilisme-platform-production-b5b9.up.railway.app")).toBe(
      "https://swahilisme-platform-production-b5b9.up.railway.app"
    );
  });

  test("keeps an explicit http:// (local development)", () => {
    expect(resolveApiBase("http://localhost:8000")).toBe("http://localhost:8000");
  });

  test("strips trailing slashes and surrounding whitespace", () => {
    expect(resolveApiBase("  https://api.example.com/  ")).toBe("https://api.example.com");
  });

  test("falls back to localhost when unset or empty", () => {
    expect(resolveApiBase(undefined)).toBe("http://localhost:8000");
    expect(resolveApiBase("")).toBe("http://localhost:8000");
    expect(resolveApiBase("   ")).toBe("http://localhost:8000");
  });
});
