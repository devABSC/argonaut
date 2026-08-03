"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const STOCK = "/inventory/stock";
const IN = "/inventory/receiving";
const OUT = "/inventory/issuance";

async function requireStockUser() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
  return u;
}

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Whole units only — you cannot receive two thirds of a box. */
function qty(f: FormData): number {
  const n = Math.floor(Number(text(f, "quantity")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function addInvItem(formData: FormData) {
  const me = await requireStockUser();

  const sku = text(formData, "sku").toUpperCase();
  const name = text(formData, "name");
  if (!sku || !name) done(STOCK, "Not added — an item needs a code and a name.");

  if (await prisma.invItem.findUnique({ where: { sku }, select: { id: true } })) {
    done(STOCK, `Not added — ${sku} is already in the list.`);
  }

  const cost = Number(text(formData, "unitCost").replace(/[₱,\s]/g, ""));
  const low = Math.floor(Number(text(formData, "lowStockAt")));

  await prisma.invItem.create({
    data: {
      sku,
      name,
      unit: text(formData, "unit") || "pc",
      lowStockAt: Number.isFinite(low) && low >= 0 ? low : 5,
      unitCost: Number.isFinite(cost) && cost > 0 ? cost : null,
      supplierId: text(formData, "supplierId") || null,
    },
  });

  revalidatePath(STOCK);
  await logHistory({ type: "create", module: "Inventory > Stock", description: `Added item ${sku} ${name}`, user: me });
  done(STOCK, `${sku} — ${name} added.`);
}

export async function deleteInvItem(id: string) {
  const me = await requireStockUser();
  const item = await prisma.invItem.findUnique({
    where: { id },
    select: { sku: true, name: true, _count: { select: { movements: true } } },
  });
  if (!item) return;

  // The movements are the record of what happened; removing the item would
  // take them with it.
  if (item._count.movements > 0) {
    done(STOCK, `${item.sku} was not deleted — it has ${item._count.movements} movement${item._count.movements === 1 ? "" : "s"} against it.`);
  }

  await prisma.invItem.delete({ where: { id } });
  revalidatePath(STOCK);
  await logHistory({ type: "delete", module: "Inventory > Stock", description: `Removed item ${item.sku}`, user: me });
  done(STOCK, `${item.sku} removed.`);
}

/** Stock in. The movement and the running total are written together. */
export async function recordReceiving(formData: FormData) {
  const me = await requireStockUser();

  const itemId = text(formData, "itemId");
  const quantity = qty(formData);
  if (!itemId) done(IN, "Not recorded — pick an item.");
  if (quantity <= 0) done(IN, "Not recorded — the quantity must be a whole number above nothing.");

  const item = await prisma.invItem.findUnique({ where: { id: itemId }, select: { sku: true, name: true, unit: true } });
  if (!item) done(IN, "Not recorded — that item no longer exists.");

  await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        type: "RECEIVING", itemId, quantity,
        reference: text(formData, "reference"),
        note: text(formData, "note"),
        createdById: me.id, createdByName: me.name,
      },
    }),
    prisma.invItem.update({ where: { id: itemId }, data: { stock: { increment: quantity } } }),
  ]);

  revalidatePath(IN);
  revalidatePath(STOCK);
  await logHistory({ type: "create", module: "Inventory > Receiving", description: `Received ${quantity} ${item!.unit} of ${item!.sku}`, user: me });
  done(IN, `Received ${quantity} ${item!.unit} of ${item!.name}.`);
}

/** Stock out. Refuses to take more than is on hand. */
export async function recordIssuance(formData: FormData) {
  const me = await requireStockUser();

  const itemId = text(formData, "itemId");
  const quantity = qty(formData);
  if (!itemId) done(OUT, "Not recorded — pick an item.");
  if (quantity <= 0) done(OUT, "Not recorded — the quantity must be a whole number above nothing.");

  const item = await prisma.invItem.findUnique({
    where: { id: itemId },
    select: { sku: true, name: true, unit: true, stock: true, lowStockAt: true },
  });
  if (!item) done(OUT, "Not recorded — that item no longer exists.");
  if (quantity > item!.stock) {
    done(OUT, `Not recorded — only ${item!.stock} ${item!.unit} of ${item!.sku} on hand.`);
  }

  await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        type: "ISSUANCE", itemId, quantity,
        reference: text(formData, "reference"),
        assignedTo: text(formData, "assignedTo"),
        note: text(formData, "note"),
        createdById: me.id, createdByName: me.name,
      },
    }),
    prisma.invItem.update({ where: { id: itemId }, data: { stock: { decrement: quantity } } }),
  ]);

  const left = item!.stock - quantity;
  revalidatePath(OUT);
  revalidatePath(STOCK);
  await logHistory({ type: "create", module: "Inventory > Issuance", description: `Issued ${quantity} ${item!.unit} of ${item!.sku}`, user: me });
  done(
    OUT,
    `Issued ${quantity} ${item!.unit} of ${item!.name}. ${left} left` +
      (left <= item!.lowStockAt ? " — that is at or below the low mark." : "."),
  );
}
