"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canApproveRegistrations, canManageUser, canAssignRole } from "@/lib/rbac";

/** Thrown rather than returned — a denied action is a bug or an attack, not a form error. */
function deny(): never {
  throw new Error("FORBIDDEN");
}

async function actor() {
  const u = await requireUser();
  return { id: u.id, role: u.role };
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
}

export async function setUserRole(userId: string, role: Role) {
  const me = await actor();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) deny();
  if (!canManageUser(me, target)) deny();
  if (!canAssignRole(me, role)) deny();

  // Never let the last Super User be demoted — that would lock everyone out.
  if (target.role === "SUPER_USER" && role !== "SUPER_USER") {
    const supers = await prisma.user.count({ where: { role: "SUPER_USER", status: "ACTIVE" } });
    if (supers <= 1) throw new Error("LAST_SUPER_USER");
  }

  await prisma.user.update({ where: { id: userId }, data: { role, updatedById: me.id } });
  revalidatePath("/settings/users");
}

/**
 * Form-driven edit from the Settings -> Users table: applies role and
 * reporting line together. Each field is permission-checked separately.
 */
export async function updateUserFromForm(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const managerRaw = String(formData.get("managerId") ?? "");
  const managerId = managerRaw === "" ? null : managerRaw;

  const me = await actor();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) deny();
  if (!canManageUser(me, target)) deny();

  if (role && role !== target.role) await setUserRole(userId, role);
  if (managerId !== target.managerId) await setUserManager(userId, managerId);

  revalidatePath("/settings/users");
}

/** Sets who this user reports to. Pass null to clear the reporting line. */
export async function setUserManager(userId: string, managerId: string | null) {
  const me = await actor();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) deny();
  if (!canManageUser(me, target)) deny();
  if (managerId === userId) throw new Error("SELF_MANAGER");

  await prisma.user.update({ where: { id: userId }, data: { managerId, updatedById: me.id } });
  revalidatePath("/settings/users");
}
