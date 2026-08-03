/**
 * Working-hours SLA.
 *
 * One SLA day is eight working hours. Only Monday to Friday count, and only
 * the hours inside the working window — so a ticket raised at 4pm Friday has
 * used one hour by 9am Monday, not sixty-five.
 *
 * The Philippines has no daylight saving, so Manila is a fixed UTC+8 and the
 * arithmetic can shift by a constant rather than pull in a timezone library.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 08:00–17:00 with an hour for lunch — eight working hours a day. */
export const WORK = { start: 8, lunchStart: 12, lunchEnd: 13, end: 17 };
export const HOURS_PER_SLA_DAY = 8;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Milliseconds where two ranges overlap. */
function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Working milliseconds between two instants, weekends and off-hours excluded. */
export function workingMsBetween(from: Date, to: Date): number {
  let start = from.getTime() + MANILA_OFFSET_MS;
  const end = to.getTime() + MANILA_OFFSET_MS;
  if (end <= start) return 0;

  let total = 0;
  // Walk one Manila day at a time from the day containing `start`.
  let dayStart = Math.floor(start / DAY_MS) * DAY_MS;

  while (dayStart < end) {
    const dow = new Date(dayStart).getUTCDay(); // 0 Sun … 6 Sat, in Manila terms
    if (dow !== 0 && dow !== 6) {
      const morning: [number, number] = [dayStart + WORK.start * HOUR_MS, dayStart + WORK.lunchStart * HOUR_MS];
      const afternoon: [number, number] = [dayStart + WORK.lunchEnd * HOUR_MS, dayStart + WORK.end * HOUR_MS];
      total += overlap(start, end, ...morning) + overlap(start, end, ...afternoon);
    }
    dayStart += DAY_MS;
    start = Math.min(start, dayStart);
  }
  return total;
}

export function workingHoursBetween(from: Date, to: Date): number {
  return workingMsBetween(from, to) / HOUR_MS;
}

/** "6h 30m", or "—" when nothing has elapsed. */
export function formatWorkingDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export type SlaState = {
  /** Working hours consumed so far. */
  usedHours: number;
  allowedHours: number;
  used: string;
  allowed: string;
  /** Past the allowance. */
  breached: boolean;
  /** Within the last quarter of the allowance but not yet past it. */
  atRisk: boolean;
  pct: number;
};

/** Where a step stands against its allowance. `to` is now for an open step. */
export function slaState(from: Date, to: Date, slaDays: number): SlaState {
  const usedMs = workingMsBetween(from, to);
  const usedHours = usedMs / HOUR_MS;
  const allowedHours = Math.max(0, slaDays) * HOURS_PER_SLA_DAY;
  const pct = allowedHours === 0 ? 0 : (usedHours / allowedHours) * 100;

  return {
    usedHours,
    allowedHours,
    used: formatWorkingDuration(usedMs),
    allowed: `${allowedHours}h`,
    breached: allowedHours > 0 && usedHours > allowedHours,
    atRisk: allowedHours > 0 && pct >= 75 && usedHours <= allowedHours,
    pct: Math.min(100, Math.round(pct)),
  };
}
