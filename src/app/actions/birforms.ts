"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { quarterRange } from "@/lib/quarters";

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
 * The withholding agent block on the 2307 — who is doing the withholding.
 *
 * Owner only. It is the company's own registered details, printed on every
 * certificate that leaves the building, so it is not something any Finance
 * user should be able to change in passing.
 */
export async function saveWithholdingAgent(formData: FormData) {
  const u = await requireUser();
  if (u.role !== "SUPER_USER") throw new Error("FORBIDDEN");

  const id = String(formData.get("companyId") ?? "").trim();
  if (!id) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) done(P2307, "Not saved — the withholding agent needs a name.");

  await prisma.company.update({
    where: { id },
    data: {
      name,
      tin: String(formData.get("tin") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      zipCode: String(formData.get("zipCode") ?? "").trim() || null,
      region: String(formData.get("region") ?? "").trim() || null,
      country: String(formData.get("country") ?? "").trim() || null,
      issuanceDate: date(formData, "issuanceDate"),
    },
  });

  revalidatePath(P2307);
  revalidatePath("/settings/company");
  await logHistory({ type: "update", module: "Finance > BIR", description: `Saved the withholding agent details for ${name}`, user: u });
  done(P2307, `Withholding agent saved — ${name}.`);
}

/**
 * Add or correct the Supplier Info block — the payee side of a certificate.
 *
 * This is the box that gets used over and over, so it saves to the supplier
 * register itself: the details entered here are the ones every later
 * certificate for that supplier starts from.
 */
export async function saveSupplierInfo(formData: FormData) {
  const me = await requireFinanceUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) done(P2307, "Not saved — a supplier needs a company name.");

  const data = {
    name,
    companyId: String(formData.get("companyId") ?? "").trim() || null,
    tin: String(formData.get("tin") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    region: String(formData.get("region") ?? "").trim() || null,
    country: String(formData.get("country") ?? "").trim() || null,
    issuanceDate: date(formData, "issuanceDate"),
  };

  const id = String(formData.get("supplierId") ?? "").trim();
  if (id) {
    await prisma.supplier.update({ where: { id }, data });
    revalidatePath(P2307);
    await logHistory({ type: "update", module: "Finance > BIR", description: `Saved supplier ${name}`, user: me });
    done(P2307, `Supplier ${name} saved.`);
  }

  // Names are unique in the register, so adding one that is already there
  // updates it rather than failing on the constraint.
  const clash = await prisma.supplier.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) {
    await prisma.supplier.update({ where: { id: clash.id }, data });
    revalidatePath(P2307);
    await logHistory({ type: "update", module: "Finance > BIR", description: `Updated supplier ${name}`, user: me });
    done(P2307, `${name} was already on the register — their details were updated.`);
  }

  await prisma.supplier.create({ data });
  revalidatePath(P2307);
  await logHistory({ type: "create", module: "Finance > BIR", description: `Added supplier ${name}`, user: me });
  done(P2307, `Supplier ${name} added.`);
}

/**
 * Raise a 2307 for a supplier, for one quarter of one year.
 *
 * The supplier may be picked from the register or typed in; either way the
 * name is stored on the certificate, so it still reads if the supplier record
 * changes later.
 */
export async function addBir2307(formData: FormData) {
  const me = await requireFinanceUser();

  const year = Number(String(formData.get("year") ?? "").trim());
  const quarter = Number(String(formData.get("quarter") ?? "").trim());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) done(P2307, "Not added — give the year.");
  if (![1, 2, 3, 4].includes(quarter)) done(P2307, "Not added — pick a quarter.");

  const supplierId = String(formData.get("supplierId") ?? "").trim() || null;
  let supplierName = String(formData.get("supplierName") ?? "").trim();
  let supplierTin = String(formData.get("supplierTin") ?? "").trim() || null;
  let address = String(formData.get("address") ?? "").trim() || null;
  const zipCode = String(formData.get("zipCode") ?? "").trim() || null;

  const companyId = String(formData.get("companyId") ?? "").trim() || null;
  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, tin: true } })
    : null;
  if (companyId && !company) done(P2307, "Not added — that company no longer exists.");

  if (supplierId) {
    const sup = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { name: true, tin: true, address: true, companyId: true },
    });
    if (!sup) done(P2307, "Not added — that supplier no longer exists.");
    // The supplier belongs to one company; a certificate from another cannot
    // name them.
    if (companyId && sup!.companyId && sup!.companyId !== companyId) {
      done(P2307, `Not added — ${sup!.name} is registered under a different company.`);
    }
    // The register fills what was left blank; anything typed by hand wins.
    supplierName = supplierName || sup!.name;
    supplierTin = supplierTin ?? sup!.tin;
    address = address ?? sup!.address;
  }
  if (!supplierName) done(P2307, "Not added — a 2307 needs an income recipient.");

  const clash = await prisma.bir2307.findFirst({
    where: { supplierName, year, quarter },
    select: { id: true },
  });
  if (clash) done(P2307, `Not added — ${supplierName} already has a Q${quarter} ${year} certificate.`);

  const { from, to } = quarterRange(year, quarter);
  await prisma.bir2307.create({
    data: {
      year, quarter, periodFrom: from, periodTo: to,
      companyId, companyName: company?.name ?? null, companyTin: company?.tin ?? null,
      supplierId, supplierName, supplierTin, address, zipCode,
      encodedById: me.id, encodedByName: me.name,
    },
  });

  revalidatePath(P2307);
  await logHistory({ type: "create", module: "Finance > BIR", description: `Raised a Q${quarter} ${year} 2307 for ${supplierName}`, user: me });
  done(P2307, `Q${quarter} ${year} 2307 for ${supplierName} added.`);
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
