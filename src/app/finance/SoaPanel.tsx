import { prisma } from "@/lib/prisma";
import { IconTrash, IconPlus, IconSave, IconEdit, IconX, IconUpload, IconExcel, IconPdf, IconMail } from "../icons";
import CellSelect from "../settings/CellSelect";
import SoaFilter from "./SoaFilter";
import { soaViewer, soaWhere } from "@/lib/soa-scope";
import type { RoleKey } from "@/lib/roles";
import { createSoa, addSoaLine, editSoaLine, deleteSoaLine, setSoaStatus, deleteSoa, emailSoa, importSoaLines } from "../actions/soa";
import { AP_CC } from "@/lib/soa-doc";

const SOA_STATUS = ["Open", "Closed"] as const;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

const stamp = (d: Date) =>
  d.toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" });

const amt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Blank rather than 0.00, the way the statement is written by hand. */
const cell = (n: number) => (n === 0 ? "" : amt(n));

/** Accounting style: what is owed shows in brackets, nil shows as a dash. */
const running = (n: number) => (n === 0 ? "-" : n < 0 ? `(${amt(-n)})` : amt(n));

/**
 * Statement of Account, laid out to match the workbook Finance already uses:
 * a Bill To block, Charges and Credits with a running Line Total, and the
 * account's current balance at the foot.
 *
 * A statement always belongs to one employee — it is raised against the person
 * picked in the filter, never against a BOU or nobody.
 *
 * Lines live inside their statement rather than on a page of their own, so no
 * record id ever reaches the address bar.
 */
export default async function SoaPanel({
  bou = "",
  emp = "",
  ref = "",
  editLine = "",
  viewer,
}: {
  bou?: string;
  emp?: string;
  /** Which statement is open, by its reference. Human-readable, not an id. */
  ref?: string;
  /** Which line is being corrected. One at a time. */
  editLine?: string;
  viewer: { id: string; role: RoleKey; email: string };
}) {
  // Finance sees every statement; everyone else sees their own and nothing
  // else — scoped in the query, not hidden in the render.
  const v = await soaViewer(viewer);
  const [company, bous, staff] = await Promise.all([
    prisma.company.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.bou.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.employee.findMany({
      where: { status: 0, ...(bou ? { bouId: bou } : {}) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  // Someone picked before the BOU changed is no longer on offer — drop them
  // rather than filter by a person who is not in the list.
  const empId = staff.some((e) => e.id === emp) ? emp : "";

  const rows = await prisma.soa.findMany({
    where: {
      ...soaWhere(v),
      ...(v.admin && empId ? { employeeId: empId } : {}),
      ...(v.admin && bou && !empId ? { employee: { bouId: bou } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { firstName: true, lastName: true, jobTitle: true, emailAdd: true } },
      lines: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
    },
  });

  const totals = rows.map((s) => {
    const charges = s.lines.reduce((t, l) => t + Number(l.debit), 0);
    const credits = s.lines.reduce((t, l) => t + Number(l.credit), 0);
    // Charges pull the balance negative, a credit settles it — the workbook's
    // convention. A negative balance is money the employee laid out and has
    // not been paid back, which is what is due to them.
    const balance = credits - charges;
    return { s, charges, credits, balance, dueToEmployee: balance < 0 ? -balance : 0 };
  });

  // One statement is open at a time; the rest stay a row in the list.
  const open = totals.find((t) => t.s.ref === ref) ?? null;

  const href = (r: string) => {
    const q = new URLSearchParams();
    if (bou) q.set("bou", bou);
    if (empId) q.set("emp", empId);
    if (r) q.set("ref", r);
    const qs = q.toString();
    return qs ? `/finance/soa?${qs}` : "/finance/soa";
  };

  // Every write returns to the filters and the statement being looked at.
  const carry = (
    <>
      <input type="hidden" name="bou" value={bou} />
      <input type="hidden" name="emp" value={empId} />
      <input type="hidden" name="ref" value={ref} />
    </>
  );

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Statement of Account <span className="count">{rows.length}</span></h2>
        </div>

        {v.admin ? (
          <SoaFilter
            bou={bou}
            emp={empId}
            bous={bous}
            staff={staff.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))}
            action={createSoa}
          />
        ) : (
          <p className="soahint">
            {rows.length
              ? "Your own statement. Add, correct or remove your expense lines below."
              : "You have no statement yet — Finance raises it, then your expenses go here."}
          </p>
        )}
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="cat-head">
          <h2>Statements <span className="count">{rows.length}</span></h2>
          <span className="spacer" />
          {open && <a className="clear" href={href("")}>Close {open.s.ref}</a>}
        </div>

        {rows.length === 0 ? (
          <p style={{ marginTop: 14 }}>
            {bou || empId ? "No statements for that filter." : "No statements yet."}
          </p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead><tr>
                <th>SOA No.</th><th>Employee</th><th>BOU</th>
                <th className="amt">Total Charges</th>
                <th className="amt">Total Credit</th>
                <th className="amt">Balance</th>
                <th className="amt">Amount Due to Employee</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                {totals.map((t) => (
                  <tr key={t.s.id} className={t.s.ref === ref ? "iscurrent" : undefined}>
                    <td data-label="SOA No.">
                      {/* The reference opens the statement — readable, and it
                          keeps record ids out of the address bar. */}
                      <a className="ticket" href={href(t.s.ref)}>{t.s.ref}</a>
                    </td>
                    <td data-label="Employee">{t.s.employee.firstName} {t.s.employee.lastName}</td>
                    <td className="muted nowrap" data-label="BOU">{t.s.bouName ?? "—"}</td>
                    <td className="amt" data-label="Total Charges">{cell(t.charges)}</td>
                    <td className="amt" data-label="Total Credit">{cell(t.credits)}</td>
                    <td className={t.balance < 0 ? "amt owed" : "amt"} data-label="Balance">
                      {running(t.balance)}
                    </td>
                    <td className={t.dueToEmployee > 0 ? "amt owed" : "amt"} data-label="Amount Due to Employee">
                      {t.dueToEmployee > 0 ? amt(t.dueToEmployee) : "—"}
                    </td>
                    <td data-label="Status">
                      <span className={`pill ${t.s.status === "Closed" ? "s-SUSPENDED" : "s-ACTIVE"}`}>
                        {t.s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        (() => {
          const s = open.s;
          const charges = s.lines.reduce((t, l) => t + Number(l.debit), 0);
          const credits = s.lines.reduce((t, l) => t + Number(l.credit), 0);
          // Charges pull the balance negative; a credit settles it. Same
          // convention as the workbook, so the two can be read side by side.
          const balance = credits - charges;
          const closed = s.status === "Closed";
          let line = 0;

          return (
            <div className="panel soa" key={s.id} style={{ marginTop: 14 }}>
              <div className="soahead">
                <div className="soabrand">
                  {company?.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="soalogo" src={company.logo} alt={`${company.name} logo`} />
                  )}
                  <div>
                    <h2 className="soaco">{company?.name ?? "—"}</h2>
                    {company?.address && <p className="soaaddr">{company.address}</p>}
                  </div>
                </div>
                <div className="soatitle">
                  <span className="soaword">Statement</span>
                  <span className="tree-meta">{stamp(s.createdAt)}</span>
                  <span className="ticket">{s.ref}</span>
                </div>
              </div>

              <div className="soameta">
                <div className="soabill">
                  <dt>Bill To</dt>
                  <dd>
                    <b>{s.employee.firstName} {s.employee.lastName}</b>
                    {s.employee.jobTitle && <span className="muted"> · {s.employee.jobTitle}</span>}
                    <span className="tree-meta">{s.bouName ?? "—"}</span>
                    {s.employee.emailAdd && <span className="tree-meta">{s.employee.emailAdd}</span>}
                    {(s.periodFrom || s.periodTo) && (
                      <span className="tree-meta">Period {day(s.periodFrom)} → {day(s.periodTo)}</span>
                    )}
                  </dd>
                </div>

                <dl className="soasum">
                  <div><dt>Total Charges</dt><dd>₱ {amt(charges)}</dd></div>
                  <div><dt>Total Credits</dt><dd>₱ {amt(credits)}</dd></div>
                  <div className="due">
                    <dt>Balance Due</dt>
                    <dd>₱ {running(balance)}</dd>
                  </div>
                </dl>

                <div className="soaacts">
                  {/* Excel and PDF are downloads; the envelope sends the Excel
                      to the employee and copies Accounts Payable. */}
                  <a className="ghost icon" href={`/api/soa/${s.id}/xlsx`}
                    title="Download Excel" aria-label="Download Excel"><IconExcel /></a>
                  <a className="ghost icon" href={`/api/soa/${s.id}/pdf`}
                    title="Download PDF" aria-label="Download PDF"><IconPdf /></a>
                  {v.admin && <form action={emailSoa.bind(null, s.id)}>
                    {carry}
                    <button className="ghost icon" type="submit"
                      title={s.employee.emailAdd
                        ? `Email the Excel to ${s.employee.emailAdd}, cc ${AP_CC}`
                        : "This employee has no email address on file"}
                      disabled={!s.employee.emailAdd}
                      aria-label="Email this statement"><IconMail /></button>
                  </form>}

                  {/* Load a batch from the sheet Finance already keeps. The
                      rows land as ordinary lines, editable like any other. */}
                  {!closed && (
                    <form action={importSoaLines.bind(null, s.id)} className="soaimport">
                      {carry}
                      <label className="ghost icon" title="Import from a spreadsheet">
                        <IconUpload />
                        <input type="file" name="sheet"
                          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          aria-label="Spreadsheet to import" />
                      </label>
                      <button className="save icon" type="submit" title="Import the chosen sheet"
                        aria-label="Import the chosen sheet"><IconSave /></button>
                    </form>
                  )}
                </div>

                {v.admin && <form action={setSoaStatus} className="soastatus">
                  {carry}
                  <input type="hidden" name="soaId" value={s.id} />
                  <CellSelect name="status" defaultValue={s.status}
                    options={SOA_STATUS.map((o) => ({ value: o, label: o }))} />
                </form>}
              </div>

              <div className="tablewrap">
                <table className="utable">
                  <thead><tr>
                    <th>Date</th><th>Item Description</th>
                    <th className="amt">Debit / Charges</th>
                    <th className="amt">Credit / Payment</th>
                    <th className="amt">Balance</th><th />
                  </tr></thead>
                  <tbody>
                    {s.lines.map((l) => {
                      line += Number(l.credit) - Number(l.debit);
                      return (
                        <tr key={l.id}>
                          {l.id === editLine && !closed ? (
                            // The correction form lives inside the row it is
                            // correcting; a form cannot span table cells, so
                            // it takes the whole row.
                            <td colSpan={5}>
                              <form action={editSoaLine.bind(null, l.id)} className="addrow soaline">
                                {carry}
                                <input name="date" type="date" defaultValue={day(l.date)} aria-label="Date" />
                                <input name="particulars" defaultValue={l.particulars} required aria-label="Item description" />
                                <input name="requestor" defaultValue={l.requestor ?? ""} placeholder="Requestor" aria-label="Requestor" />
                                <input name="debit" type="number" step="0.01" min="0"
                                  defaultValue={Number(l.debit) || ""} placeholder="Debit / Charges" aria-label="Debit or charges" />
                                <input name="credit" type="number" step="0.01" min="0"
                                  defaultValue={Number(l.credit) || ""} placeholder="Credit / Payment" aria-label="Credit or payment" />
                                <button className="save icon" type="submit" title="Save" aria-label="Save"><IconSave /></button>
                              </form>
                            </td>
                          ) : (
                            <>
                              <td className="muted nowrap">{day(l.date)}</td>
                              <td>
                                {l.particulars}
                                {/* Requestor rides with the item rather than
                                    taking a column of its own. */}
                                {l.requestor && <span className="tree-meta"> · {l.requestor}</span>}
                              </td>
                              <td className="amt">{cell(Number(l.debit))}</td>
                              <td className="amt">{cell(Number(l.credit))}</td>
                              <td className={line < 0 ? "amt owed" : "amt"}>{running(line)}</td>
                            </>
                          )}
                          <td className="rowacts">
                            {closed ? (
                              <button className="reject icon" type="button" disabled
                                title="This statement is closed"
                                aria-label="Delete unavailable on a closed statement"><IconTrash /></button>
                            ) : l.id === editLine ? (
                              <a className="ghost icon" href={href(s.ref)} title="Cancel" aria-label="Cancel"><IconX /></a>
                            ) : (
                              <>
                                <a className="ghost icon" href={`${href(s.ref)}${href(s.ref).includes("?") ? "&" : "?"}editLine=${l.id}`}
                                  title="Correct this line" aria-label="Correct this line"><IconEdit /></a>
                                <form action={deleteSoaLine.bind(null, l.id)}>
                                  {carry}
                                  <button className="reject icon" type="submit" title="Remove line" aria-label="Remove line"><IconTrash /></button>
                                </form>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {s.lines.length === 0 && (
                      <tr><td colSpan={6} className="muted">No movements posted yet.</td></tr>
                    )}
                    <tr className="soatotal">
                      <td colSpan={2} />
                      <td className="amt">{cell(charges)}</td>
                      <td className="amt">{cell(credits)}</td>
                      <td className={balance < 0 ? "amt owed" : "amt"}>{running(balance)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="soabal">
                <span>Account Current Balance</span>
                <b className={balance < 0 ? "owed" : undefined}>₱ {running(balance)}</b>
              </div>

              {!closed && (
                <form action={addSoaLine} className="addrow soaline">
                  {carry}
                  <input type="hidden" name="soaId" value={s.id} />
                  <input name="date" type="date" title="Date" aria-label="Date" />
                  <input name="particulars" required placeholder="Description" autoComplete="off" />
                  <input name="requestor" placeholder="Requestor" autoComplete="off" aria-label="Requestor" />
                  {/* An expense is a debit, a payment is a credit. Named both
                      ways so whoever posts it does not have to translate. */}
                  <input name="debit" type="number" step="0.01" min="0"
                    placeholder="Debit / Charges" title="Debit — an expense charged to this account"
                    aria-label="Debit or charges" />
                  <input name="credit" type="number" step="0.01" min="0"
                    placeholder="Credit / Payment" title="Credit — a payment settling this account"
                    aria-label="Credit or payment" />
                  <button className="save icon" type="submit" title="Post line" aria-label="Post line">
                    <IconPlus />
                  </button>
                </form>
              )}

              <div className="soafoot">
                <p>Please make your payment to cover the balance by the due date.</p>
                {company?.name && <p>Make all cheques payable to {company.name}.</p>}
                <p>Thank you for your business.</p>
                {company?.pocEmail && (
                  <p className="muted">
                    Should you have any enquiries concerning this statement, please contact {company.pocEmail}.
                  </p>
                )}
              </div>

              {s.lines.length === 0 && !closed && (
                <form action={deleteSoa.bind(null, s.id)} className="soadrop">
                  {carry}
                  <button className="reject icon" type="submit" title="Delete this empty statement"
                    aria-label="Delete this empty statement"><IconTrash /></button>
                </form>
              )}
            </div>
          );
        })()
      )}
    </>
  );
}
