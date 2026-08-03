import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/guard";

/** Serves a stored pre-employment document. Gated like the page it came from. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await requireAccess("recruitment", "candidates");

  const d = await prisma.preJoDoc.findUnique({
    where: { id },
    select: { fileData: true, fileName: true, fileMime: true },
  });
  if (!d?.fileData) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(d.fileData), {
    headers: {
      "Content-Type": d.fileMime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${(d.fileName ?? "document").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
