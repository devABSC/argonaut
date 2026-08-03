"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { allNodes, defaultAllows, effectiveAccess } from "@/lib/access";

const PATH = "/settings/rbac";
const ROLES: Role[] = ["SUPER_USER", "ADMINISTRATOR", "HR_SUPERVISOR", "SUPERVISOR", "EMPLOYEE"];

/** Only the owner reassigns access — an admin cannot widen their own reach. */
async function requireOwner() {
  const u = await requireUser();
  if (u.role !== "SUPER_USER") throw new Error("FORBIDDEN");
  return u;
}

/**
 * Saves the role matrix. Only deviations from the code default are stored, so
 * the table stays small and untouched cells keep following the default.
 */
export async function saveRoleMatrix(formData: FormData) {
  await requireOwner();

  const nodes = allNodes();
  const writes: Promise<unknown>[] = [];

  for (const role of ROLES) {
    for (const n of nodes) {
      const checked = formData.get(`m|${role}|${n.key}`) === "on";
      const isDefault = checked === defaultAllows(role, n.key);

      writes.push(
        isDefault
          ? prisma.menuGrant.deleteMany({ where: { nodeKey: n.key, role } })
          : prisma.menuGrant.upsert({
              where: { nodeKey_role: { nodeKey: n.key, role } },
              update: { allowed: checked },
              create: { nodeKey: n.key, role, allowed: checked },
            }),
      );
    }
  }

  await Promise.all(writes);
  revalidatePath(PATH, "layout");
}

/**
 * Saves per-user overrides. The baseline is what the user's role already gives
 * them, so an override is only stored where the owner differs from it.
 */
export async function saveUserOverrides(userId: string, formData: FormData) {
  await requireOwner();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("NOT_FOUND");

  // Baseline without this user's own overrides.
  const roleLevel = await effectiveAccess({ id: "__none__", role: target.role });

  const writes: Promise<unknown>[] = [];
  for (const n of allNodes()) {
    const checked = formData.get(`u|${n.key}`) === "on";
    const matchesRole = checked === (roleLevel.get(n.key) ?? false);

    writes.push(
      matchesRole
        ? prisma.menuGrant.deleteMany({ where: { nodeKey: n.key, userId } })
        : prisma.menuGrant.upsert({
            where: { nodeKey_userId: { nodeKey: n.key, userId } },
            update: { allowed: checked },
            create: { nodeKey: n.key, userId, allowed: checked },
          }),
    );
  }

  await Promise.all(writes);
  revalidatePath(PATH, "layout");
}

/** Drops every override for a user, returning them to plain role access. */
export async function clearUserOverrides(userId: string) {
  await requireOwner();
  await prisma.menuGrant.deleteMany({ where: { userId } });
  revalidatePath(PATH, "layout");
}

/** Discards the whole matrix, restoring the defaults defined in code. */
export async function resetToDefaults() {
  await requireOwner();
  await prisma.menuGrant.deleteMany({});
  revalidatePath(PATH, "layout");
}
