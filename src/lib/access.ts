import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { allNodes, defaultAllows, type Grants } from "./access-policy";

export * from "./access-policy";

/**
 * Effective access for one user: user grants win over role grants, which win
 * over the code default. Returns a lookup keyed by node.
 */
export async function effectiveAccess(user: { id: string; role: Role }): Promise<Grants> {
  const rows = await prisma.menuGrant.findMany({
    where: { OR: [{ role: user.role }, { userId: user.id }] },
  });

  const byRole = new Map<string, boolean>();
  const byUser = new Map<string, boolean>();
  for (const r of rows) {
    if (r.userId === user.id) byUser.set(r.nodeKey, r.allowed);
    else if (r.role === user.role) byRole.set(r.nodeKey, r.allowed);
  }

  const out: Grants = new Map();
  for (const n of allNodes()) {
    out.set(n.key, byUser.get(n.key) ?? byRole.get(n.key) ?? defaultAllows(user.role, n.key));
  }
  return out;
}
