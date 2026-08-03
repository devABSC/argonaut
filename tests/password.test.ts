import assert from "node:assert/strict";
import { passwordExpired, needsPasswordChange, PASSWORD_MAX_AGE_DAYS } from "../src/lib/password-policy.ts";

let n = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); n++; };
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const u = (o: Partial<Parameters<typeof needsPasswordChange>[0]> = {}) => ({
  role: "EMPLOYEE" as const,
  mustChangePassword: false,
  passwordChangedAt: daysAgo(1),
  createdAt: daysAgo(200),
  ...o,
});

ok("policy is three months", PASSWORD_MAX_AGE_DAYS === 90);

/* --- expiry --- */
ok("fresh password is fine", !passwordExpired(u({ passwordChangedAt: daysAgo(1) })));
ok("89 days is still fine", !passwordExpired(u({ passwordChangedAt: daysAgo(89) })));
ok("91 days has expired", passwordExpired(u({ passwordChangedAt: daysAgo(91) })));

/* --- never changed falls back to when the account was made --- */
ok("never changed, old account -> expired",
  passwordExpired(u({ passwordChangedAt: null, createdAt: daysAgo(120) })));
ok("never changed, new account -> not yet",
  !passwordExpired(u({ passwordChangedAt: null, createdAt: daysAgo(3) })));

/* --- the owner is exempt --- */
ok("owner never expires", !passwordExpired(u({ role: "SUPER_USER", passwordChangedAt: daysAgo(999) })));
ok("owner exempt even if never changed",
  !passwordExpired(u({ role: "SUPER_USER", passwordChangedAt: null, createdAt: daysAgo(999) })));
ok("administrator is NOT exempt", passwordExpired(u({ role: "ADMINISTRATOR", passwordChangedAt: daysAgo(120) })));

/* --- the gate combines first-time and expiry --- */
ok("first-time flag holds them", needsPasswordChange(u({ mustChangePassword: true })));
ok("owner still held by an explicit flag",
  needsPasswordChange(u({ role: "SUPER_USER", mustChangePassword: true })));
ok("nothing owed, nothing asked", !needsPasswordChange(u()));
ok("expired password is held", needsPasswordChange(u({ passwordChangedAt: daysAgo(120) })));

console.log(`\n  ✓ ${n} password-policy assertions passed\n`);
