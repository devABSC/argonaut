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
    ["Date", "Item Description", "Debit / Charges", "Credit / Payment", "Balance"],
  ];

  let run = 0;
  for (const l of soa.lines) {
    run += Number(l.credit) - Number(l.debit);
    rows.push([
      day(l.date),
      // Who asked for the spend rides with the item — the statement is already
      // addressed to one person, so it does not need a column of its own.
      l.requestor ? `${l.particulars} · ${l.requestor}` : l.particulars,
      Number(l.debit) || null,
      Number(l.credit) || null,
      run,
    ]);
  }

  rows.push([]);
  rows.push(["", "", "", "Account Current Balance", balance]);
  rows.push([]);
  rows.push(["Please make your payment to cover the balance by the due date."]);
  if (company?.name) rows.push([`Make all cheques payable to ${company.name}.`]);
  rows.push(["Thank you for your business."]);
  if (company?.pocEmail) {
    rows.push([`Enquiries concerning this statement: ${company.pocEmail}`]);
  }

  const ws = xlsx.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 58 }, { wch: 16 }, { wch: 17 }, { wch: 14 }];

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

  // Five columns sized to the printable width, so a header never wraps and
  // the last one never runs off the page. Widths, not offsets — the previous
  // fixed offsets overflowed A4 once the headings grew.
  const W = { date: 58, item: R - L - 58 - 84 - 88 - 78, debit: 84, credit: 88, bal: 78 };
  const X = {
    date: L,
    item: L + W.date,
    debit: L + W.date + W.item,
    credit: L + W.date + W.item + W.debit,
    bal: L + W.date + W.item + W.debit + W.credit,
  };
  const right = (text: string, x: number, y: number, w: number) =>
    doc.text(text, x, y, { width: w, align: "right" });

  // The brand mark heads the page when one is set. SVG is skipped — pdfkit
  // draws raster images only, and a missing logo must not fail the statement.
  let textX = L;
  const logo = company?.logo ?? "";
  if (logo.startsWith("data:image/") && !logo.startsWith("data:image/svg")) {
    try {
      const bytes = Buffer.from(logo.slice(logo.indexOf(",") + 1), "base64");
      doc.image(bytes, L, 40, { fit: [42, 42] });
      textX = L + 52;
    } catch {
      /* an unreadable logo is not a reason to fail the statement */
    }
  }

  doc.fontSize(14).font("Helvetica-Bold").text(company?.name ?? "", textX, 44);
  doc.fontSize(9).font("Helvetica").fillColor("#555");
  if (company?.address) doc.text(company.address, textX, 62, { width: 260 });
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
    right(k, R - 250, ty, 140);
    right(v, R - 105, ty, 105);
  });

  y += 74;
  doc.moveTo(L, y).lineTo(R, y).strokeColor("#ccc").stroke();
  y += 8;
  // 7pt so "CREDIT / PAYMENT" sits on one line inside its column.
  doc.fontSize(7).font("Helvetica-Bold").fillColor("#777");
  doc.text("DATE", X.date, y, { width: W.date, lineBreak: false });
  doc.text("ITEM DESCRIPTION", X.item, y, { width: W.item, lineBreak: false });
  right("DEBIT / CHARGES", X.debit, y, W.debit);
  right("CREDIT / PAYMENT", X.credit, y, W.credit);
  right("BALANCE", X.bal, y, W.bal);
  doc.fillColor("#000");
  y += 12;
  doc.moveTo(L, y).lineTo(R, y).stroke();
  y += 7;

  let run = 0;
  doc.fontSize(8.5).font("Helvetica");
  for (const l of soa.lines) {
    run += Number(l.credit) - Number(l.debit);

    const desc = l.requestor ? `${l.particulars}  ·  ${l.requestor}` : l.particulars;
    const h = Math.max(doc.heightOfString(desc, { width: W.item - 10 }), 11);
    // A statement can run past one page; keep the columns readable when it does.
    if (y + h > doc.page.height - 90) {
      doc.addPage();
      y = 60;
    }

    doc.text(day(l.date), X.date, y, { width: W.date - 6 });
    doc.text(desc, X.item, y, { width: W.item - 10 });
    right(Number(l.debit) ? money(Number(l.debit)) : "", X.debit, y, W.debit);
    right(Number(l.credit) ? money(Number(l.credit)) : "", X.credit, y, W.credit);
    right(acct(run), X.bal, y, W.bal);
    y += h + 5;
  }

  y += 4;
  doc.moveTo(L, y).lineTo(R, y).stroke();
  y += 7;
  doc.fontSize(9).font("Helvetica-Bold");
  right(money(charges), X.debit, y, W.debit);
  right(money(credits), X.credit, y, W.credit);
  right(acct(balance), X.bal, y, W.bal);

  y += 24;
  doc.fontSize(10).font("Helvetica-Bold");
  right("Account Current Balance", X.item, y, W.item + W.debit + W.credit - 12);
  right(acct(balance), X.bal, y, W.bal);

  y += 30;
  doc.fontSize(8.5).font("Helvetica").fillColor("#555");
  doc.text("Please make your payment to cover the balance by the due date.", L, y);
  if (company?.name) doc.text(`Make all cheques payable to ${company.name}.`, L);
  doc.text("Thank you for your business.", L);
  if (company?.pocEmail) doc.text(`Enquiries concerning this statement: ${company.pocEmail}`, L);

  doc.end();
  return finished;
}
