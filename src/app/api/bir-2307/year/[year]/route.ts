import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAccess } from "@/lib/guard";
import { fill2307Year } from "@/lib/bir2307-fill";

/** Every certificate raised in one year, as one workbook. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ year: string }> }) {
  const { year } = await ctx.params;
  await requireAccess("finance", "bir-2307");

  const n = Number(year);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) return new Response("Not found", { status: 404 });

  const out = await fill2307Year(n);
  if (!out) return new Response("Nothing to build — no certificates that year, or no blank uploaded.", { status: 404 });

  return new Response(new Uint8Array(out.buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${out.name}"`,
      "Cache-Control": "no-store",
    },
  });
}
