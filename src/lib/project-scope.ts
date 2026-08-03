import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { RoleKey } from "./roles";

/** Who sees every project. Somebody has to create one and add the first member. */
const SEES_ALL: RoleKey[] = ["SUPER_USER", "ADMINISTRATOR"];

/**
 * The `where` that limits projects to the ones this user is on.
 *
 * Enforced in the query, never by hiding rows in the component — a filtered
 * render still ships the data to the client. A user with no employee record
 * has no memberships and so sees nothing, which is the safe direction.
 */
export async function projectScope(user: {
  id: string;
  role: RoleKey;
  email: string;
}): Promise<Prisma.ProjectWhereInput> {
  if (SEES_ALL.includes(user.role)) return {};

  // Users are matched to their HRIS record by email — Employee.userId is not
  // populated.
  const me = await prisma.employee.findFirst({
    where: { emailAdd: { equals: user.email, mode: "insensitive" } },
    select: { id: true },
  });

  return {
    OR: [
      // Projects they own, so a creator never loses sight of their own work.
      { userId: user.id },
      ...(me ? [{ members: { some: { employeeId: me.id } } }] : []),
    ],
  };
}

/** True when this user may open one specific project. */
export async function canSeeProject(
  user: { id: string; role: RoleKey; email: string },
  projectId: string,
): Promise<boolean> {
  const scope = await projectScope(user);
  const found = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    select: { id: true },
  });
  return Boolean(found);
}
