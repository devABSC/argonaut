"use server";

import { revalidatePath } from "next/cache";
import type { FieldKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageCatalog } from "@/lib/rbac";
import { STANDARD_SLUG } from "@/lib/forms";

const PATH = "/workflow/service-forms";

function deny(): never {
  throw new Error("FORBIDDEN");
}

async function requireCatalogAdmin() {
  const u = await requireUser();
  if (!canManageCatalog({ id: u.id, role: u.role })) deny();
}

const FIELD_KINDS: FieldKind[] = [
  "TEXT", "TEXTAREA", "NUMBER", "CURRENCY", "DATE", "SELECT", "CHECKBOX", "FILE",
];

/** Returns the kind only if it is a real enum member, else null. */
function parseKind(v: FormDataEntryValue | null): FieldKind | null {
  return typeof v === "string" && (FIELD_KINDS as string[]).includes(v) ? (v as FieldKind) : null;
}

/** Choices may be separated by commas or newlines — both are natural to type. */
function parseChoices(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Property name used inside ServiceRequest.details. Stable once requests exist. */
function keyFor(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export async function createFormType(formData: FormData) {
  await requireCatalogAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug || slug === STANDARD_SLUG) return;

  if (await prisma.formType.findUnique({ where: { slug } })) {
    throw new Error("FORM_NAME_TAKEN");
  }

  await prisma.formType.create({ data: { name, slug } });
  revalidatePath(PATH);
}

export async function deleteFormType(formTypeId: string) {
  await requireCatalogAdmin();
  const used = await prisma.requestSubcategory.count({ where: { formTypeId } });
  if (used > 0) throw new Error("FORM_IN_USE");

  await prisma.formType.delete({ where: { id: formTypeId } });
  revalidatePath(PATH);
}

export async function addField(formData: FormData) {
  await requireCatalogAdmin();

  const formTypeId = String(formData.get("formTypeId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const kind = parseKind(formData.get("kind")) ?? "TEXT";
  const required = formData.get("required") === "on";
  const options = parseChoices(formData.get("options"));

  if (!formTypeId || !label) return;

  const key = keyFor(label);
  if (!key) return;
  if (await prisma.formField.findUnique({ where: { formTypeId_key: { formTypeId, key } } })) {
    throw new Error("DUPLICATE_FIELD");
  }

  const last = await prisma.formField.findFirst({
    where: { formTypeId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.formField.create({
    data: {
      formTypeId,
      key,
      label,
      kind,
      required,
      options: kind === "SELECT" ? options : [],
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(PATH);
}

/**
 * Edits an existing field. `key` is deliberately not editable — it is the
 * property name already stored inside submitted requests' details.
 */
export async function updateField(formData: FormData) {
  await requireCatalogAdmin();

  const id = String(formData.get("fieldId") ?? "");
  if (!id) return;

  const existing = await prisma.formField.findUnique({ where: { id } });
  if (!existing) return;

  const label = String(formData.get("label") ?? "").trim() || existing.label;
  // Fall back to the stored value rather than TEXT: a missing or unrecognised
  // value must never silently reset the field's display type.
  const kind = parseKind(formData.get("kind")) ?? existing.kind;
  const required = formData.get("required") === "on";
  const options = parseChoices(formData.get("options"));

  await prisma.formField.update({
    where: { id },
    data: { label, kind, required, options: kind === "SELECT" ? options : [] },
  });
  revalidatePath(PATH);
}

export async function removeField(fieldId: string) {
  await requireCatalogAdmin();
  await prisma.formField.delete({ where: { id: fieldId } });
  revalidatePath(PATH);
}
