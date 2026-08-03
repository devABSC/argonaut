import { prisma } from "./prisma";

/**
 * The BOU an account's person belongs to.
 *
 * Accounts are not employees — the link is optional and not every account has
 * one — so this falls back to matching the work address before giving up. Two
 * small reads at most, and a null answer is a fine answer.
 */
async function bouOf(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, employee: { select: { bou: { select: { name: true } } } } },
  });
  if (!u) return null;
  if (u.employee) return u.employee.bou?.name ?? null;

  const byEmail = await prisma.employee.findFirst({
    where: { emailAdd: { equals: u.email, mode: "insensitive" } },
    select: { bou: { select: { name: true } } },
  });
  return byEmail?.bou?.name ?? null;
}

/**
 * Record a transaction in the audit Log History. Never throws — logging must
 * not break the action it is recording.
 */
export async function logHistory(input: {
  type: string;
  module: string;
  description: string;
  user?: { id: string; name: string } | null;
}): Promise<void> {
  try {
    await prisma.logHistory.create({
      data: {
        type: input.type,
        module: input.module,
        description: input.description,
        createdById: input.user?.id ?? null,
        createdByName: input.user?.name || "System",
        // Snapshotted with the name: an entry records which BOU acted at the
        // time, not which BOU that person sits in today.
        createdByBou: input.user?.id ? await bouOf(input.user.id) : null,
      },
    });
  } catch {
    /* audit logging is best-effort */
  }
}
