import { prisma } from "@/lib/prisma";
import { IconTrash } from "../icons";
import { addBill, deleteBill, ensureCoa } from "../actions/bills";
import BillForm from "./BillForm";

const amt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MNL = 8 * 60 * 60 * 1000;
const monthKey = (d: Date) => {
  const l = new Date(+d + MNL);
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Series colours from the theme's own tokens — colour is never decorative. */
const HUES = ["var(--cyan)", "var(--violet)", "var(--blue)", "var(--muted)", "var(--faint)"];

/**
 * Bills, with a year of spend per account above the row that adds them.
 *
 * The graph is grouped by the month a bill was entered — a bill carries no
 * invoice date of its own yet, so that is the only date it has.
 */
export default async function BillsPanel() {
  await ensureCoa();

  const [suppliers, accounts, bills] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.coaAccount.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    prisma.bill.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { name: true } },
        coa: { select: { code: true, name: true } },
      },
    }),
  ]);

  // Twelve months ending this one, oldest first.
  const now = new Date(Date.now() + MNL);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1));
    return {
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-GB", { month: "short" }),
    };
  });
  const at = new Map(months.map((m, i) => [m.key, i]));

  // account -> spend per month
  const byCoa = new Map<string, { name: string; totals: number[] }>();
  for (const b of bills) {
    const i = at.get(monthKey(b.createdAt));
    if (i === undefined) continue;
    const k = `${b.coa.code} ${b.coa.name}`;
    if (!byCoa.has(k)) byCoa.set(k, { name: k, totals: Array(12).fill(0) });
    byCoa.get(k)!.totals[i] += Number(b.invoiceAmount);
  }
  const series = [...byCoa.values()]
    .map((v, i) => ({ ...v, hue: HUES[i % HUES.length] }))
    .sort((a, b) => b.totals.reduce((x, y) => x + y, 0) - a.totals.reduce((x, y) => x + y, 0));

  const peak = Math.max(1, ...months.map((_, i) => Math.max(...series.map((s) => s.totals[i]), 0)));
  const year = series.reduce((t, s) => t + s.totals.reduce((x, y) => x + y, 0), 0);

  const W = 960, H = 200, PADL = 52, PADB = 24, PADT = 10;
  const plotW = W - PADL - 12, plotH = H - PADB - PADT;
  const slot = plotW / 12;
  const groupW = slot * 0.7;
  const barW = Math.max(3, groupW / Math.max(1, series.length));
  const ticks = [0, 0.5, 1].map((f) => Math.round(peak * f)).filter((v, i, a) => a.indexOf(v) === i);

  // Only worth a column when something in view actually uses it.
  const showMsf = bills.some((b) => b.msf != null);

  return (
    <>
      <div className="panel chartpanel">
        <div className="cat-head">
          <h2>Spend by account <span className="count">12 mo</span></h2>
          <span className="spacer" />
          <span className="tree-meta">₱ {amt(year)} in the last year</span>
        </div>

        {series.length === 0 ? (
          <p style={{ marginTop: 12 }}>No bills in the last twelve months.</p>
        ) : (
          <>
            <div className="chartwrap">
              <svg viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="xMidYMid meet"
                aria-label="Bill spend by chart-of-accounts line over the last twelve months">
                {ticks.map((t) => {
                  const y = PADT + plotH - (t / peak) * plotH;
                  return (
                    <g key={t}>
                      <line x1={PADL} y1={y} x2={W - 12} y2={y} className="grid" />
                      <text x={PADL - 8} y={y + 3.5} className="axis" textAnchor="end">
                        {t >= 1000 ? `${Math.round(t / 1000)}k` : t}
                      </text>
                    </g>
                  );
                })}
                {months.map((m, i) => {
                  const x0 = PADL + i * slot + (slot - groupW) / 2;
                  return (
                    <g key={m.key}>
                      {series.map((sr, k) => {
                        const v = sr.totals[i];
                        const h = (v / peak) * plotH;
                        return v === 0 ? null : (
                          <rect key={sr.name} x={x0 + k * barW} y={PADT + plotH - h}
                            width={Math.max(2, barW - 2)} height={h} rx={2} fill={sr.hue}>
                            <title>{`${sr.name} — ${m.label}: ${amt(v)}`}</title>
                          </rect>
                        );
                      })}
                      <text x={PADL + i * slot + slot / 2} y={H - 7} className="axis" textAnchor="middle">
                        {m.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="chartkey">
              {series.map((sr) => (
                <span key={sr.name}>
                  <i style={{ background: sr.hue }} />
                  {sr.name}
                  <b>₱ {amt(sr.totals.reduce((a, b) => a + b, 0))}</b>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="cat-head">
          <h2>Bills <span className="count">{bills.length}</span></h2>
        </div>

        <BillForm suppliers={suppliers} accounts={accounts} action={addBill} />

        {bills.length === 0 ? (
          <p style={{ marginTop: 14 }}>No bills yet — add the first one above.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead><tr>
                <th className="numcol">No.</th>
                <th>Supplier</th><th>COA</th><th>Recurring</th>
                {showMsf && <th className="amt">MSF</th>}
                <th className="amt">Invoice Amount</th>
                <th>Encoded by</th><th />
              </tr></thead>
              <tbody>
                {bills.map((b, i) => (
                  <tr key={b.id}>
                    <td className="numcol" data-label="No.">{i + 1}</td>
                    <td data-label="Supplier">{b.supplier.name}</td>
                    <td className="muted" data-label="COA">{b.coa.code} — {b.coa.name}</td>
                    <td data-label="Recurring">
                      <span className={`pill ${b.recurring ? "s-ACTIVE" : "s-SUSPENDED"}`}>
                        {b.recurring ? "Y" : "N"}
                      </span>
                    </td>
                    {showMsf && (
                      // Blank rather than a zero: a non-telco bill has no MSF,
                      // which is a different thing from an MSF of nothing.
                      <td className="amt" data-label="MSF">{b.msf == null ? "—" : amt(Number(b.msf))}</td>
                    )}
                    <td className="amt" data-label="Invoice Amount">{amt(Number(b.invoiceAmount))}</td>
                    <td className="muted" data-label="Encoded by">{b.encodedByName}</td>
                    <td className="rowacts">
                      <form action={deleteBill.bind(null, b.id)}>
                        <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
