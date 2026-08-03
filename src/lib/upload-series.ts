// Bucketing for the CV upload chart. Pure date maths, kept out of the
// component so it can be exercised directly.

/** How the uploads are bucketed, and how far back each view looks. */
export const SPANS = {
  daily: { label: "Daily", buckets: 10 },
  weekly: { label: "Weekly", buckets: 12 },
  monthly: { label: "Monthly", buckets: 12 },
  quarterly: { label: "Quarterly", buckets: 8 },
  /** One named year, January to December, rather than a trailing window. */
  annual: { label: "Annual", buckets: 12 },
} as const;

export type Span = keyof typeof SPANS;
export const isSpan = (v: string): v is Span => v in SPANS;

/** Manila is fixed UTC+8, so a day boundary is a known offset — no tz table. */
const MNL = 8 * 60 * 60 * 1000;
const local = (d: Date) => new Date(+d + MNL);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The bucket a moment falls in, and the label that bucket carries. */
export function bucketOf(when: Date, span: Span): { key: string; label: string } {
  const d = local(when);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();

  if (span === "daily") {
    // Working days only. A weekend upload counts against the Friday before it
    // rather than vanishing — the axis is tidier, the total still adds up.
    const back = d.getUTCDay() === 6 ? 1 : d.getUTCDay() === 0 ? 2 : 0;
    const at = new Date(Date.UTC(y, m, d.getUTCDate() - back));
    return { key: iso(at), label: `${DAY[at.getUTCDay()]} ${at.getUTCDate()}/${at.getUTCMonth() + 1}` };
  }
  if (span === "weekly") {
    // Week starting Monday.
    const day = (d.getUTCDay() + 6) % 7;
    const start = new Date(Date.UTC(y, m, d.getUTCDate() - day));
    return { key: iso(start), label: `${start.getUTCDate()}/${start.getUTCMonth() + 1}` };
  }
  if (span === "monthly" || span === "annual") {
    const start = new Date(Date.UTC(y, m, 1));
    return { key: iso(start), label: start.toLocaleString("en-GB", { month: "short" }) };
  }
  const q = Math.floor(m / 3);
  const start = new Date(Date.UTC(y, q * 3, 1));
  return { key: iso(start), label: `Q${q + 1} ${String(y).slice(2)}` };
}

/**
 * The buckets to draw, oldest first.
 *
 * Every span but Annual is a window ending today. Annual is the twelve months
 * of one named year, so a finished year keeps showing its full shape instead
 * of scrolling away.
 */
export function series(span: Span, year?: number): { key: string; label: string }[] {
  const now = local(new Date());

  if (span === "annual") {
    const y = year ?? now.getUTCFullYear();
    return Array.from({ length: 12 }, (_, m) => {
      const start = new Date(Date.UTC(y, m, 1));
      return { key: iso(start), label: start.toLocaleString("en-GB", { month: "short" }) };
    });
  }

  const out: { key: string; label: string }[] = [];
  for (let i = SPANS[span].buckets - 1; i >= 0; i -= 1) {
    let at: Date;
    if (span === "daily") {
      // Step back i working days, skipping weekends entirely.
      const at2 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      let left = i;
      while (left > 0 || at2.getUTCDay() === 0 || at2.getUTCDay() === 6) {
        at2.setUTCDate(at2.getUTCDate() - 1);
        if (at2.getUTCDay() !== 0 && at2.getUTCDay() !== 6) left -= 1;
      }
      at = at2;
    }
    else if (span === "weekly") at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
    else if (span === "monthly") at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    else at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i * 3, 1));
    // bucketOf works in Manila time; these are already Manila, so undo the
    // shift it will apply.
    out.push(bucketOf(new Date(+at - MNL), span));
  }
  return out;
}

