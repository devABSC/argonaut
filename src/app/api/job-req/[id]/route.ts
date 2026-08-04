import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/guard";

/** The job description as filed. Access rides on the Jobs page. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await requireAccess("recruitment", "jobs");

  const j = await prisma.jobReq.findUnique({
    where: { id },
    select: { fileData: true, fileMime: true, fileName: true, title: true },
  });
  if (!j?.fileData) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(j.fileData), {
    headers: {
      "Content-Type": j.fileMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(j.fileName ?? j.title).replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
