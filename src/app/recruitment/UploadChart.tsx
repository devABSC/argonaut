import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { RoleKey } from "@/lib/roles";
import { SPANS, series, type Span } from "@/lib/upload-series";
import type { Grain } from "@/lib/upload-stat";
import ChartPicker from "./ChartPicker";

export { isSpan } from "@/lib/upload-series";

/**
 * Series colours come from the app's own tokens, not a palette invented here,
 * so the chart sits in the theme instead of shouting over it. Combined mode
 * uses one neutral bar; only "per recruiter" needs telling apart, and it
 * separates them by depth of the same accents.
 */
const HUES = [
  "var(--cyan)",
  "var(--violet)",
  "var(--blue)",
  "var(--muted)",
  "var(--faint)",
];

/**
 * CV uploads over time, above the candidate list.
 *
 * Counts the upload rather than the candidate record — a candidate can be
 * entered first and their CV attached later.
 *
 * One CV counts once. A candidate holds a single CV, so re-reading or
 * replacing it moves when it counts but never adds a second tally. Scoped like
 * the list beneath it: a recruiter's own uploads, everything for the owner.
 */
export default async function UploadChart({
  viewer,
  span,
  year,
  recruiter,
  query,
}: {
  viewer: { id: string; role: RoleKey };
  span: Span;
  /** Which year the Annual view draws. Ignored by the rolling spans. */
  year: number;
  /** Whose uploads to draw. Empty means everyone, combined into one bar. */
  recruiter: string;
  /** The list's current query string, so switching view keeps the filters. */
  query: Record<string, string>;
}) {
  // Reads the tally the nightly job leaves behind — never a live count. The
  // grain asked for is the grain stored, so this is a handful of rows.
  // The chart's spans and the tally's grains are named differently: Annual is
  // twelve months of one year, so it reads the monthly rows.
  const GRAIN_OF: Record<Span, Grain> = {
    daily: "day", weekly: "week", monthly: "month", quarterly: "quarter", annual: "month",
  };
  const grain = GRAIN_OF[span];

  const [stats, people] = await Promise.all([
    prisma.uploadStat.findMany({
      where: {
        grain,
        ...(recruiter && recruiter !== "none" ? { recruiterId: recruiter } : {}),
        ...(recruiter === "none" ? { recruiterId: "" } : {}),
        // A recruiter who is not the owner only ever sees their own tally.
        ...(viewer.role === "SUPER_USER" ? {} : { recruiterId: viewer.id }),
      },
      select: { bucket: true, recruiterId: true, count: true },
    }),
    // Only the owner is offered a choice of recruiter, so only the owner needs
    // the list.
    viewer.role === "SUPER_USER"
      ? prisma.uploadStat.groupBy({
          by: ["recruiterId"],
          where: { grain: "year", recruiterId: { not: "" } },
          _sum: { count: true },
        })
      : [],
  ]);

  const names = people.length
    ? await prisma.user.findMany({
        where: { id: { in: people.map((p) => p.recruiterId) } },
        select: { id: true, name: true },
      })
    : [];
  const recruiters = names
    .map((n) => ({
      id: n.id,
      name: n.name,
      count: people.find((p) => p.recruiterId === n.id)?._sum.count ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Years the tally has anything in, newest first.
  const years = [...new Set(stats.map((r) => new Date(r.bucket).getUTCFullYear()))].sort((a, b) => b - a);


  const buckets = series(span, year);
  const index = new Map(buckets.map((b, i) => [b.key, i]));

  // recruiter -> counts per bucket, straight from the stored rows
  const byWho = new Map<string, { name: string; counts: number[] }>();
  let total = 0;
  for (const r of stats) {
    const i = index.get(new Date(r.bucket).toISOString().slice(0, 10));
    if (i === undefined) continue; // outside the window on screen
    const id = recruiter ? recruiter : "all";
    const name = recruiter
      ? names.find((n) => n.id === r.recruiterId)?.name ?? "No recruiter"
      : "All recruiters";
    if (!byWho.has(id)) byWho.set(id, { name, counts: Array(buckets.length).fill(0) });
    byWho.get(id)!.counts[i] += r.count;
    total += r.count;
  }

  const seriesList = [...byWho.entries()]
    .map(([id, v], i) => ({ id, ...v, hue: HUES[i % HUES.length] }))
    .sort((a, b) => b.counts.reduce((x, y) => x + y, 0) - a.counts.reduce((x, y) => x + y, 0));

  const peak = Math.max(1, ...buckets.map((_, i) => Math.max(...seriesList.map((s) => s.counts[i]), 0)));

  // Plain SVG on a fixed grid: no chart library, no client JS, and it prints.
  const W = 960, H = 210, PADL = 34, PADB = 26, PADT = 12;
  const plotW = W - PADL - 10, plotH = H - PADB - PADT;
  const slot = plotW / buckets.length;
  const groupW = slot * 0.68;
  const barW = Math.max(3, groupW / Math.max(1, seriesList.length));

  const href = (over: Record<string, string>) => {
    const q = new URLSearchParams({ ...query, ...over });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/recruitment/candidates?${q.toString()}`;
  };

  // Four gridlines is enough to read a height without crowding the plot.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(peak * f)).filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="panel chartpanel">
      <div className="cat-head">
        <h2>CV uploads <span className="count">{total}</span></h2>
        <span className="spacer" />
        <div className="chartswitch">
          {(Object.keys(SPANS) as Span[]).map((k) => (
            <Link key={k} href={href({ span: k })} className={k === span ? "on" : undefined}>
              {SPANS[k].label}
            </Link>
          ))}
          {span === "annual" && years.length > 0 && (
            <>
              <span className="sep" />
              <ChartPicker
                recruiter={String(year)}
                recruiters={years.map((y) => ({ id: String(y), name: String(y), count: 0 }))}
                hrefFor={Object.fromEntries(years.map((y) => [String(y), href({ year: String(y) })]))}
                allLabel={null}
                label="Year shown in the chart"
              />
            </>
          )}
          {recruiters.length > 0 && (
            <>
              <span className="sep" />
              <ChartPicker
                recruiter={recruiter}
                recruiters={recruiters}
                hrefFor={{
                  "": href({ recruiter: "" }),
                  ...Object.fromEntries(recruiters.map((r) => [r.id, href({ recruiter: r.id })])),
                }}
              />
            </>
          )}
        </div>
      </div>

      {total === 0 ? (
        <p style={{ marginTop: 12 }}>No CVs uploaded in this period.</p>
      ) : (
        <>
          <div className="chartwrap">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="xMidYMid meet"
              aria-label={`CV uploads, ${SPANS[span].label.toLowerCase()}, ${seriesList[0]?.name ?? "no data"}`}>
              {ticks.map((t) => {
                const y = PADT + plotH - (t / peak) * plotH;
                return (
                  <g key={t}>
                    <line x1={PADL} y1={y} x2={W - 10} y2={y} className="grid" />
                    <text x={PADL - 7} y={y + 3.5} className="axis" textAnchor="end">{t}</text>
                  </g>
                );
              })}

              {buckets.map((b, i) => {
                const x0 = PADL + i * slot + (slot - groupW) / 2;
                return (
                  <g key={b.key}>
                    {seriesList.map((sr, k) => {
                      const v = sr.counts[i];
                      const h = (v / peak) * plotH;
                      return v === 0 ? null : (
                        <rect key={sr.id} x={x0 + k * barW} y={PADT + plotH - h}
                          width={Math.max(2, barW - 2)} height={h} rx={2} fill={sr.hue}>
                          <title>{`${sr.name} — ${b.label}: ${v}`}</title>
                        </rect>
                      );
                    })}
                    {/* Every label on a dense axis would collide; thin them. */}
                    {(buckets.length <= 12 || i % 2 === 0) && (
                      <text x={PADL + i * slot + slot / 2} y={H - 8} className="axis" textAnchor="middle">
                        {b.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {(
            <div className="chartkey">
              {seriesList.map((sr) => (
                <span key={sr.id}>
                  <i style={{ background: sr.hue }} />
                  {sr.name}
                  <b>{sr.counts.reduce((a, b) => a + b, 0)}</b>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
