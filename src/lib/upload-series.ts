// Bucketing for the CV upload chart. Pure date maths, kept out of the
// component so it can be exercised directly.

/** How the uploads are bucketed, and how far back each view looks. */
export const SPANS = {
  daily: { label: "Daily", buckets: 14 },
  weekly: { label: "Weekly", buckets: 12 },
  monthly: { label: "Monthly", buckets: 12 },
  quarterly: { label: "Quarterly", buckets: 8 },
} as const;

export type Span = keyof typeof SPANS;
export const isSpan = (v: string): v is Span => v in SPANS;

/** Manila is fixed UTC+8, so a day boundary is a known offset — no tz table. */
const MNL = 8 * 60 * 60 * 1000;
const local = (d: Date) => new Date(+d + MNL);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The bucket a moment falls in, and the label that bucket carries. */
export function bucketOf(when: Date, span: Span): { key: string; label: string } {
  const d = local(when);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();

  if (span === "daily") {
    return { key: iso(d), label: `${d.getUTCDate()}/${m + 1}` };
  }
  if (span === "weekly") {
    // Week starting Monday.
    const day = (d.getUTCDay() + 6) % 7;
    const start = new Date(Date.UTC(y, m, d.getUTCDate() - day));
    return { key: iso(start), label: `${start.getUTCDate()}/${start.getUTCMonth() + 1}` };
  }
  if (span === "monthly") {
    const start = new Date(Date.UTC(y, m, 1));
    return { key: iso(start), label: start.toLocaleString("en-GB", { month: "short" }) };
  }
  const q = Math.floor(m / 3);
  const start = new Date(Date.UTC(y, q * 3, 1));
  return { key: iso(start), label: `Q${q + 1} ${String(y).slice(2)}` };
}

/** The run of buckets ending today, oldest first. */
export function series(span: Span): { key: string; label: string }[] {
  const now = local(new Date());
  const out: { key: string; label: string }[] = [];
  for (let i = SPANS[span].buckets - 1; i >= 0; i -= 1) {
    let at: Date;
    if (span === "daily") at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    else if (span === "weekly") at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
    else if (span === "monthly") at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    else at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i * 3, 1));
    // bucketOf works in Manila time; these are already Manila, so undo the
    // shift it will apply.
    out.push(bucketOf(new Date(+at - MNL), span));
  }
  return out;
}

