import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/guard";

/** The blank form itself. Access rides on the BIR Forms page. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await requireAccess("finance", "bir-forms");

  const f = await prisma.birForm.findUnique({
    where: { id },
    select: { fileData: true, fileMime: true, fileName: true, code: true },
  });
  if (!f?.fileData) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(f.fileData), {
    headers: {
      "Content-Type": f.fileMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(f.fileName ?? `BIR-${f.code}`).replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
