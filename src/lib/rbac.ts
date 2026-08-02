// Argonaut — role-based access control. Single source of truth for "who can do what".
// Server actions and page queries both consult this; never re-derive rules inline.
import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_USER: "Super User",
  ADMINISTRATOR: "Administrator",
  HR_SUPERVISOR: "HR Supervisor",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Employee",
};

// Higher rank outranks lower. Used for "can act on" checks, not for granting
// permissions implicitly — each capability below is spelled out.
const RANK: Record<Role, number> = {
  SUPER_USER: 5,
  ADMINISTRATOR: 4,
  HR_SUPERVISOR: 3,
  SUPERVISOR: 2,
  EMPLOYEE: 1,
};

export type Actor = { id: string; role: Role };
type Target = { id: string; role: Role };

export function outranks(actor: Actor, target: Target): boolean {
  return RANK[actor.role] > RANK[target.role];
}

/* ---------------------------------------------------------------- users --- */

/** Can reach the user-management area at all. */
export function canManageUsers(actor: Actor): boolean {
  return actor.role === "SUPER_USER" || actor.role === "ADMINISTRATOR";
}

/**
 * Can modify this particular user. Admins may only act on people below
 * Administrator, so one Admin can't demote or deactivate another (or itself).
 */
export function canManageUser(actor: Actor, target: Target): boolean {
  if (!canManageUsers(actor)) return false;
  if (actor.role === "SUPER_USER") return true;
  return RANK[target.role] < RANK.ADMINISTRATOR;
}

/** Can grant this specific role. Only a Super User can mint Admins or Super Users. */
export function canAssignRole(actor: Actor, role: Role): boolean {
  if (actor.role === "SUPER_USER") return true;
  if (actor.role === "ADMINISTRATOR") return RANK[role] < RANK.ADMINISTRATOR;
  return false;
}

/** Roles this actor is allowed to pick from in the UI. */
export function assignableRoles(actor: Actor): Role[] {
  return (Object.keys(RANK) as Role[])
    .filter((r) => canAssignRole(actor, r))
    .sort((a, b) => RANK[b] - RANK[a]);
}

/* ------------------------------------------------------- registrations --- */

/** Can approve or reject a self-registered PENDING account. */
export function canApproveRegistrations(actor: Actor): boolean {
  return actor.role === "SUPER_USER" || actor.role === "HR_SUPERVISOR";
}

/* ------------------------------------------------------------- projects --- */

export function canViewAllProjects(actor: Actor): boolean {
  return actor.role === "SUPER_USER" || actor.role === "ADMINISTRATOR";
}

export function canDeleteAnyProject(actor: Actor): boolean {
  return actor.role === "SUPER_USER";
}

/**
 * Prisma `where` fragment limiting projects to what this actor may see:
 * Employee → own; Supervisor → own + direct reports'; Admin/Super → all.
 */
export function projectScope(actor: Actor): Prisma.ProjectWhereInput {
  if (canViewAllProjects(actor)) return {};
  if (supervises(actor)) {
    return { OR: [{ userId: actor.id }, { user: { managerId: actor.id } }] };
  }
  return { userId: actor.id };
}

/** Both supervisor roles hold a reporting line; HR additionally approves registrations. */
export function supervises(actor: Actor): boolean {
  return actor.role === "SUPERVISOR" || actor.role === "HR_SUPERVISOR";
}

/** Whether the actor may edit/delete a project owned by `ownerId`. */
export async function canEditProject(
  actor: Actor,
  ownerId: string,
  isDirectReport: (userId: string) => Promise<boolean>,
): Promise<boolean> {
  if (canViewAllProjects(actor)) return true;
  if (ownerId === actor.id) return true;
  if (supervises(actor)) return isDirectReport(ownerId);
  return false;
}
