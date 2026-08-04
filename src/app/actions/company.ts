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
    city: String(f.get("city") ?? "").trim() || null,
    zipCode: String(f.get("zipCode") ?? "").trim() || null,
    pocEmail: String(f.get("pocEmail") ?? "").trim() || null,
  };
}

/** 512 KB of PNG, JPEG or SVG. Big enough for a mark, small enough to inline. */
const LOGO_MAX = 512 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

/**
 * Upload the brand mark shown on statements and other outgoing documents.
 * Stored as a data URL so a rendering document never has to fetch it.
 */
export async function uploadCompanyLogo(companyId: string, formData: FormData) {
  const me = await requireAdmin();
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) done(PATH, "Pick an image file first.");
  const f = file as File;
  if (!LOGO_TYPES.includes(f.type)) done(PATH, "Not saved — use a PNG, JPEG, SVG or WebP image.");
  if (f.size > LOGO_MAX) {
    done(PATH, `Not saved — that file is ${Math.round(f.size / 1024)} KB; the limit is ${LOGO_MAX / 1024} KB.`);
  }

  const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
  const c = await prisma.company.update({
    where: { id: companyId },
    data: { logo: `data:${f.type};base64,${b64}` },
    select: { name: true },
  });

  revalidatePath(PATH);
  revalidatePath("/finance/soa");
  await logHistory({ type: "update", module: "Settings > Company", description: `Set the logo for ${c.name}`, user: me });
  done(PATH, `Logo saved for ${c.name}.`);
}

export async function clearCompanyLogo(companyId: string) {
  const me = await requireAdmin();
  const c = await prisma.company.update({
    where: { id: companyId },
    data: { logo: null },
    select: { name: true },
  });
  revalidatePath(PATH);
  revalidatePath("/finance/soa");
  await logHistory({ type: "update", module: "Settings > Company", description: `Removed the logo for ${c.name}`, user: me });
  done(PATH, `Logo removed for ${c.name}.`);
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
    prisma.employee.count({ where: { company: c.code, status: 0 } }),
  ]);
  if (users + employees > 0) throw new Error("COMPANY_IN_USE");

  await prisma.company.delete({ where: { id: companyId } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Settings > Company", description: `Deleted company ${c.name}`, user: me });
  done(PATH, `Company ${c.name} deleted.`);
}
