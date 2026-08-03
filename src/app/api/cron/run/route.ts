import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { runCronJob } from "@/lib/cron-actions";
import { isDue } from "@/lib/cron-schedule";

/**
 * The scheduler's doorbell. Whatever calls it — Vercel Cron, an uptime pinger —
 * this decides which jobs are actually due and runs those.
 *
 * Guarded by a shared secret: it sends real email, so it must not be a URL
 * anyone can hit. Vercel sends its own Authorization header; a manual caller
 * can pass ?key= instead.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const header = req.headers.get("authorization") ?? "";
    const key = req.nextUrl.searchParams.get("key") ?? "";
    if (header !== `Bearer ${expected}` && key !== expected) {
      return new Response("Not found", { status: 404 });
    }
  }

  const now = new Date();
  const jobs = await prisma.cronJob.findMany({ where: { isActive: true } });
  const due = jobs.filter((j) => isDue(j, now));

  const results = [];
  for (const j of due) {
    const r = await runCronJob(j.id, false);
    results.push({ job: j.name, ok: r.ok, message: r.message });
  }

  return Response.json({
    at: now.toISOString(),
    considered: jobs.length,
    ran: results.length,
    results,
  });
}
