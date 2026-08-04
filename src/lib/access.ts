import type { RoleKey } from "./roles";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { prisma } from "./prisma";
import { allNodes, defaultAllows, type Grants } from "./access-policy";

export * from "./access-policy";

/** The grants map as JSON, to sit on the session row. */
export function grantsToJson(g: Grants): Record<string, boolean> {
  return Object.fromEntries(g);
}

/**
 * The grants map back from the copy on the session.
 *
 * A page added since someone signed in is not in their snapshot. That must
 * mean "ask the code", not "denied" — otherwise a new page is invisible to
 * everyone already signed in, which is how it first went wrong.
 *
 * Returns null when the snapshot is missing nodes, so the caller resolves
 * properly and stores a complete one.
 */
export function grantsFromJson(v: unknown, role?: RoleKey): Grants | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;

  const stored = v as Record<string, unknown>;
  const out: Grants = new Map();
  let missing = false;

  for (const n of allNodes()) {
    const val = stored[n.key];
    if (typeof val === "boolean") {
      out.set(n.key, val);
    } else {
      missing = true;
      // Never deny on absence alone.
      if (role) out.set(n.key, defaultAllows(role, n.key));
    }
  }

  // Out of date: usable for this request, but the caller should replace it.
  if (missing && !role) return null;
  return out.size > 0 ? out : null;
}

/** Whether a stored copy still covers every node the code declares. */
export function grantsAreStale(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return true;
  const stored = v as Record<string, unknown>;
  return allNodes().some((n) => typeof stored[n.key] !== "boolean");
}

/**
 * Effective access for one user: user grants win over role grants, which win
 * over the code default. Returns a lookup keyed by node.
 */
export const effectiveAccess = cache(async (user: { id: string; role: RoleKey }): Promise<Grants> => {
  const rows = await prisma.menuGrant.findMany({
    where: { OR: [{ role: { key: user.role } }, { userId: user.id }] },
    include: { role: { select: { key: true } } },
  });

  const byRole = new Map<string, boolean>();
  const byUser = new Map<string, boolean>();
  for (const r of rows) {
    if (r.userId === user.id) byUser.set(r.nodeKey, r.allowed);
    else if (r.role?.key === user.role) byRole.set(r.nodeKey, r.allowed);
  }

  const out: Grants = new Map();
  for (const n of allNodes()) {
    out.set(n.key, byUser.get(n.key) ?? byRole.get(n.key) ?? defaultAllows(user.role, n.key));
  }
  return out;
});

/**
 * Drops the copy of access every session is carrying.
 *
 * Called whenever RBAC changes, so a permission taken away takes effect on the
 * next request rather than waiting for people to sign in again. The next page
 * each of them opens resolves it once and stores it back.
 */
export async function clearSessionAccess(): Promise<void> {
  // Prisma.DbNull writes a real SQL NULL; a bare null would mean "leave it".
  await prisma.session.updateMany({ data: { access: Prisma.DbNull, accessAt: null } });
}
