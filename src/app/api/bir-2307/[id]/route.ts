import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAccess } from "@/lib/guard";
import { fill2307 } from "@/lib/bir2307-fill";

/** One certificate, written into the blank form and handed over. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await requireAccess("finance", "bir-2307");

  const out = await fill2307(id);
  if (!out) return new Response("Not found — the 2307 blank has not been uploaded yet.", { status: 404 });

  return new Response(new Uint8Array(out.buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${out.name}"`,
      "Cache-Control": "no-store",
    },
  });
}
