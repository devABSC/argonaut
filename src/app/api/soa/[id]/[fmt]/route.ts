import { NextRequest } from "next/server";

// Both generators need Node, not the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAccess } from "@/lib/guard";
import { loadSoa, soaWorkbook, soaPdf, soaFilename } from "@/lib/soa-doc";

const TYPE = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

/**
 * One statement as a file. Access rides on the SOA tab — anyone who can read
 * the statement on screen can take it away, and anyone who cannot gets a 404
 * rather than a 403, which would confirm the reference exists.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; fmt: string }> }) {
  const { id, fmt } = await ctx.params;
  if (fmt !== "xlsx" && fmt !== "pdf") return new Response("Not found", { status: 404 });

  await requireAccess("finance", "soa");

  const doc = await loadSoa(id);
  if (!doc) return new Response("Not found", { status: 404 });

  const body = fmt === "xlsx" ? await soaWorkbook(doc) : await soaPdf(doc);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": TYPE[fmt],
      "Content-Disposition": `attachment; filename="${soaFilename(doc.soa.ref, fmt)}"`,
      "Content-Length": String(body.length),
      "Cache-Control": "no-store",
    },
  });
}
