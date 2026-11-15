import { healthCardRequestUrl } from "./useApi";

describe("health-card download URL", () => {
  test("uses the same-origin Vercel proxy in production", () => {
    expect(healthCardRequestUrl("+255712345678", 90, "https://swahilisme-platform.vercel.app")).toBe(
      "https://swahilisme-platform.vercel.app/daftari/health-card?user_id=%2B255712345678&days=90"
    );
  });

  test("uses the configured Railway API directly for local development", () => {
    const url = healthCardRequestUrl("account-123", 120, "http://localhost:3000");
    expect(url).toMatch(/^https:\/\/swahilisme-platform-production-b5b9\.up\.railway\.app\/daftari\/health-card/);
    expect(url).toContain("user_id=account-123&days=120");
  });
});
