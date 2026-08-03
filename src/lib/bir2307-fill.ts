import { prisma } from "./prisma";

/**
 * Fills the blank 2307 held on the Forms page with one certificate's details.
 *
 * The blank itself is never edited — it is read, written into a copy, and the
 * copy is what leaves. Cell addresses come from the form's own layout: the
 * labels sit in one row and the boxes that take the value in the next.
 */
const CELLS = {
  periodFrom: "J11",
  periodTo: "AB11",
  // Part I — Income Recipient / Payee
  payeeTin: "N14",
  payeeName: "B17",
  payeeAddress: "B20",
  payeeZip: "AL20",
  // Part II — Withholding Agent / Payor
  payorTin: "N26",
  payorName: "B29",
  payorAddress: "B32",
  payorZip: "AL32",
} as const;

/** BIR forms want MM/DD/YYYY. */
const mdY = (d: Date) => {
  const u = new Date(+d + 8 * 3600_000);
  return `${String(u.getUTCMonth() + 1).padStart(2, "0")}/${String(u.getUTCDate()).padStart(2, "0")}/${u.getUTCFullYear()}`;
};

/** Writes one certificate's details into a copy of the blank sheet. */
type CertLike = {
  periodFrom: Date; periodTo: Date;
  supplierName: string; supplierTin: string | null;
  address: string | null; zipCode: string | null;
};
type CompanyLike = { name: string; tin: string | null; address: string | null; city: string | null; zipCode: string | null } | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeCert(ws: any, cert: CertLike, company: CompanyLike) {
  const put = (addr: string, value: string | null | undefined) => {
    if (!value) return;
    // Keep whatever formatting the cell already carries; only the value moves.
    ws[addr] = { ...(ws[addr] ?? {}), t: "s", v: value, w: value };
  };

  put(CELLS.periodFrom, mdY(cert.periodFrom));
  put(CELLS.periodTo, mdY(cert.periodTo));

  put(CELLS.payeeName, cert.supplierName);
  put(CELLS.payeeTin, cert.supplierTin);
  put(CELLS.payeeAddress, cert.address);
  put(CELLS.payeeZip, cert.zipCode);

  put(CELLS.payorName, company?.name);
  put(CELLS.payorTin, company?.tin);
  put(CELLS.payorAddress, [company?.address, company?.city].filter(Boolean).join(", ") || null);
  put(CELLS.payorZip, company?.zipCode);
}

export async function fill2307(id: string): Promise<{ buf: Buffer; name: string } | null> {
  const [cert, blank, company] = await Promise.all([
    prisma.bir2307.findUnique({ where: { id } }),
    prisma.birForm.findUnique({ where: { code: "2307" }, select: { fileData: true, fileName: true } }),
    prisma.company.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!cert || !blank?.fileData) return null;

  const xlsx = await import("xlsx");
  const wb = xlsx.read(blank.fileData, { type: "buffer", cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  writeCert(ws, cert, company);

  const safe = cert.supplierName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    buf: xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer,
    name: `2307-${safe}-${mdY(cert.periodTo).replace(/\//g, "")}.xlsx`,
  };
}

/**
 * A year's certificates in one workbook — a sheet per quarter, in order.
 *
 * Each sheet is the blank form filled in for that certificate, so the file can
 * go straight to whoever files it rather than being assembled by hand from
 * four downloads.
 */
export async function fill2307Year(year: number): Promise<{ buf: Buffer; name: string } | null> {
  const [certs, blank, company] = await Promise.all([
    prisma.bir2307.findMany({
      where: { year },
      orderBy: [{ quarter: "asc" }, { supplierName: "asc" }],
    }),
    prisma.birForm.findUnique({ where: { code: "2307" }, select: { fileData: true } }),
    prisma.company.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (certs.length === 0 || !blank?.fileData) return null;

  const xlsx = await import("xlsx");
  const out = xlsx.utils.book_new();

  for (const cert of certs) {
    // A fresh read per certificate: writing into one shared sheet would carry
    // the previous payee's details into the next.
    const wb = xlsx.read(blank.fileData, { type: "buffer", cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    writeCert(ws, cert, company);

    // Excel sheet names cannot exceed 31 characters or contain []:*?/\
    const base = `Q${cert.quarter} ${cert.supplierName}`.replace(/[[\]:*?/\\]/g, " ");
    let name = base.slice(0, 31);
    let n = 2;
    while (out.SheetNames.includes(name)) name = `${base.slice(0, 28)} ${n++}`;
    xlsx.utils.book_append_sheet(out, ws, name);
  }

  return {
    buf: xlsx.write(out, { type: "buffer", bookType: "xlsx" }) as Buffer,
    name: `2307-${year}.xlsx`,
  };
}
