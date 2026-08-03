import { prisma } from "@/lib/prisma";
import { IconTrash } from "../icons";
import { addCoaAccount, deleteCoaAccount, ensureCoa } from "../actions/bills";
import CoaForm from "./CoaForm";

/**
 * The Chart of Accounts — what every cost in Finance is booked against.
 *
 * Seeded on first use so the pickers are never empty, then it is Finance's to
 * shape. An account carrying bills cannot be removed: the account is the only
 * record of what the cost was.
 */
export default async function CoaPanel() {
  await ensureCoa();

  const rows = await prisma.coaAccount.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: {
      parent: { select: { code: true, name: true } },
      _count: { select: { bills: true } },
    },
  });

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Chart of Accounts <span className="count">{rows.length}</span></h2>
      </div>

      <CoaForm
        parents={rows.map((r) => ({ id: r.id, code: r.code, name: r.name }))}
        action={addCoaAccount}
      />

      <div className="tablewrap">
        <table className="utable stacked">
          <thead><tr>
            <th className="numcol">No.</th><th>Account No.</th><th>Account Name</th>
            <th>Type</th><th>Subtype</th><th>SubAccount of</th><th>Bills</th><th />
          </tr></thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={a.id}>
                <td className="numcol" data-label="No.">{i + 1}</td>
                <td data-label="Account No."><b className="ticket">{a.code}</b></td>
                <td data-label="Account Name">
                  {a.name}
                  {a.description && <span className="tree-meta"> · {a.description}</span>}
                </td>
                <td className="muted" data-label="Type">{a.accountType ?? "—"}</td>
                <td className="muted" data-label="Subtype">{a.accountSubType ?? "—"}</td>
                <td className="muted" data-label="SubAccount of">
                  {a.parent ? `${a.parent.code} — ${a.parent.name}` : "—"}
                </td>
                <td className="muted" data-label="Bills">{a._count.bills}</td>
                <td className="rowacts">
                  {a._count.bills > 0 ? (
                    <button className="reject icon" type="button" disabled
                      title={`${a._count.bills} bill${a._count.bills === 1 ? "" : "s"} booked here — cannot be removed`}
                      aria-label="Delete unavailable while bills are booked here"><IconTrash /></button>
                  ) : (
                    <form action={deleteCoaAccount.bind(null, a.id)}>
                      <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
