"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { isQboAccountType, subtypesFor } from "@/lib/qbo";

const PATH = "/finance/bills";
const COA_PATH = "/finance/coa";

async function requireFinanceUser() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
  return u;
}

/** Money as typed. Blank and rubbish both mean nothing, never NaN. */
function money(f: FormData, k: string): number | null {
  const raw = String(f.get(k) ?? "").replace(/[₱,\s]/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * The account a bill is booked against. Telco is seeded because the MSF column
 * keys off it — the rest are for Finance to add as they need them.
 */
const COA_SEED = [
  { code: "5100", name: "Telco", accountType: "Expense", accountSubType: "Utilities", sortOrder: 10 },
  { code: "5110", name: "Utilities", accountType: "Expense", accountSubType: "Utilities", sortOrder: 20 },
  { code: "5120", name: "Rent", accountType: "Expense", accountSubType: "Rent or Lease of Buildings", sortOrder: 30 },
  { code: "5130", name: "Office Supplies", accountType: "Expense", accountSubType: "Supplies & Materials", sortOrder: 40 },
  { code: "5140", name: "Professional Fees", accountType: "Expense", accountSubType: "Legal & Professional Fees", sortOrder: 50 },
  { code: "5150", name: "Software & Subscriptions", accountType: "Expense", accountSubType: "Dues & Subscriptions", sortOrder: 60 },
];

/** Fills an empty Chart of Accounts on first use, and never touches it after. */
export async function ensureCoa() {
  if ((await prisma.coaAccount.count()) > 0) return;
  await prisma.coaAccount.createMany({ data: COA_SEED, skipDuplicates: true });
}

export async function addCoaAccount(formData: FormData) {
  const me = await requireFinanceUser();
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) done(COA_PATH, "Not added — an account needs a name and a number.");

  if (await prisma.coaAccount.findUnique({ where: { code }, select: { id: true } })) {
    done(COA_PATH, `Not added — ${code} is already in the chart.`);
  }

  const accountType = String(formData.get("accountType") ?? "").trim() || null;
  if (accountType && !isQboAccountType(accountType)) {
    done(COA_PATH, "Not added — that is not a QuickBooks account type.");
  }

  // A subtype only means anything under its own type, so one that does not
  // belong is dropped rather than stored against the wrong parent.
  const sub = String(formData.get("accountSubType") ?? "").trim();
  const accountSubType =
    accountType && sub && subtypesFor(accountType).includes(sub) ? sub : null;

  const parentId = String(formData.get("parentId") ?? "").trim() || null;

  await prisma.coaAccount.create({
    data: {
      code,
      name,
      accountType,
      accountSubType,
      description: String(formData.get("description") ?? "").trim() || null,
      parentId,
    },
  });
  revalidatePath(COA_PATH);
  revalidatePath(PATH);
  await logHistory({ type: "create", module: "Finance > COA", description: `Added account ${code} ${name}`, user: me });
  done(COA_PATH, `${code} — ${name} added.`);
}

/** Correct an account in place. The same rules as adding one. */
export async function editCoaAccount(id: string, formData: FormData) {
  const me = await requireFinanceUser();
  const before = await prisma.coaAccount.findUnique({ where: { id }, select: { code: true } });
  if (!before) return;

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) done(COA_PATH, "Not saved — an account needs a name and a number.");

  const clash = await prisma.coaAccount.findUnique({ where: { code }, select: { id: true } });
  if (clash && clash.id !== id) done(COA_PATH, `Not saved — ${code} belongs to another account.`);

  const accountType = String(formData.get("accountType") ?? "").trim() || null;
  if (accountType && !isQboAccountType(accountType)) {
    done(COA_PATH, "Not saved — that is not a QuickBooks account type.");
  }
  const sub = String(formData.get("accountSubType") ?? "").trim();
  const accountSubType =
    accountType && sub && subtypesFor(accountType).includes(sub) ? sub : null;

  // An account cannot be its own parent, and nesting it under one of its own
  // children would make a loop nothing could render.
  let parentId = String(formData.get("parentId") ?? "").trim() || null;
  if (parentId === id) parentId = null;
  if (parentId) {
    const kids = await prisma.coaAccount.findMany({ where: { parentId: id }, select: { id: true } });
    if (kids.some((k) => k.id === parentId)) {
      done(COA_PATH, "Not saved — an account cannot sit under one of its own sub-accounts.");
    }
  }

  await prisma.coaAccount.update({
    where: { id },
    data: {
      code, name, accountType, accountSubType, parentId,
      description: String(formData.get("description") ?? "").trim() || null,
    },
  });

  revalidatePath(COA_PATH);
  revalidatePath(PATH);
  await logHistory({ type: "update", module: "Finance > COA", description: `Saved account ${code} ${name}`, user: me });
  done(COA_PATH, `${code} — ${name} saved.`);
}

export async function deleteCoaAccount(id: string) {
  const me = await requireFinanceUser();
  const acct = await prisma.coaAccount.findUnique({
    where: { id },
    select: {
      code: true, name: true,
      _count: { select: { bills: true, children: true } },
    },
  });
  if (!acct) return;

  // Deleting an account with transactions would orphan them — the account is
  // the only record of what the cost was. Deleting one with sub-accounts would
  // strand them at the top level. Both say so plainly rather than half-doing it.
  const { bills, children } = acct._count;
  if (bills > 0 || children > 0) {
    const why = [
      bills > 0 ? `${bills} bill${bills === 1 ? "" : "s"} booked against it` : "",
      children > 0 ? `${children} sub-account${children === 1 ? "" : "s"} under it` : "",
    ].filter(Boolean).join(" and ");
    done(COA_PATH, `${acct.code} ${acct.name} was not deleted — it has ${why}. Move or remove those first.`);
  }

  await prisma.coaAccount.delete({ where: { id } });
  revalidatePath(COA_PATH);
  await logHistory({ type: "delete", module: "Finance > COA", description: `Removed account ${acct.code}`, user: me });
  done(COA_PATH, `${acct.code} removed.`);
}

export async function addBill(formData: FormData) {
  const me = await requireFinanceUser();

  const coaId = String(formData.get("coaId") ?? "").trim();
  // Either an existing supplier, or a name typed into the + box.
  let supplierId = String(formData.get("supplierId") ?? "").trim();
  const newName = String(formData.get("supplierName") ?? "").trim();

  if (!supplierId && newName) {
    // Matched on name rather than created blindly, so typing a supplier that
    // already exists picks them up instead of making a duplicate.
    const existing = await prisma.supplier.findFirst({
      where: { name: { equals: newName, mode: "insensitive" } },
      select: { id: true },
    });
    supplierId =
      existing?.id ??
      (await prisma.supplier.create({ data: { name: newName }, select: { id: true } })).id;
    if (!existing) {
      await logHistory({ type: "create", module: "CRM > Suppliers", description: `Added supplier ${newName} while entering a bill`, user: me });
    }
  }

  if (!supplierId || !coaId) done(PATH, "Not added — a bill needs a supplier and an account.");

  const invoiceAmount = money(formData, "invoiceAmount");
  if (invoiceAmount === null || invoiceAmount <= 0) done(PATH, "Not added — enter the invoice amount.");

  const [supplier, coa] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId }, select: { name: true } }),
    prisma.coaAccount.findUnique({ where: { id: coaId }, select: { name: true, code: true } }),
  ]);
  if (!supplier || !coa) done(PATH, "Not added — that supplier or account no longer exists.");

  // MSF belongs to telco accounts only. Kept off anything else rather than
  // stored and hidden, so the figure never quietly contradicts the column.
  const isTelco = /telco/i.test(coa!.name);
  const msf = isTelco ? money(formData, "msf") : null;

  await prisma.bill.create({
    data: {
      supplierId,
      coaId,
      recurring: String(formData.get("recurring") ?? "N") === "Y",
      msf,
      invoiceAmount,
      encodedById: me.id,
      encodedByName: me.name,
    },
  });

  revalidatePath(PATH);
  await logHistory({
    type: "create", module: "Finance > Bills",
    description: `Added a ${coa!.name} bill from ${supplier!.name} for ${invoiceAmount}`,
    user: me,
  });
  done(PATH, `Bill from ${supplier!.name} added against ${coa!.code} ${coa!.name}.`);
}

export async function deleteBill(id: string) {
  const me = await requireFinanceUser();
  const bill = await prisma.bill.findUnique({
    where: { id },
    select: { invoiceAmount: true, supplier: { select: { name: true } } },
  });
  if (!bill) return;

  await prisma.bill.delete({ where: { id } });
  revalidatePath(PATH);
  await logHistory({
    type: "delete", module: "Finance > Bills",
    description: `Deleted a bill from ${bill.supplier.name}`, user: me,
  });
  done(PATH, `Bill from ${bill.supplier.name} deleted.`);
}
