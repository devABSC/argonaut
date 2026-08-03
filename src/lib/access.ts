import type { RoleKey } from "./roles";
import { prisma } from "./prisma";
import { allNodes, defaultAllows, type Grants } from "./access-policy";

export * from "./access-policy";

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
