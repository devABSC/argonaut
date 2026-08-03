"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const PATH = "/crm/suppliers";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

const FIELDS = [
  "category", "supplies", "contactName", "contactEmail", "phone",
  "website", "address", "city", "country", "tin", "paymentTerms", "notes",
] as const;

const body = (f: FormData) =>
  Object.fromEntries(FIELDS.map((k) => [k, text(f, k)])) as Record<string, string | null>;

export async function createSupplier(formData: FormData) {
  const me = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) done(PATH, "Nothing saved — a supplier needs a name.");

  if (await prisma.supplier.findUnique({ where: { name } })) {
    done(PATH, `${name} is already on the register.`);
  }

  await prisma.supplier.create({ data: { name, ...body(formData), ownerId: me.id } });
  revalidatePath(PATH);
  await logHistory({ type: "create", module: "CRM > Suppliers", description: `Added supplier ${name}`, user: me });
  done(PATH, `${name} added.`);
}

export async function saveSupplier(formData: FormData) {
  const me = await requireUser();

  const id = String(formData.get("supplierId") ?? "");
  if (!id) return;
  const existing = await prisma.supplier.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return;

  await prisma.supplier.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim() || existing.name,
      ...body(formData),
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidatePath(PATH);
  await logHistory({ type: "update", module: "CRM > Suppliers", description: `Saved supplier ${existing.name}`, user: me });
  done(PATH, `${existing.name} saved.`);
}

export async function deleteSupplier(supplierId: string) {
  const me = await requireUser();
  const s = await prisma.supplier.delete({ where: { id: supplierId }, select: { name: true } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "CRM > Suppliers", description: `Deleted supplier ${s.name}`, user: me });
  done(PATH, `${s.name} deleted.`);
}
