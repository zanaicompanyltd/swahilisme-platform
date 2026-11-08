// Resolve the stable primary key returned by /auth/login and /auth/register.
// Never use a localStorage-generated/demo ID: ledger rows are keyed by this ID
// and must belong to the same account on every device.
export function resolveLedgerUserId(user) {
  const id = user && user.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
