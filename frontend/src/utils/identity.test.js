import { resolveLedgerUserId } from "./identity";

describe("resolveLedgerUserId", () => {
  test("uses the authenticated account's stable database id", () => {
    const loginResponse = { id: "+255712345678", phone_number: "+255712345678" };
    expect(resolveLedgerUserId(loginResponse)).toBe("+255712345678");
  });

  test("resolves identically for the same account on separate devices", () => {
    const deviceOneUser = { id: "account-123", phone_number: "+255712345678" };
    const deviceTwoUser = { id: "account-123", phone_number: "+255712345678" };
    expect(resolveLedgerUserId(deviceOneUser)).toBe(resolveLedgerUserId(deviceTwoUser));
  });

  test("refuses to invent a local/demo id when authentication data is missing", () => {
    expect(resolveLedgerUserId(null)).toBeNull();
    expect(resolveLedgerUserId({ phone_number: "+255712345678" })).toBeNull();
    expect(resolveLedgerUserId({ id: "   " })).toBeNull();
  });
});
