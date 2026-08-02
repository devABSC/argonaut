"use server";

import { revalidatePath } from "next/cache";
import type { FieldKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageCatalog } from "@/lib/rbac";

const PATH = "/workflow/service-forms";

function deny(): never {
  throw new Error("FORBIDDEN");
}

async function requireCatalogAdmin() {
  const u = await requireUser();
  if (!canManageCatalog({ id: u.id, role: u.role })) deny();
}

/** Property name used inside ServiceRequest.details. Stable once requests exist. */
function keyFor(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export async function addField(formData: FormData) {
  await requireCatalogAdmin();

  const formTypeId = String(formData.get("formTypeId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const kind = String(formData.get("kind") ?? "TEXT") as FieldKind;
  const required = formData.get("required") === "on";
  const options = String(formData.get("options") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);

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

export async function removeField(fieldId: string) {
  await requireCatalogAdmin();
  await prisma.formField.delete({ where: { id: fieldId } });
  revalidatePath(PATH);
}
