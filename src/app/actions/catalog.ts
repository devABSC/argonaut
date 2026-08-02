"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageCatalog } from "@/lib/rbac";

function deny(): never {
  throw new Error("FORBIDDEN");
}

async function requireCatalogAdmin() {
  const u = await requireUser();
  if (!canManageCatalog({ id: u.id, role: u.role })) deny();
  return u;
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const PATH = "/workflow/service-type";

export async function createCategory(formData: FormData) {
  await requireCatalogAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // Codes are sequential and become part of every ticket reference, so they
  // are allocated once and never reused.
  const last = await prisma.requestCategory.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });

  await prisma.requestCategory.create({
    data: { name, slug: slugify(name), code: (last?.code ?? 0) + 1 },
  });
  revalidatePath(PATH);
}

export async function createSubcategory(formData: FormData) {
  await requireCatalogAdmin();
  const categoryId = String(formData.get("categoryId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!categoryId || !name) return;

  const slug = slugify(name);

  // Each subcategory gets its own form to fill in later. Names are unique on
  // FormType, so disambiguate with the category slug if one already exists.
  const existing = await prisma.formType.findUnique({ where: { slug } });
  const form = await prisma.formType.create({
    data: existing ? { name: `${name} (${slug})`, slug: `${slug}-${Date.now()}` } : { name, slug },
  });

  const lastSub = await prisma.requestSubcategory.findFirst({
    where: { categoryId },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  await prisma.requestSubcategory.create({
    data: { categoryId, name, slug, formTypeId: form.id, code: (lastSub?.code ?? 0) + 1 },
  });
  revalidatePath(PATH);
}

export async function addApprover(formData: FormData) {
  await requireCatalogAdmin();
  const subcategoryId = String(formData.get("subcategoryId") ?? "");
  const approverId = String(formData.get("approverId") ?? "");
  if (!subcategoryId || !approverId) return;

  const last = await prisma.workflowApprover.findFirst({
    where: { subcategoryId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  await prisma.workflowApprover.create({
    data: { subcategoryId, approverId, sequence: (last?.sequence ?? 0) + 1 },
  });
  revalidatePath(PATH);
}

export async function removeApprover(approverRowId: string) {
  await requireCatalogAdmin();
  const row = await prisma.workflowApprover.findUnique({ where: { id: approverRowId } });
  if (!row) return;

  await prisma.workflowApprover.delete({ where: { id: approverRowId } });
  // Close the gap so sequences stay 1..n and the chain has no holes.
  const rest = await prisma.workflowApprover.findMany({
    where: { subcategoryId: row.subcategoryId },
    orderBy: { sequence: "asc" },
  });
  await prisma.$transaction(
    rest.map((r, i) =>
      prisma.workflowApprover.update({ where: { id: r.id }, data: { sequence: i + 1 } }),
    ),
  );
  revalidatePath(PATH);
}

export async function deleteSubcategory(subcategoryId: string) {
  await requireCatalogAdmin();
  const used = await prisma.serviceRequest.count({ where: { subcategoryId } });
  if (used > 0) throw new Error("SUBCATEGORY_IN_USE");

  await prisma.requestSubcategory.delete({ where: { id: subcategoryId } });
  revalidatePath(PATH);
}

export async function deleteCategory(categoryId: string) {
  await requireCatalogAdmin();
  const subs = await prisma.requestSubcategory.count({ where: { categoryId } });
  if (subs > 0) throw new Error("CATEGORY_NOT_EMPTY");

  await prisma.requestCategory.delete({ where: { id: categoryId } });
  revalidatePath(PATH);
}
