import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

/** How many previous passwords are remembered and refused. */
export const HISTORY_DEPTH = 10;

/** True when this password has been used on the account before. */
export async function isReused(userId: string, plain: string, currentHash?: string): Promise<boolean> {
  if (currentHash && (await bcrypt.compare(plain, currentHash))) return true;

  const past = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_DEPTH,
    select: { hash: true },
  });

  for (const p of past) {
    if (await bcrypt.compare(plain, p.hash)) return true;
  }
  return false;
}

/** Files the outgoing password so it cannot be brought back later. */
export async function rememberPassword(userId: string, hash: string): Promise<void> {
  await prisma.passwordHistory.create({ data: { userId, hash } });

  // Keep the list bounded; anything older than the depth is of no use.
  const old = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: HISTORY_DEPTH,
    select: { id: true },
  });
  if (old.length) {
    await prisma.passwordHistory.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }
}
