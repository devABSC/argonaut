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

  // Only deviations from the code default are stored.
  const desired = new Map<string, boolean>(); // "ROLE|node" -> allowed
  for (const role of ROLES) {
    for (const n of nodes) {
      const checked = formData.get(`m|${role}|${n.key}`) === "on";
      if (checked !== defaultAllows(role, n.key)) desired.set(`${role}|${n.key}`, checked);
    }
  }

  const existing = await prisma.menuGrant.findMany({ where: { role: { not: null } } });

  const staleIds: string[] = [];
  const changed: { id: string; allowed: boolean }[] = [];
  const seen = new Set<string>();

  for (const row of existing) {
    const k = `${row.role}|${row.nodeKey}`;
    seen.add(k);
    const want = desired.get(k);
    if (want === undefined) staleIds.push(row.id);
    else if (want !== row.allowed) changed.push({ id: row.id, allowed: want });
  }

  const fresh = [...desired.entries()]
    .filter(([k]) => !seen.has(k))
    .map(([k, allowed]) => {
      const [role, ...rest] = k.split("|");
      return { role: role as Role, nodeKey: rest.join("|"), allowed };
    });

  // Three statements rather than one per cell: the pooler allows a single
  // connection, so a hundred round trips ran past the function timeout.
  await prisma.$transaction([
    ...(staleIds.length ? [prisma.menuGrant.deleteMany({ where: { id: { in: staleIds } } })] : []),
    ...changed.map((c) => prisma.menuGrant.update({ where: { id: c.id }, data: { allowed: c.allowed } })),
    ...(fresh.length ? [prisma.menuGrant.createMany({ data: fresh })] : []),
  ]);

  revalidatePath(PATH, "layout");
}

export async function saveUserOverrides(userId: string, formData: FormData) {
  await requireOwner();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("NOT_FOUND");

  // Baseline is what the role already grants, without this user's overrides.
  const roleLevel = await effectiveAccess({ id: "__none__", role: target.role });

  const desired = new Map<string, boolean>();
  for (const n of allNodes()) {
    const checked = formData.get(`u|${n.key}`) === "on";
    if (checked !== (roleLevel.get(n.key) ?? false)) desired.set(n.key, checked);
  }

  const existing = await prisma.menuGrant.findMany({ where: { userId } });

  const staleIds: string[] = [];
  const changed: { id: string; allowed: boolean }[] = [];
  const seen = new Set<string>();

  for (const row of existing) {
    seen.add(row.nodeKey);
    const want = desired.get(row.nodeKey);
    if (want === undefined) staleIds.push(row.id);
    else if (want !== row.allowed) changed.push({ id: row.id, allowed: want });
  }

  const fresh = [...desired.entries()]
    .filter(([k]) => !seen.has(k))
    .map(([nodeKey, allowed]) => ({ userId, nodeKey, allowed }));

  await prisma.$transaction([
    ...(staleIds.length ? [prisma.menuGrant.deleteMany({ where: { id: { in: staleIds } } })] : []),
    ...changed.map((c) => prisma.menuGrant.update({ where: { id: c.id }, data: { allowed: c.allowed } })),
    ...(fresh.length ? [prisma.menuGrant.createMany({ data: fresh })] : []),
  ]);

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
