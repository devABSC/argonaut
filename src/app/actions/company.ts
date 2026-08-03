"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { canManageUsers } from "@/lib/rbac";

const PATH = "/settings/company";

async function requireAdmin() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
  return u;
}

function readRow(f: FormData) {
  return {
    code: String(f.get("code") ?? "").trim(),
    name: String(f.get("name") ?? "").trim(),
    tin: String(f.get("tin") ?? "").trim() || null,
    address: String(f.get("address") ?? "").trim() || null,
    pocEmail: String(f.get("pocEmail") ?? "").trim() || null,
  };
}

export async function createCompany(formData: FormData) {
  const me = await requireAdmin();
  const r = readRow(formData);
  if (!r.code || !r.name) return;

  if (await prisma.company.findUnique({ where: { code: r.code } })) {
    throw new Error("COMPANY_CODE_TAKEN");
  }
  await prisma.company.create({ data: r });
  revalidatePath(PATH);
  await logHistory({ type: "create", module: "Settings > Company", description: `Registered company ${r.name} (${r.code})`, user: me });
  done(PATH, `Company ${r.name} registered.`);
}

export async function updateCompany(formData: FormData) {
  const me = await requireAdmin();
  const id = String(formData.get("companyId") ?? "");
  if (!id) return;

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) return;

  const r = readRow(formData);
  await prisma.company.update({
    where: { id },
    data: { ...r, code: r.code || existing.code, name: r.name || existing.name },
  });
  revalidatePath(PATH);
  await logHistory({ type: "update", module: "Settings > Company", description: `Saved company ${r.name || existing.name}`, user: me });
  done(PATH, `Company ${r.name || existing.name} saved.`);
}

export async function deleteCompany(companyId: string) {
  const me = await requireAdmin();
  const c = await prisma.company.findUnique({ where: { id: companyId } });
  if (!c) return;

  // Refuse while anyone still points at the code.
  const [users, employees] = await Promise.all([
    prisma.user.count({ where: { company: c.code } }),
    prisma.employee.count({ where: { company: c.code } }),
  ]);
  if (users + employees > 0) throw new Error("COMPANY_IN_USE");

  await prisma.company.delete({ where: { id: companyId } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Settings > Company", description: `Deleted company ${c.name}`, user: me });
  done(PATH, `Company ${c.name} deleted.`);
}
