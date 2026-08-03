import { prisma } from "@/lib/prisma";
import { IconTrash, IconPlus } from "../icons";
import CellSelect from "../settings/CellSelect";
import { createSoa, addSoaLine, deleteSoaLine, setSoaStatus, deleteSoa } from "../actions/soa";

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
export default async function SoaPanel({ bou = "", emp = "" }: { bou?: string; emp?: string }) {
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
      ...(empId ? { employeeId: empId } : {}),
      ...(bou && !empId ? { employee: { bouId: bou } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { firstName: true, lastName: true, jobTitle: true, emailAdd: true } },
      lines: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
    },
  });

  // Every write returns to the filters the user was looking at.
  const carry = (
    <>
      <input type="hidden" name="bou" value={bou} />
      <input type="hidden" name="emp" value={empId} />
    </>
  );

  const picked = staff.find((e) => e.id === empId);

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Statement of Account <span className="count">{rows.length}</span></h2>
        </div>

        <form className="empsearch soafilter" action="/finance/soa" method="get">
          <select name="bou" defaultValue={bou} aria-label="Filter by BOU">
            <option value="">All BOUs</option>
            {bous.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select name="emp" defaultValue={empId} aria-label="Filter by employee">
            <option value="">All employees</option>
            {staff.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>)}
          </select>
          <button type="submit">Search</button>
          {(bou || empId) && <a className="clear" href="/finance/soa">Clear</a>}
        </form>

        {/* A statement is raised against the employee currently picked, which
            is why the button waits for one. */}
        <form action={createSoa} className="addrow soaadd">
          {carry}
          <input type="hidden" name="employeeId" value={empId} />
          <input name="periodFrom" type="date" title="Period from" aria-label="Period from" />
          <input name="periodTo" type="date" title="Period to" aria-label="Period to" />
          <button className="btn-primary" type="submit" disabled={!empId}
            title={picked ? `Raise a statement for ${picked.firstName} ${picked.lastName}` : "Pick an employee first"}>
            <IconPlus /> Create SOA
          </button>
        </form>
        <p className="soahint">
          {picked
            ? `A new statement will be raised for ${picked.firstName} ${picked.lastName}.`
            : "Pick an employee — a statement is always raised against one person."}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="panel" style={{ marginTop: 14 }}>
          <p>{bou || empId ? "No statements for that filter." : "No statements yet."}</p>
        </div>
      ) : (
        rows.map((s) => {
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
                <div>
                  <h2 className="soaco">{company?.name ?? "—"}</h2>
                  {company?.address && <p className="soaaddr">{company.address}</p>}
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

                <form action={setSoaStatus} className="soastatus">
                  {carry}
                  <input type="hidden" name="soaId" value={s.id} />
                  <CellSelect name="status" defaultValue={s.status}
                    options={SOA_STATUS.map((v) => ({ value: v, label: v }))} />
                </form>
              </div>

              <div className="tablewrap">
                <table className="utable">
                  <thead><tr>
                    <th>Date</th><th>Description</th><th>Requestor</th>
                    <th className="amt">Charges</th><th className="amt">Credits</th>
                    <th className="amt">Line Total</th><th />
                  </tr></thead>
                  <tbody>
                    {s.lines.map((l) => {
                      line += Number(l.credit) - Number(l.debit);
                      return (
                        <tr key={l.id}>
                          <td className="muted nowrap">{day(l.date)}</td>
                          <td>{l.particulars}</td>
                          <td className="muted">{l.requestor ?? "—"}</td>
                          <td className="amt">{cell(Number(l.debit))}</td>
                          <td className="amt">{cell(Number(l.credit))}</td>
                          <td className={line < 0 ? "amt owed" : "amt"}>{running(line)}</td>
                          <td className="rowacts">
                            {closed ? (
                              <button className="reject icon" type="button" disabled
                                title="This statement is closed"
                                aria-label="Delete unavailable on a closed statement"><IconTrash /></button>
                            ) : (
                              <form action={deleteSoaLine.bind(null, l.id)}>
                                {carry}
                                <button className="reject icon" type="submit" title="Remove line" aria-label="Remove line"><IconTrash /></button>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {s.lines.length === 0 && (
                      <tr><td colSpan={7} className="muted">No movements posted yet.</td></tr>
                    )}
                    <tr className="soatotal">
                      <td colSpan={3} />
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
                  <input name="debit" type="number" step="0.01" min="0" placeholder="Charges" aria-label="Charges" />
                  <input name="credit" type="number" step="0.01" min="0" placeholder="Credits" aria-label="Credits" />
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
        })
      )}
    </>
  );
}
