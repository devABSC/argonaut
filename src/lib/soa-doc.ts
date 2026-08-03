import { prisma } from "./prisma";

/**
 * Accounts Payable is copied on every statement that goes out. A standing
 * rule, so it belongs here rather than in whoever presses send.
 */
export const AP_CC = "account-payable@atomitsoln.com";

/**
 * One statement, gathered once and rendered three ways — on screen, as a
 * workbook, and as a PDF. Keeping the gather here means the three can never
 * disagree about what the statement says.
 */
export async function loadSoa(id: string) {
  const [soa, company] = await Promise.all([
    prisma.soa.findUnique({
      where: { id },
      include: {
        employee: { select: { firstName: true, lastName: true, jobTitle: true, emailAdd: true } },
        lines: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
      },
    }),
    prisma.company.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!soa) return null;

  const charges = soa.lines.reduce((t, l) => t + Number(l.debit), 0);
  const credits = soa.lines.reduce((t, l) => t + Number(l.credit), 0);
  // Charges pull the balance negative, a credit settles it — the convention
  // the workbook this was modelled on uses.
  return { soa, company, charges, credits, balance: credits - charges };
}

export type SoaDoc = NonNullable<Awaited<ReturnType<typeof loadSoa>>>;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const money = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Accounting style, matching the source workbook. */
const acct = (n: number) => (n === 0 ? "-" : n < 0 ? `(${money(-n)})` : money(n));

/** `SOA-2026-0001.xlsx` — safe on every filesystem. */
export function soaFilename(ref: string, ext: string) {
  return `${ref.replace(/[^A-Za-z0-9-]/g, "_")}.${ext}`;
}

/** The statement as a workbook, in the same shape as the sheet Finance uses. */
export async function soaWorkbook(d: SoaDoc): Promise<Buffer> {
  const xlsx = await import("xlsx");
  const { soa, company, charges, credits, balance } = d;
  const who = `${soa.employee.firstName} ${soa.employee.lastName}`;

  const rows: (string | number | null)[][] = [
    [company?.name ?? "", "", "", "", "Statement"],
    [company?.address ?? ""],
    [],
    ["", "", "", "", soa.ref],
    ["", "", "", "", soa.createdAt.toISOString().slice(0, 10)],
    [],
    ["Bill To:", who],
    ["", soa.employee.jobTitle ?? ""],
    ["", soa.bouName ?? ""],
    ["", soa.employee.emailAdd ?? ""],
    soa.periodFrom || soa.periodTo ? ["", `Period ${day(soa.periodFrom)} to ${day(soa.periodTo)}`] : [],
    [],
    ["", "", "", "Total Charges", charges],
    ["", "", "", "Total Credits", credits],
    ["", "", "", "Balance Due", balance],
    [],
    ["Date", "Item Description", "Requestor", "Debit / Charges", "Credit / Payment", "Balance"],
  ];

  let run = 0;
  for (const l of soa.lines) {
    run += Number(l.credit) - Number(l.debit);
    rows.push([
      day(l.date),
      l.particulars,
      l.requestor ?? "",
      Number(l.debit) || null,
      Number(l.credit) || null,
      run,
    ]);
  }

  rows.push([]);
  rows.push(["", "", "", "Account Current Balance", "", balance]);
  rows.push([]);
  rows.push(["Please make your payment to cover the balance by the due date."]);
  if (company?.name) rows.push([`Make all cheques payable to ${company.name}.`]);
  rows.push(["Thank you for your business."]);
  if (company?.pocEmail) {
    rows.push([`Enquiries concerning this statement: ${company.pocEmail}`]);
  }

  const ws = xlsx.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 46 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "SOA");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** The same statement as a PDF, for sending on or filing. */
export async function soaPdf(d: SoaDoc): Promise<Buffer> {
  // The standalone build carries its font metrics inside the bundle. The plain
  // import reads .afm files from disk at runtime, which the serverless bundler
  // does not trace — it works locally and 500s in production.
  const { default: PDFDocument } = await import("pdfkit/js/pdfkit.standalone.js");
  const { soa, company, charges, credits, balance } = d;

  const doc = new PDFDocument({ size: "A4", margin: 44 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const L = 44;
  const R = doc.page.width - 44;
  // Date, Description, Requestor, Charges, Credits, Line Total.
  const COLS = [L, L + 66, L + 250, L + 340, L + 415, L + 490];
  const right = (text: string, x: number, y: number, w: number) =>
    doc.text(text, x, y, { width: w, align: "right" });

  doc.fontSize(14).font("Helvetica-Bold").text(company?.name ?? "", L, 44);
  doc.fontSize(9).font("Helvetica").fillColor("#555");
  if (company?.address) doc.text(company.address, { width: 300 });
  doc.fillColor("#000");

  doc.fontSize(16).font("Helvetica-Bold").text("STATEMENT", L, 44, { width: R - L, align: "right" });
  doc.fontSize(9).font("Helvetica")
    .text(soa.ref, L, 64, { width: R - L, align: "right" })
    .text(soa.createdAt.toISOString().slice(0, 10), L, 76, { width: R - L, align: "right" });

  let y = 118;
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#777").text("BILL TO", L, y);
  doc.fillColor("#000").fontSize(11).font("Helvetica-Bold")
    .text(`${soa.employee.firstName} ${soa.employee.lastName}`, L, y + 12);
  doc.fontSize(9).font("Helvetica").fillColor("#555");
  const meta = [soa.employee.jobTitle, soa.bouName, soa.employee.emailAdd].filter(Boolean) as string[];
  if (soa.periodFrom || soa.periodTo) meta.push(`Period ${day(soa.periodFrom)} to ${day(soa.periodTo)}`);
  doc.text(meta.join("  ·  "), L, y + 28, { width: 300 });
  doc.fillColor("#000");

  const sums: [string, string][] = [
    ["Total Charges", money(charges)],
    ["Total Credits", money(credits)],
    ["Balance Due", acct(balance)],
  ];
  sums.forEach(([k, v], i) => {
    const ty = y + i * 14;
    doc.fontSize(9).font(i === 2 ? "Helvetica-Bold" : "Helvetica");
    right(k, R - 220, ty, 120);
    right(v, R - 100, ty, 100);
  });

  y += 74;
  doc.moveTo(L, y).lineTo(R, y).strokeColor("#ccc").stroke();
  y += 8;
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#777");
  doc.text("DATE", COLS[0], y);
  doc.text("ITEM DESCRIPTION", COLS[1], y);
  doc.text("REQUESTOR", COLS[2], y);
  right("DEBIT / CHARGES", COLS[3], y, 70);
  right("CREDIT / PAYMENT", COLS[4], y, 70);
  right("BALANCE", COLS[5], y, R - COLS[5]);
  doc.fillColor("#000");
  y += 14;
  doc.moveTo(L, y).lineTo(R, y).stroke();
  y += 7;

  let run = 0;
  doc.fontSize(8.5).font("Helvetica");
  for (const l of soa.lines) {
    run += Number(l.credit) - Number(l.debit);

    const desc = l.particulars;
    const h = Math.max(doc.heightOfString(desc, { width: COLS[2] - COLS[1] - 8 }), 11);
    // A statement can run past one page; keep the columns readable when it does.
    if (y + h > doc.page.height - 90) {
      doc.addPage();
      y = 60;
    }

    doc.text(day(l.date), COLS[0], y, { width: COLS[1] - COLS[0] - 6 });
    doc.text(desc, COLS[1], y, { width: COLS[2] - COLS[1] - 8 });
    doc.text(l.requestor ?? "", COLS[2], y, { width: COLS[3] - COLS[2] - 8 });
    right(Number(l.debit) ? money(Number(l.debit)) : "", COLS[3], y, 70);
    right(Number(l.credit) ? money(Number(l.credit)) : "", COLS[4], y, 70);
    right(acct(run), COLS[5], y, R - COLS[5]);
    y += h + 5;
  }

  y += 4;
  doc.moveTo(L, y).lineTo(R, y).stroke();
  y += 7;
  doc.fontSize(9).font("Helvetica-Bold");
  right(money(charges), COLS[3], y, 70);
  right(money(credits), COLS[4], y, 70);
  right(acct(balance), COLS[5], y, R - COLS[5]);

  y += 24;
  doc.fontSize(10).font("Helvetica-Bold");
  right("Account Current Balance", R - 260, y, 160);
  right(acct(balance), R - 100, y, 100);

  y += 30;
  doc.fontSize(8.5).font("Helvetica").fillColor("#555");
  doc.text("Please make your payment to cover the balance by the due date.", L, y);
  if (company?.name) doc.text(`Make all cheques payable to ${company.name}.`, L);
  doc.text("Thank you for your business.", L);
  if (company?.pocEmail) doc.text(`Enquiries concerning this statement: ${company.pocEmail}`, L);

  doc.end();
  return finished;
}
