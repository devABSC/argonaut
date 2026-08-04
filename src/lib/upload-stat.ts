import { prisma } from "./prisma";

/** Manila is a fixed UTC+8, so a local day is a known offset. */
const MNL = 8 * 60 * 60 * 1000;

export const GRAINS = ["day", "week", "month", "quarter", "year"] as const;
export type Grain = (typeof GRAINS)[number];

/** The start of the bucket a moment falls in, at each grain, in Manila time. */
export function bucketFor(at: Date, grain: Grain): Date {
  const l = new Date(+at + MNL);
  const y = l.getUTCFullYear();
  const m = l.getUTCMonth();
  const d = l.getUTCDate();

  switch (grain) {
    case "day":
      return new Date(Date.UTC(y, m, d));
    case "week": {
      // Weeks start Monday.
      const back = (l.getUTCDay() + 6) % 7;
      return new Date(Date.UTC(y, m, d - back));
    }
    case "month":
      return new Date(Date.UTC(y, m, 1));
    case "quarter":
      return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
    case "year":
      return new Date(Date.UTC(y, 0, 1));
  }
}

/**
 * Rebuilds the tallies from the candidates.
 *
 * Run once a day by the scheduler. The chart never counts anything itself: it
 * reads the rows this leaves behind, because a day's total is a fact about the
 * past and recomputing it on every page view can only ever produce the same
 * answer more slowly.
 *
 * A full rebuild rather than an increment, so a missed write, a deleted
 * candidate or a corrected upload date all come right on the next run. It is
 * one scan of two columns — cheap enough to be the simple thing.
 */
export async function rebuildUploadStats(): Promise<{ rows: number; uploads: number }> {
  const cands = await prisma.candidate.findMany({
    where: { cvUploadedAt: { not: null } },
    select: { cvUploadedAt: true, recruiterId: true },
  });

  const tally = new Map<string, { grain: string; bucket: Date; recruiterId: string; count: number }>();
  for (const c of cands) {
    // Empty string, not null: Postgres treats nulls as distinct, so a nullable
    // column could not carry the key this table is built on.
    const recruiterId = c.recruiterId ?? "";
    for (const grain of GRAINS) {
      const bucket = bucketFor(c.cvUploadedAt!, grain);
      const key = `${grain}|${bucket.toISOString()}|${recruiterId}`;
      const seen = tally.get(key);
      if (seen) seen.count += 1;
      else tally.set(key, { grain, bucket, recruiterId, count: 1 });
    }
  }

  const rows = [...tally.values()];
  // Replaced in one transaction, so the chart never reads a half-built table.
  await prisma.$transaction([
    prisma.uploadStat.deleteMany({}),
    ...(rows.length ? [prisma.uploadStat.createMany({ data: rows })] : []),
  ]);

  return { rows: rows.length, uploads: cands.length };
}
