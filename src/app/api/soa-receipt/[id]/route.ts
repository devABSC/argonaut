import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/guard";
import { soaViewer, canUseSoa } from "@/lib/soa-scope";

/**
 * The receipt attached to one statement line.
 *
 * Access rides on the statement it belongs to: Finance sees every receipt, and
 * everyone else sees only their own. A receipt on someone else's statement is
 * not found rather than forbidden — a 403 would confirm it exists.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { user } = await requireAccess("finance", "soa");

  const line = await prisma.soaLine.findUnique({
    where: { id },
    select: {
      receiptData: true,
      receiptMime: true,
      receiptName: true,
      soa: { select: { employeeId: true } },
    },
  });
  if (!line?.receiptData) return new Response("Not found", { status: 404 });

  const v = await soaViewer({ id: user.id, role: user.role, email: user.email });
  if (!canUseSoa(v, line.soa)) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(line.receiptData), {
    headers: {
      "Content-Type": line.receiptMime ?? "application/octet-stream",
      // Shown in the viewer rather than pushed at the browser as a download.
      "Content-Disposition": `inline; filename="${(line.receiptName ?? "receipt").replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
