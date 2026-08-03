import assert from "node:assert/strict";
import { workingHoursBetween, slaState, formatWorkingDuration } from "../src/lib/sla.ts";

let n = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); n++; };
// Manila wall-clock helper: Manila is UTC+8, so subtract 8h to build the UTC instant.
const mnl = (iso: string) => new Date(new Date(iso + "Z").getTime() - 8 * 3600_000);
const close = (a: number, b: number) => Math.abs(a - b) < 0.001;

/* --- a single working day is eight hours --- */
// Mon 2026-08-03 08:00 -> 17:00 spans the whole window, minus lunch.
ok("full working day = 8h", close(workingHoursBetween(mnl("2026-08-03T08:00:00"), mnl("2026-08-03T17:00:00")), 8));
ok("morning only = 4h", close(workingHoursBetween(mnl("2026-08-03T08:00:00"), mnl("2026-08-03T12:00:00")), 4));
ok("lunch hour does not count", close(workingHoursBetween(mnl("2026-08-03T12:00:00"), mnl("2026-08-03T13:00:00")), 0));
ok("across lunch, 11:30->13:30 = 1h", close(workingHoursBetween(mnl("2026-08-03T11:30:00"), mnl("2026-08-03T13:30:00")), 1));

/* --- outside hours contributes nothing --- */
ok("before opening", close(workingHoursBetween(mnl("2026-08-03T05:00:00"), mnl("2026-08-03T08:00:00")), 0));
ok("after closing", close(workingHoursBetween(mnl("2026-08-03T17:00:00"), mnl("2026-08-03T23:00:00")), 0));
ok("overnight Mon 16:00 -> Tue 09:00 = 2h",
  close(workingHoursBetween(mnl("2026-08-03T16:00:00"), mnl("2026-08-04T09:00:00")), 2));

/* --- weekends are skipped --- */
// 2026-08-08 is a Saturday, 2026-08-09 a Sunday.
ok("Saturday counts nothing", close(workingHoursBetween(mnl("2026-08-08T08:00:00"), mnl("2026-08-08T17:00:00")), 0));
ok("Sunday counts nothing", close(workingHoursBetween(mnl("2026-08-09T08:00:00"), mnl("2026-08-09T17:00:00")), 0));
ok("Fri 16:00 -> Mon 09:00 = 2h, weekend skipped",
  close(workingHoursBetween(mnl("2026-08-07T16:00:00"), mnl("2026-08-10T09:00:00")), 2));
ok("a full Mon-Fri week = 40h",
  close(workingHoursBetween(mnl("2026-08-03T08:00:00"), mnl("2026-08-07T17:00:00")), 40));

/* --- ordering and degenerate ranges --- */
ok("end before start = 0", workingHoursBetween(mnl("2026-08-04T10:00:00"), mnl("2026-08-03T10:00:00")) === 0);
ok("same instant = 0", workingHoursBetween(mnl("2026-08-03T10:00:00"), mnl("2026-08-03T10:00:00")) === 0);

/* --- SLA verdicts: one SLA day is eight working hours --- */
const within = slaState(mnl("2026-08-03T08:00:00"), mnl("2026-08-03T11:00:00"), 1);
ok("3h of an 8h allowance is not breached", !within.breached && within.usedHours === 3);
ok("allowance renders as 8h", within.allowed === "8h");
ok("3/8 is not yet at risk", !within.atRisk);

const risky = slaState(mnl("2026-08-03T08:00:00"), mnl("2026-08-03T15:00:00"), 1);
ok("7h of 8h is at risk", risky.atRisk && !risky.breached);

const late = slaState(mnl("2026-08-03T08:00:00"), mnl("2026-08-04T10:00:00"), 1);
ok("10h against a 1-day SLA is breached", late.breached && close(late.usedHours, 10));

const twoDay = slaState(mnl("2026-08-03T08:00:00"), mnl("2026-08-04T17:00:00"), 2);
ok("2-day SLA allows 16h", twoDay.allowedHours === 16 && !twoDay.breached);

// Raised Friday afternoon, acted on Monday morning — the weekend must not burn it.
const weekend = slaState(mnl("2026-08-07T16:00:00"), mnl("2026-08-10T09:00:00"), 1);
ok("Friday 16:00 -> Monday 09:00 uses 2h, not breached", !weekend.breached && close(weekend.usedHours, 2));

ok("duration formatting", formatWorkingDuration(0) === "0m"
  && formatWorkingDuration(90 * 60000) === "1h 30m"
  && formatWorkingDuration(120 * 60000) === "2h"
  && formatWorkingDuration(45 * 60000) === "45m");

console.log(`\n  ✓ ${n} SLA assertions passed\n`);
