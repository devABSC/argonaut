"use server";

import { revalidatePath } from "next/cache";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import type { RoleKey } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canApproveRegistrations, canManageUser, canAssignRole } from "@/lib/rbac";

/** Thrown rather than returned — a denied action is a bug or an attack, not a form error. */
function deny(): never {
  throw new Error("FORBIDDEN");
}

async function actor() {
  const u = await requireUser();
  return { id: u.id, role: u.role, name: u.name };
}

export async function approveRegistration(userId: string) {
  const me = await actor();
  if (!canApproveRegistrations(me)) deny();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.status !== "PENDING") deny();

  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", approvedAt: new Date(), approvedById: me.id, updatedById: me.id },
  });
  revalidatePath("/settings/users");
  await logHistory({ type: "approve", module: "Settings > Users", description: `Approved registration for ${target.name}`, user: me });
  done("/settings/users", `${target.name} approved — the account is now active.`);
}

export async function rejectRegistration(userId: string) {
  const me = await actor();
  if (!canApproveRegistrations(me)) deny();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.status !== "PENDING") deny();

  await prisma.user.update({
    where: { id: userId },
    data: { status: "REJECTED", approvedById: me.id, updatedById: me.id },
  });
  // Kill any session the account may already hold.
  await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/settings/users");
  await logHistory({ type: "reject", module: "Settings > Users", description: `Rejected registration for ${target.name}`, user: me });
  done("/settings/users", `${target.name}’s registration was rejected.`);
}

export async function setUserRole(userId: string, role: RoleKey) {
  const me = await actor();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { key: true } } },
  });
  if (!target) deny();
  const targetActor = { id: target.id, role: target.role.key as RoleKey };
  if (!canManageUser(me, targetActor)) deny();
  if (!canAssignRole(me, role)) deny();

  // Never let the last Super User be demoted — that would lock everyone out.
  if (target.role.key === "SUPER_USER" && role !== "SUPER_USER") {
    const supers = await prisma.user.count({ where: { role: { key: "SUPER_USER" }, status: "ACTIVE" } });
    if (supers <= 1) throw new Error("LAST_SUPER_USER");
  }

  const roleRow = await prisma.role.findUnique({ where: { key: role }, select: { id: true, isActive: true } });
  if (!roleRow) throw new Error("UNKNOWN_ROLE");
  if (!roleRow.isActive) throw new Error("ROLE_NOT_ASSIGNABLE");

  await prisma.user.update({
    where: { id: userId },
    data: { roleId: roleRow.id, updatedById: me.id },
  });
  revalidatePath("/settings/users");
}

/**
 * Form-driven edit from the Settings -> Users table: applies role and
 * reporting line together. Each field is permission-checked separately.
 */
/**
 * Saves whichever fields the payload actually carries. Each cell on the Users
 * table posts on its own, so a company change must not blank the reporting
 * line simply by not mentioning it.
 */
export async function updateUserFromForm(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");

  const me = await actor();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { key: true } } },
  });
  if (!target) deny();
  if (!canManageUser(me, { id: target.id, role: target.role.key as RoleKey })) deny();

  const changed: string[] = [];

  if (formData.has("role")) {
    const role = String(formData.get("role") ?? "") as RoleKey;
    if (role && role !== target.role.key) { await setUserRole(userId, role); changed.push("role"); }
  }

  if (formData.has("managerId")) {
    const raw = String(formData.get("managerId") ?? "");
    const managerId = raw === "" ? null : raw;
    if (managerId !== target.managerId) { await setUserManager(userId, managerId); changed.push("reporting line"); }
  }

  if (formData.has("company")) {
    const company = String(formData.get("company") ?? "").trim() || null;
    if (company !== target.company) {
      await prisma.user.update({ where: { id: userId }, data: { company, updatedById: me.id } });
      changed.push("company");
    }
  }

  if (!changed.length) return;

  revalidatePath("/settings/users");
  await logHistory({
    type: "update", module: "Settings > Users",
    description: `Updated ${target.name} (${changed.join(", ")})`, user: me,
  });
  done("/settings/users", `${target.name} — ${changed.join(" and ")} saved.`);
}

/** Sets who this user reports to. Pass null to clear the reporting line. */
export async function setUserManager(userId: string, managerId: string | null) {
  const me = await actor();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { key: true } } },
  });
  if (!target) deny();
  if (!canManageUser(me, { id: target.id, role: target.role.key as RoleKey })) deny();
  if (managerId === userId) throw new Error("SELF_MANAGER");

  await prisma.user.update({ where: { id: userId }, data: { managerId, updatedById: me.id } });
  revalidatePath("/settings/users");
}
