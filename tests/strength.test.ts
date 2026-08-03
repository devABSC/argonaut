import assert from "node:assert/strict";
import { checkStrength, MIN_LENGTH } from "../src/lib/password-strength.ts";

let n = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); n++; };
const rejects = (pw: string) => checkStrength(pw) !== null;

ok("minimum is 12", MIN_LENGTH === 12);

/* --- length --- */
ok("11 chars rejected", rejects("Abcdefg1!23"));
ok("12 chars with all classes accepted", checkStrength("Abcdefg1!234") === null);
ok("empty rejected", rejects(""));

/* --- character classes --- */
ok("no digit rejected", rejects("Abcdefghij!!"));
ok("no letter rejected", rejects("1234567890!@"));
ok("no special rejected", rejects("Abcdefghij12"));
ok("long but letters only rejected", rejects("abcdefghijklmnop"));

/* --- realistic passwords --- */
ok("passphrase with all classes accepted", checkStrength("correct-horse-9") === null);
ok("typical strong password accepted", checkStrength("Tr0ub4dor&3xyz") === null);
ok("old 8-char minimum no longer passes", rejects("Passw0rd"));

/* --- padding --- */
ok("leading space rejected", rejects(" Abcdefg1!234"));
ok("trailing space rejected", rejects("Abcdefg1!234 "));

/* --- the message names the actual problem --- */
ok("says what is missing", (checkStrength("abcdefghijkl") ?? "").includes("number"));
ok("says when too short", (checkStrength("Ab1!") ?? "").includes("12"));

console.log(`\n  ✓ ${n} password-strength assertions passed\n`);
