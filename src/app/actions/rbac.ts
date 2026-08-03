"use server";

import { revalidatePath } from "next/cache";
import { type RoleKey } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { allNodes, defaultAllows, effectiveAccess } from "@/lib/access";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const PATH = "/settings/rbac";


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
  const roleRows = await prisma.role.findMany({ select: { id: true, key: true } });
  const ROLES = roleRows.map((r) => r.key as RoleKey);

  // Only deviations from the code default are stored.
  const desired = new Map<string, boolean>(); // "ROLE|node" -> allowed
  for (const role of ROLES) {
    for (const n of nodes) {
      const checked = formData.get(`m|${role}|${n.key}`) === "on";
      if (checked !== defaultAllows(role, n.key)) desired.set(`${role}|${n.key}`, checked);
    }
  }

  const idByKey = new Map(roleRows.map((r) => [r.key, r.id]));

  const existing = await prisma.menuGrant.findMany({
    where: { roleId: { not: null } },
    include: { role: { select: { key: true } } },
  });

  const staleIds: string[] = [];
  const changed: { id: string; allowed: boolean }[] = [];
  const seen = new Set<string>();

  for (const row of existing) {
    const k = `${row.role?.key}|${row.nodeKey}`;
    seen.add(k);
    const want = desired.get(k);
    if (want === undefined) staleIds.push(row.id);
    else if (want !== row.allowed) changed.push({ id: row.id, allowed: want });
  }

  const fresh = [...desired.entries()]
    .filter(([k]) => !seen.has(k) && idByKey.has(k.split("|")[0]))
    .map(([k, allowed]) => {
      const [role, ...rest] = k.split("|");
      return { roleId: idByKey.get(role)!, nodeKey: rest.join("|"), allowed };
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

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { key: true } } },
  });
  if (!target) throw new Error("NOT_FOUND");

  // Baseline is what the role already grants, without this user's overrides.
  const roleLevel = await effectiveAccess({ id: "__none__", role: target.role.key as RoleKey });

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

/**
 * Which BOUs a user may see records for. Only active BOUs are offered, so a
 * retired one is left unassigned rather than quietly carried forward.
 * No rows at all means unscoped — they see everything their pages allow.
 */
export async function saveBouAccess(userId: string, formData: FormData) {
  const me = await requireOwner();

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!target) return;

  const active = await prisma.bou.findMany({ where: { isActive: true }, select: { id: true } });
  const allowed = new Set(active.map((b) => b.id));
  const picked = formData.getAll("bou").map(String).filter((id) => allowed.has(id));

  await prisma.$transaction([
    // Replace wholesale: unticking is as meaningful as ticking, and a diff
    // would leave grants for BOUs that have since been retired.
    prisma.bouAccess.deleteMany({ where: { userId } }),
    ...(picked.length
      ? [prisma.bouAccess.createMany({ data: picked.map((bouId) => ({ userId, bouId })) })]
      : []),
  ]);

  revalidatePath("/settings/rbac");
  await logHistory({
    type: "update", module: "Settings > RBAC",
    description: picked.length
      ? `${target.name} scoped to ${picked.length} BOU(s)`
      : `${target.name} unscoped — all BOUs`,
    user: me,
  });
  done(
    `/settings/rbac?view=person&u=${userId}`,
    picked.length
      ? `${target.name} can now see ${picked.length} BOU${picked.length === 1 ? "" : "s"}.`
      : `${target.name} is unscoped — every BOU their pages allow.`,
  );
}
