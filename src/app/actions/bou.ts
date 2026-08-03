"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { canManageUsers } from "@/lib/rbac";

const PATH = "/settings/bou";

async function requireAdmin() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
  return u;
}

export async function saveBou(formData: FormData) {
  const me = await requireAdmin();
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
  await logHistory({ type: "update", module: "Settings > BOU", description: `Saved BOU ${existing.code}`, user: me });
  done(PATH, `BOU ${existing.code} saved.`);
}

export async function createBou(formData: FormData) {
  const me = await requireAdmin();
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
  await logHistory({ type: "create", module: "Settings > BOU", description: `Added BOU ${code} (${name})`, user: me });
  done(PATH, `BOU ${name} added.`);
}

/** Retires a BOU rather than deleting it while employees still point at it. */
export async function toggleBou(bouId: string) {
  const me = await requireAdmin();
  const b = await prisma.bou.findUnique({ where: { id: bouId } });
  if (!b) return;
  await prisma.bou.update({ where: { id: bouId }, data: { isActive: !b.isActive } });
  revalidatePath(PATH, "layout");
  await logHistory({ type: "update", module: "Settings > BOU", description: `${b.isActive ? "Deactivated" : "Activated"} BOU ${b.name}`, user: me });
  done(PATH, `${b.name} is now ${b.isActive ? "inactive" : "active"}.`);
}

export async function deleteBou(bouId: string) {
  const me = await requireAdmin();
  const used = await prisma.employee.count({ where: { bouId } });
  if (used > 0) throw new Error(`BOU_IN_USE:${used}`);
  await prisma.bou.delete({ where: { id: bouId } });
  revalidatePath(PATH, "layout");
  await logHistory({ type: "delete", module: "Settings > BOU", description: "Deleted a BOU", user: me });
  done(PATH, "BOU deleted.");
}
