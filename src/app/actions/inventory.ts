"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const STOCK = "/inventory/stock";
const MASTER = "/inventory/item-master";
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
  const me = await requireUser();
  // Benta's rule, kept: a permanent delete of master data is the owner's alone.
  if (me.role !== "SUPER_USER") done(STOCK, "Only the owner can permanently delete an item.");
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

/** A category, or a subcategory when a parent is given. */
export async function addItemCategory(formData: FormData) {
  const me = await requireStockUser();
  const name = text(formData, "name");
  if (!name) done(MASTER, "Not added — a category needs a name.");

  const parentId = text(formData, "parentId") || null;
  // The slug carries the parent so two subcategories can share a name under
  // different parents without colliding.
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = parentId ? `${parentId.slice(-6)}-${base}` : base;

  if (await prisma.itemCategory.findUnique({ where: { slug }, select: { id: true } })) {
    done(MASTER, `Not added — ${name} is already there.`);
  }

  await prisma.itemCategory.create({ data: { name, slug, parentId } });
  revalidatePath(MASTER);
  await logHistory({ type: "create", module: "Inventory > Item Master", description: `Added category ${name}`, user: me });
  done(MASTER, `Category ${name} added.`);
}

export async function deleteItemCategory(id: string) {
  const me = await requireStockUser();
  const cat = await prisma.itemCategory.findUnique({
    where: { id },
    select: { name: true, _count: { select: { items: true, children: true } } },
  });
  if (!cat) return;

  const { items, children } = cat._count;
  if (items > 0 || children > 0) {
    const why = [
      items > 0 ? `${items} item${items === 1 ? "" : "s"} filed under it` : "",
      children > 0 ? `${children} subcategor${children === 1 ? "y" : "ies"} beneath it` : "",
    ].filter(Boolean).join(" and ");
    done(MASTER, `${cat.name} was not deleted — it has ${why}.`);
  }

  await prisma.itemCategory.delete({ where: { id } });
  revalidatePath(MASTER);
  await logHistory({ type: "delete", module: "Inventory > Item Master", description: `Removed category ${cat.name}`, user: me });
  done(MASTER, `Category ${cat.name} removed.`);
}

/** Correct an item's master data. Stock is not touched — movements do that. */
export async function editInvItem(id: string, formData: FormData) {
  const me = await requireStockUser();
  const before = await prisma.invItem.findUnique({ where: { id }, select: { sku: true } });
  if (!before) return;

  const sku = text(formData, "sku").toUpperCase();
  const name = text(formData, "name");
  if (!sku || !name) done(MASTER, "Not saved — an item needs a code and a name.");

  const clash = await prisma.invItem.findUnique({ where: { sku }, select: { id: true } });
  if (clash && clash.id !== id) done(MASTER, `Not saved — ${sku} belongs to another item.`);

  const cost = Number(text(formData, "unitCost").replace(/[₱,\s]/g, ""));
  const low = Math.floor(Number(text(formData, "lowStockAt")));

  await prisma.invItem.update({
    where: { id },
    data: {
      sku, name,
      description: text(formData, "description") || null,
      brand: text(formData, "brand") || null,
      unit: text(formData, "unit") || "pc",
      type: text(formData, "type") === "SERVICE" ? "SERVICE" : "GOODS",
      categoryId: text(formData, "categoryId") || null,
      supplierId: text(formData, "supplierId") || null,
      lowStockAt: Number.isFinite(low) && low >= 0 ? low : 5,
      unitCost: Number.isFinite(cost) && cost > 0 ? cost : null,
      isActive: text(formData, "isActive") !== "0",
    },
  });

  revalidatePath(MASTER);
  revalidatePath(STOCK);
  await logHistory({ type: "update", module: "Inventory > Item Master", description: `Saved item ${sku} ${name}`, user: me });
  done(MASTER, `${sku} — ${name} saved.`);
}

/**
 * Load items from a spreadsheet. Columns are found by their heading, so a
 * sheet with extra columns still imports; a code already on the register is
 * updated rather than duplicated.
 */
export async function importInvItems(formData: FormData) {
  const me = await requireStockUser();

  const file = formData.get("sheet");
  if (!(file instanceof File) || file.size === 0) done(MASTER, "Pick a spreadsheet to import.");
  if ((file as File).size > 8 * 1024 * 1024) done(MASTER, "Not imported — that file is over 8 MB.");

  const xlsx = await import("xlsx");
  let rows: Record<string, unknown>[];
  try {
    const wb = xlsx.read(Buffer.from(await (file as File).arrayBuffer()), { type: "buffer" });
    rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  } catch {
    done(MASTER, "Not imported — that file could not be read as a spreadsheet.");
  }

  const pick = (r: Record<string, unknown>, ...names: string[]) => {
    for (const k of Object.keys(r)) {
      const key = k.toLowerCase().replace(/[^a-z]/g, "");
      if (names.some((n) => key === n || key.includes(n))) return String(r[k] ?? "").trim();
    }
    return "";
  };

  let added = 0, updated = 0, skipped = 0;
  for (const r of rows!) {
    const sku = pick(r, "sku", "itemcode", "code").toUpperCase();
    const name = pick(r, "itemname", "name", "description", "title");
    // A row with no code is a heading, a total, or a blank.
    if (!sku || !name) { skipped += 1; continue; }

    const cost = Number(pick(r, "unitcost", "cost", "price").replace(/[₱,\s]/g, ""));
    const data = {
      name,
      unit: pick(r, "unit", "uom") || "pc",
      brand: pick(r, "brand") || null,
      unitCost: Number.isFinite(cost) && cost > 0 ? cost : null,
    };

    const existing = await prisma.invItem.findUnique({ where: { sku }, select: { id: true } });
    if (existing) {
      await prisma.invItem.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.invItem.create({ data: { sku, ...data } });
      added += 1;
    }
  }

  revalidatePath(MASTER);
  revalidatePath(STOCK);
  await logHistory({ type: "create", module: "Inventory > Item Master", description: `Imported items — ${added} added, ${updated} updated`, user: me });
  done(MASTER, `${added} item${added === 1 ? "" : "s"} added, ${updated} updated${skipped ? `, ${skipped} row${skipped === 1 ? "" : "s"} skipped` : ""}.`);
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
