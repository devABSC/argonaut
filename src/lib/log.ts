import { prisma } from "./prisma";

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
      },
    });
  } catch {
    /* audit logging is best-effort */
  }
}
