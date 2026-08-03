"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const PATH = "/finance/soa";

/** Finance is granted, not assumed — the same gate the module itself uses. */
async function requireFinanceUser() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
  return u;
}

function date(f: FormData, k: string): Date | null {
  const v = String(f.get(k) ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return isNaN(+d) ? null : d;
}

/** Money as entered. Blank and rubbish both mean zero, never NaN. */
function money(f: FormData, k: string): number {
  const n = Number(String(f.get(k) ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** Where the filters were, so creating a statement does not lose them. */
function back(f: FormData): string {
  const bou = String(f.get("bou") ?? "").trim();
  const emp = String(f.get("emp") ?? "").trim();
  const q = new URLSearchParams();
  if (bou) q.set("bou", bou);
  if (emp) q.set("emp", emp);
  const s = q.toString();
  return s ? `${PATH}?${s}` : PATH;
}

/**
 * Next reference for the year. Counting is good enough at this volume, and the
 * unique index is what actually guarantees it — two people creating at the
 * same instant retry rather than collide.
 */
async function nextRef(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const n = await prisma.soa.count({ where: { ref: { startsWith: `SOA-${year}-` } } });
  return `SOA-${year}-${String(n + 1).padStart(4, "0")}`;
}

export async function createSoa(formData: FormData) {
  const me = await requireFinanceUser();
  const where = back(formData);

  const employeeId = String(formData.get("employeeId") ?? "").trim();
  if (!employeeId) done(where, "Pick an employee first — a statement is always for someone.");

  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, bou: { select: { name: true } } },
  });
  if (!emp) done(where, "That employee no longer exists.");

  const periodFrom = date(formData, "periodFrom");
  const periodTo = date(formData, "periodTo");
  if (periodFrom && periodTo && periodTo < periodFrom) {
    done(where, "Not created — the period ends before it starts.");
  }

  let soa = null as { ref: string } | null;
  for (let attempt = 0; attempt < 3 && !soa; attempt += 1) {
    try {
      soa = await prisma.soa.create({
        data: {
          ref: await nextRef(),
          employeeId,
          bouName: emp!.bou?.name ?? null,
          periodFrom,
          periodTo,
          createdById: me.id,
        },
        select: { ref: true },
      });
    } catch {
      // Reference taken by a statement raised a moment ago — count again.
    }
  }
  if (!soa) done(where, "Not created — could not allocate a reference, try again.");

  revalidatePath(PATH);
  await logHistory({
    type: "create", module: "Finance > SOA",
    description: `Created ${soa!.ref} for ${emp!.firstName} ${emp!.lastName}`,
    user: me,
  });
  done(where, `${soa!.ref} created for ${emp!.firstName} ${emp!.lastName}.`);
}

export async function addSoaLine(formData: FormData) {
  const me = await requireFinanceUser();
  const where = back(formData);

  const soaId = String(formData.get("soaId") ?? "").trim();
  const particulars = String(formData.get("particulars") ?? "").trim();
  if (!soaId || !particulars) done(where, "Not added — a line needs particulars.");

  const soa = await prisma.soa.findUnique({ where: { id: soaId }, select: { ref: true, status: true } });
  if (!soa) return;
  if (soa.status === "Closed") done(where, `${soa.ref} is closed — reopen it to post a line.`);

  const debit = money(formData, "debit");
  const credit = money(formData, "credit");
  // A movement is one side or the other. Both, or neither, is not a line.
  if (debit === 0 && credit === 0) done(where, "Not added — enter a debit or a credit.");
  if (debit > 0 && credit > 0) done(where, "Not added — a line is either a debit or a credit, not both.");

  await prisma.soaLine.create({
    data: {
      soaId,
      date: date(formData, "date") ?? new Date(),
      particulars,
      requestor: String(formData.get("requestor") ?? "").trim() || null,
      debit,
      credit,
    },
  });

  revalidatePath(PATH);
  await logHistory({
    type: "create", module: "Finance > SOA",
    description: `Posted ${debit > 0 ? `debit ${debit}` : `credit ${credit}`} to ${soa.ref}`,
    user: me,
  });
  done(where, `Line posted to ${soa.ref}.`);
}

export async function deleteSoaLine(id: string, formData: FormData) {
  const me = await requireFinanceUser();
  const where = back(formData);

  const line = await prisma.soaLine.findUnique({
    where: { id },
    select: { particulars: true, soa: { select: { ref: true, status: true } } },
  });
  if (!line) return;
  if (line.soa.status === "Closed") done(where, `${line.soa.ref} is closed — reopen it to remove a line.`);

  await prisma.soaLine.delete({ where: { id } });
  revalidatePath(PATH);
  await logHistory({
    type: "delete", module: "Finance > SOA",
    description: `Removed a line from ${line.soa.ref}`, user: me,
  });
  done(where, `Line removed from ${line.soa.ref}.`);
}

export async function setSoaStatus(formData: FormData) {
  const me = await requireFinanceUser();
  const where = back(formData);

  const id = String(formData.get("soaId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!id || (status !== "Open" && status !== "Closed")) return;

  const soa = await prisma.soa.update({ where: { id }, data: { status }, select: { ref: true } });
  revalidatePath(PATH);
  await logHistory({ type: "update", module: "Finance > SOA", description: `${soa.ref} → ${status}`, user: me });
  done(where, `${soa.ref} is now ${status.toLowerCase()}.`);
}

/** Only an empty statement can go. Lines are the record — they do not vanish. */
export async function deleteSoa(id: string, formData: FormData) {
  const me = await requireFinanceUser();
  const where = back(formData);

  const soa = await prisma.soa.findUnique({
    where: { id },
    select: { ref: true, _count: { select: { lines: true } } },
  });
  if (!soa) return;
  if (soa._count.lines > 0) {
    done(where, `${soa.ref} has ${soa._count.lines} line${soa._count.lines === 1 ? "" : "s"} — remove them first.`);
  }

  await prisma.soa.delete({ where: { id } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Finance > SOA", description: `Deleted ${soa.ref}`, user: me });
  done(where, `${soa.ref} deleted.`);
}
