import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { candidateScope } from "@/lib/candidate-scope";
import type { RoleKey } from "@/lib/roles";
import { SPANS, bucketOf, series, type Span } from "@/lib/upload-series";

export { isSpan } from "@/lib/upload-series";

/** Enough hues to tell recruiters apart, reused beyond that. */
const HUES = ["#38E8FF", "#7C6BFF", "#3DDC97", "#FFB86B", "#FF8FA3", "#8FD3FF", "#C9A6FF"];

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
  mode,
  recruiter,
  query,
}: {
  viewer: { id: string; role: RoleKey };
  span: Span;
  /** "combined" totals every recruiter into one bar; "each" draws them apart. */
  mode: "combined" | "each";
  /** Narrow to one recruiter, from the list's own filter. */
  recruiter: string;
  /** The list's current query string, so switching view keeps the filters. */
  query: Record<string, string>;
}) {
  const rows = await prisma.candidate.findMany({
    where: {
      ...candidateScope(viewer),
      cvUploadedAt: { not: null },
      ...(recruiter && recruiter !== "none" ? { recruiterId: recruiter } : {}),
      ...(recruiter === "none" ? { recruiterId: null } : {}),
    },
    select: { cvUploadedAt: true, recruiterId: true, recruiter: { select: { name: true } } },
  });

  const buckets = series(span);
  const index = new Map(buckets.map((b, i) => [b.key, i]));

  // recruiter -> counts per bucket
  const byWho = new Map<string, { name: string; counts: number[] }>();
  let total = 0;
  for (const r of rows) {
    const i = index.get(bucketOf(r.cvUploadedAt!, span).key);
    if (i === undefined) continue; // older than the window
    const id = mode === "combined" ? "all" : r.recruiterId ?? "none";
    const name = mode === "combined" ? "All recruiters" : r.recruiter?.name ?? "No recruiter";
    if (!byWho.has(id)) byWho.set(id, { name, counts: Array(buckets.length).fill(0) });
    byWho.get(id)!.counts[i] += 1;
    total += 1;
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
          <span className="sep" />
          <Link href={href({ mode: "combined" })} className={mode === "combined" ? "on" : undefined}>Combined</Link>
          <Link href={href({ mode: "each" })} className={mode === "each" ? "on" : undefined}>Per recruiter</Link>
        </div>
      </div>

      {total === 0 ? (
        <p style={{ marginTop: 12 }}>No CVs uploaded in this period.</p>
      ) : (
        <>
          <div className="chartwrap">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="xMidYMid meet"
              aria-label={`CV uploads, ${SPANS[span].label.toLowerCase()}, ${mode === "combined" ? "all recruiters combined" : "by recruiter"}`}>
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

          {mode === "each" && (
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
