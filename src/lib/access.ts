import type { RoleKey } from "./roles";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { allNodes, defaultAllows, type Grants } from "./access-policy";

export * from "./access-policy";

/** The grants map as JSON, to sit on the session row. */
export function grantsToJson(g: Grants): Record<string, boolean> {
  return Object.fromEntries(g);
}

/** The grants map back from JSON, dropping anything that is not a node now. */
export function grantsFromJson(v: unknown): Grants | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Grants = new Map();
  for (const n of allNodes()) {
    const stored = (v as Record<string, unknown>)[n.key];
    // A node added since the session was minted is simply absent; falling back
    // to the code default is right, and it never grants more than the code does.
    if (typeof stored === "boolean") out.set(n.key, stored);
  }
  return out.size > 0 ? out : null;
}

/**
 * Effective access for one user: user grants win over role grants, which win
 * over the code default. Returns a lookup keyed by node.
 */
export async function effectiveAccess(user: { id: string; role: RoleKey }): Promise<Grants> {
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
}

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
