/**
 * Reads movements out of a statement workbook.
 *
 * Written against the sheet Finance already keeps: a header row naming Date,
 * Description, Charges and Credits, then one row per movement. Columns are
 * found by their heading rather than by position, so a sheet with an extra
 * column still imports. A row with no amount on either side is a spacer and is
 * skipped; a row with no date inherits the date above it, the way the sheet is
 * filled in by hand.
 */
export type ImportedLine = {
  date: Date;
  particulars: string;
  requestor: string | null;
  debit: number;
  credit: number;
};

export type ImportResult = { lines: ImportedLine[]; skipped: number; error?: string };

/** Excel keeps dates as days since 1899-12-30. */
const fromSerial = (n: number) => new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);

function asDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "number" && v > 20_000 && v < 80_000) return fromSerial(v);
  if (typeof v === "string") {
    const d = new Date(v.trim());
    if (!isNaN(+d)) return d;
  }
  return null;
}

function asMoney(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/[₱,\s]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  return 0;
}

const has = (cell: unknown, ...words: string[]) => {
  const t = String(cell ?? "").toLowerCase();
  return words.some((w) => t.includes(w));
};

export async function readSoaWorkbook(buf: Buffer): Promise<ImportResult> {
  const xlsx = await import("xlsx");

  let rows: unknown[][];
  try {
    const wb = xlsx.read(buf, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: true, defval: "" }) as unknown[][];
  } catch {
    return { lines: [], skipped: 0, error: "That file could not be read as a spreadsheet." };
  }

  // Find the header row by what it says, not where it sits.
  const head = rows.findIndex((r) => r?.some((c) => has(c, "date")) && r?.some((c) => has(c, "debit", "charge")));
  if (head === -1) {
    return {
      lines: [],
      skipped: 0,
      error: "No header row found — the sheet needs columns named Date, Description, Debit/Charges and Credit/Payment.",
    };
  }

  const H = rows[head];
  const col = (...words: string[]) => H.findIndex((c) => has(c, ...words));
  const cDate = col("date");
  const cItem = col("description", "item", "particular");
  const cWho = col("requestor", "requested");
  const cDebit = col("debit", "charge");
  const cCredit = col("credit", "payment");

  const lines: ImportedLine[] = [];
  let skipped = 0;
  let carried: Date | null = null;

  for (const r of rows.slice(head + 1)) {
    const d = asDate(r?.[cDate]);
    if (d) carried = d;

    const debit = cDebit >= 0 ? asMoney(r?.[cDebit]) : 0;
    const credit = cCredit >= 0 ? asMoney(r?.[cCredit]) : 0;
    // Nothing moved on this row — a spacer, a subtotal, or the footer.
    if (debit === 0 && credit === 0) continue;

    if (!carried) { skipped += 1; continue; }
    // A line is one side or the other; a row claiming both is not a movement.
    if (debit > 0 && credit > 0) { skipped += 1; continue; }

    const item = String(r?.[cItem] ?? "").trim();
    lines.push({
      date: carried,
      particulars: item || (credit > 0 ? "Payment" : "Charge"),
      requestor: cWho >= 0 ? String(r?.[cWho] ?? "").trim() || null : null,
      debit,
      credit,
    });
  }

  return { lines, skipped };
}
