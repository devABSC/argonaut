import type { CronFrequency } from "@prisma/client";

/**
 * Whether a job is due, judged in Manila time.
 *
 * The scheduler that calls this runs in UTC, so every comparison converts
 * first — a job set for 7am means 7am where the company is, not where the
 * server happens to be.
 */
const MNL = 8 * 60 * 60 * 1000;

export const manila = (at: Date) => new Date(+at + MNL);

export const hhmm = (at: Date) => {
  const l = manila(at);
  return `${String(l.getUTCHours()).padStart(2, "0")}:${String(l.getUTCMinutes()).padStart(2, "0")}`;
};

export type Schedulable = {
  frequency: CronFrequency;
  times: string[];
  onDay: number | null;
  recurring: boolean;
  endsOn: Date | null;
  isActive: boolean;
  lastRunAt: Date | null;
};

/**
 * A job is due when its day matches, one of its times has arrived within the
 * window, and it has not already run in that same hour.
 */
export function isDue(job: Schedulable, at: Date, windowMinutes = 59): boolean {
  if (!job.isActive) return false;
  // Past its end date it is finished, whatever the schedule says.
  if (job.endsOn && manila(at) > manila(job.endsOn)) return false;
  if (!job.recurring && job.lastRunAt) return false;

  const l = manila(at);

  if (job.frequency === "WEEKLY") {
    // 1 = Monday, matching how people say it.
    const dow = l.getUTCDay() === 0 ? 7 : l.getUTCDay();
    if (job.onDay && dow !== job.onDay) return false;
  }
  if (job.frequency === "MONTHLY" && job.onDay && l.getUTCDate() !== job.onDay) return false;

  // Already run this hour — the scheduler may fire more than once.
  if (job.lastRunAt) {
    const last = manila(job.lastRunAt);
    if (last.getUTCFullYear() === l.getUTCFullYear() && last.getUTCMonth() === l.getUTCMonth()
        && last.getUTCDate() === l.getUTCDate() && last.getUTCHours() === l.getUTCHours()) {
      return false;
    }
  }

  if (job.frequency === "HOURLY") return true;

  // Any of its times falling inside this hour's window makes it due.
  const nowMin = l.getUTCHours() * 60 + l.getUTCMinutes();
  return job.times.some((t) => {
    const [h, m] = t.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
    const due = h * 60 + m;
    return nowMin >= due && nowMin - due <= windowMinutes;
  });
}

/** How the schedule reads on screen. */
export function describeSchedule(job: Schedulable): string {
  const times = job.times.length ? job.times.join(", ") : "";
  const day = (n: number | null) => (n ? ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][n] ?? String(n) : "");

  const base =
    job.frequency === "HOURLY" ? "Every hour"
    : job.frequency === "DAILY" ? `Daily${times ? ` at ${times}` : ""}`
    : job.frequency === "WEEKLY" ? `Weekly on ${day(job.onDay) || "a set day"}${times ? ` at ${times}` : ""}`
    : `Monthly on day ${job.onDay ?? "?"}${times ? ` at ${times}` : ""}`;

  return base + (job.recurring ? "" : ", once only");
}
