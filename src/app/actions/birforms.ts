"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const PATH = "/finance/bir-forms";

async function requireFinanceUser() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
  return u;
}

/** A blank form is a spreadsheet, a PDF or a Word document. */
const TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];
const MAX = 8 * 1024 * 1024;

export async function addBirForm(formData: FormData) {
  const me = await requireFinanceUser();

  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!code || !description) done(PATH, "Not added — a form needs a number and a description.");

  if (await prisma.birForm.findUnique({ where: { code }, select: { id: true } })) {
    done(PATH, `Not added — form ${code} is already listed.`);
  }

  // The blank is optional: a form can be listed before its file is to hand.
  const file = formData.get("file");
  let blank = {};
  if (file instanceof File && file.size > 0) {
    if (!TYPES.includes(file.type)) done(PATH, "Not added — attach an Excel, PDF or Word file.");
    if (file.size > MAX) done(PATH, `Not added — that file is over ${MAX / 1024 / 1024} MB.`);
    blank = {
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      fileData: Buffer.from(await file.arrayBuffer()),
    };
  }

  // A form is either a held copy or a link to where it is published.
  const raw = String(formData.get("sourceUrl") ?? "").trim();
  if (raw && !/^https?:\/\//i.test(raw)) done(PATH, "Not added — a link must start with http:// or https://");

  await prisma.birForm.create({
    data: { code, description, sourceUrl: raw || null, ...blank, uploadedById: me.id, uploadedByName: me.name },
  });

  revalidatePath(PATH);
  await logHistory({ type: "create", module: "Finance > BIR", description: `Listed BIR form ${code}`, user: me });
  done(PATH, `Form ${code} added.`);
}

function date(f: FormData, k: string): Date | null {
  const v = String(f.get(k) ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return isNaN(+d) ? null : d;
}

const P2307 = "/finance/bir-2307";

/**
 * Raise a 2307 for a supplier. The supplier may be picked from the register or
 * typed in; either way the name is stored on the certificate, so it still
 * reads if the supplier record changes later.
 */
export async function addBir2307(formData: FormData) {
  const me = await requireFinanceUser();

  const periodFrom = date(formData, "periodFrom");
  const periodTo = date(formData, "periodTo");
  if (!periodFrom || !periodTo) done(P2307, "Not added — give the period this covers.");
  if (periodTo < periodFrom) done(P2307, "Not added — the period ends before it starts.");

  const supplierId = String(formData.get("supplierId") ?? "").trim() || null;
  let supplierName = String(formData.get("supplierName") ?? "").trim();
  let supplierTin = String(formData.get("supplierTin") ?? "").trim() || null;
  let address = String(formData.get("address") ?? "").trim() || null;

  if (supplierId) {
    const sup = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { name: true, tin: true, address: true },
    });
    if (!sup) done(P2307, "Not added — that supplier no longer exists.");
    // The register fills what the form was left blank on, rather than
    // overwriting anything typed by hand.
    supplierName = supplierName || sup!.name;
    supplierTin = supplierTin ?? sup!.tin;
    address = address ?? sup!.address;
  }
  if (!supplierName) done(P2307, "Not added — a 2307 needs a supplier.");

  await prisma.bir2307.create({
    data: {
      periodFrom, periodTo, supplierId, supplierName, supplierTin, address,
      encodedById: me.id, encodedByName: me.name,
    },
  });

  revalidatePath(P2307);
  await logHistory({ type: "create", module: "Finance > BIR", description: `Raised a 2307 for ${supplierName}`, user: me });
  done(P2307, `2307 for ${supplierName} added.`);
}

export async function deleteBir2307(id: string) {
  const me = await requireFinanceUser();
  const r = await prisma.bir2307.findUnique({ where: { id }, select: { supplierName: true } });
  if (!r) return;

  await prisma.bir2307.delete({ where: { id } });
  revalidatePath(P2307);
  await logHistory({ type: "delete", module: "Finance > BIR", description: `Deleted a 2307 for ${r.supplierName}`, user: me });
  done(P2307, `2307 for ${r.supplierName} deleted.`);
}

export async function deleteBirForm(id: string) {
  const me = await requireFinanceUser();
  const f = await prisma.birForm.findUnique({ where: { id }, select: { code: true } });
  if (!f) return;

  await prisma.birForm.delete({ where: { id } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Finance > BIR", description: `Removed BIR form ${f.code}`, user: me });
  done(PATH, `Form ${f.code} removed.`);
}
