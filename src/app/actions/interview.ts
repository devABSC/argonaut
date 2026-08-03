"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * The candidate's side. No sign-in — the token in the URL is the only
 * credential, so every function here re-checks it and nothing takes an id from
 * the form.
 */

export type InviteState = { error?: string; ok?: boolean };

/** A live invite, or null. Expiry, revocation and re-submission all count. */
export async function openInvite(token: string) {
  if (!token || token.length < 20) return null;

  const invite = await prisma.candidateInvite.findUnique({
    where: { token },
    include: {
      candidate: {
        select: {
          firstName: true, lastName: true, position: true,
          // Only the questions. Never the assessment, the risks, or a remark.
          verifyItems: {
            where: { kind: "question" },
            orderBy: { createdAt: "asc" },
            select: { id: true, item: true, candidateAnswer: true },
          },
        },
      },
    },
  });
  if (!invite) return null;
  if (invite.revokedAt) return { ...invite, state: "revoked" as const };
  if (invite.submittedAt) return { ...invite, state: "submitted" as const };
  if (invite.expiresAt < new Date()) return { ...invite, state: "expired" as const };

  if (!invite.openedAt) {
    await prisma.candidateInvite.update({ where: { id: invite.id }, data: { openedAt: new Date() } });
  }
  return { ...invite, state: "open" as const };
}

export async function submitAnswers(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const token = String(formData.get("token") ?? "");
  const invite = await prisma.candidateInvite.findUnique({
    where: { token },
    select: { id: true, candidateId: true, revokedAt: true, submittedAt: true, expiresAt: true },
  });

  if (!invite) return { error: "That link is not valid." };
  if (invite.revokedAt) return { error: "That link has been withdrawn." };
  if (invite.submittedAt) return { error: "Your answers have already been received." };
  if (invite.expiresAt < new Date()) return { error: "That link has expired. Ask your recruiter for a new one." };

  const questions = await prisma.verifyItem.findMany({
    where: { candidateId: invite.candidateId, kind: "question" },
    select: { id: true },
  });

  const now = new Date();
  const writes = questions.map((q) => {
    const answer = String(formData.get(`a_${q.id}`) ?? "").trim();
    return prisma.verifyItem.update({
      where: { id: q.id },
      // Only the candidate's own field is touched — a submission can never
      // reach the recruiter's or the hiring manager's remarks.
      data: { candidateAnswer: answer || null, answeredAt: answer ? now : null },
    });
  });

  await prisma.$transaction([
    ...writes,
    prisma.candidateInvite.update({ where: { id: invite.id }, data: { submittedAt: now } }),
    prisma.logHistory.create({
      data: {
        type: "update", module: "Recruitment > Interview link",
        description: `A candidate submitted ${questions.length} answers`,
        createdByName: "Candidate",
      },
    }),
  ]);

  revalidatePath(`/recruitment/candidate/${invite.candidateId}/assessment`);
  return { ok: true };
}
