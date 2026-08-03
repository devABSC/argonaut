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

export async function deleteCoaAccount(id: string) {
  const me = await requireFinanceUser();
  const acct = await prisma.coaAccount.findUnique({
    where: { id },
    select: { code: true, name: true, _count: { select: { bills: true } } },
  });
  if (!acct) return;
  // Deleting an account with bills would orphan them; the account is the only
  // record of what the cost was.
  if (acct._count.bills > 0) {
    done(COA_PATH, `${acct.code} has ${acct._count.bills} bill${acct._count.bills === 1 ? "" : "s"} against it — it cannot be removed.`);
  }

  await prisma.coaAccount.delete({ where: { id } });
  revalidatePath(COA_PATH);
  await logHistory({ type: "delete", module: "Finance > COA", description: `Removed account ${acct.code}`, user: me });
  done(COA_PATH, `${acct.code} removed.`);
}

export async function addBill(formData: FormData) {
  const me = await requireFinanceUser();

  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const coaId = String(formData.get("coaId") ?? "").trim();
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
