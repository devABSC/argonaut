"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";

const PATH = "/settings/bou";

async function requireAdmin() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
}

export async function saveBou(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("bouId") ?? "");
  if (!id) return;
  const existing = await prisma.bou.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.bou.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim() || existing.name,
      companyCode: String(formData.get("companyCode") ?? "").trim() || existing.companyCode,
      managerName: String(formData.get("managerName") ?? "").trim() || null,
      managerEmail: String(formData.get("managerEmail") ?? "").trim() || null,
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePath(PATH, "layout");
}

export async function createBou(formData: FormData) {
  await requireAdmin();
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) return;

  if (await prisma.bou.findUnique({ where: { code } })) throw new Error("BOU_CODE_TAKEN");
  const top = await prisma.bou.findFirst({ orderBy: { rowId: "desc" }, select: { rowId: true } });

  await prisma.bou.create({
    data: {
      rowId: (top?.rowId ?? 0) + 1,
      code,
      name,
      companyCode: String(formData.get("companyCode") ?? "").trim(),
      managerName: String(formData.get("managerName") ?? "").trim() || null,
      managerEmail: String(formData.get("managerEmail") ?? "").trim() || null,
    },
  });
  revalidatePath(PATH, "layout");
}

/** Retires a BOU rather than deleting it while employees still point at it. */
export async function toggleBou(bouId: string) {
  await requireAdmin();
  const b = await prisma.bou.findUnique({ where: { id: bouId } });
  if (!b) return;
  await prisma.bou.update({ where: { id: bouId }, data: { isActive: !b.isActive } });
  revalidatePath(PATH, "layout");
}

export async function deleteBou(bouId: string) {
  await requireAdmin();
  const used = await prisma.employee.count({ where: { bouId } });
  if (used > 0) throw new Error(`BOU_IN_USE:${used}`);
  await prisma.bou.delete({ where: { id: bouId } });
  revalidatePath(PATH, "layout");
}
