import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/guard";
import { canSeeCandidate } from "@/lib/candidate-scope";

/** Serves a stored CV. Gated the same way the Candidates page is. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { user } = await requireAccess("recruitment", "candidates");

  const c = await prisma.candidate.findUnique({
    where: { id },
    select: { cvData: true, cvFileName: true, cvMime: true, recruiterId: true },
  });
  if (!c?.cvData || !canSeeCandidate(user, c)) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(c.cvData), {
    headers: {
      "Content-Type": c.cvMime || "application/octet-stream",
      // inline so a PDF opens in the browser rather than downloading
      "Content-Disposition": `inline; filename="${(c.cvFileName ?? "cv").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
