import { prisma } from "@/lib/prisma";
import { IconTrash, IconEdit } from "@/app/icons";
import { addCoaAccount, editCoaAccount, deleteCoaAccount, ensureCoa } from "@/app/actions/bills";
import CoaForm from "./CoaForm";

/**
 * The Chart of Accounts — what every cost in Finance is booked against.
 *
 * Seeded on first use so the pickers are never empty, then it is Finance's to
 * shape. An account carrying bills cannot be removed: the account is the only
 * record of what the cost was.
 */
export default async function CoaPanel({ edit = "" }: { edit?: string }) {
  await ensureCoa();

  const rows = await prisma.coaAccount.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: {
      parent: { select: { code: true, name: true } },
      _count: { select: { bills: true, children: true } },
    },
  });

  const parents = rows.map((r) => ({ id: r.id, code: r.code, name: r.name }));
  // One account at a time; the form doubles as the editor rather than opening
  // a second one further down the page.
  const editing = rows.find((r) => r.id === edit) ?? null;

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Chart of Accounts <span className="count">{rows.length}</span></h2>
      </div>

      {editing ? (
        <CoaForm
          parents={parents.filter((p) => p.id !== editing.id)}
          action={editCoaAccount.bind(null, editing.id)}
          defaults={{
            code: editing.code,
            name: editing.name,
            accountType: editing.accountType ?? "",
            accountSubType: editing.accountSubType ?? "",
            parentId: editing.parentId ?? "",
            description: editing.description ?? "",
          }}
          submitLabel={`Save ${editing.code}`}
          onCancel="/finance/coa"
        />
      ) : (
        <CoaForm parents={parents} action={addCoaAccount} />
      )}

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
                  {a.parentId && <span className="tree-meta">↳ </span>}
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
                  <a className="ghost icon" href={`/finance/coa?edit=${a.id}`}
                    title="Edit this account" aria-label="Edit this account"><IconEdit /></a>
                  {/* Left clickable even when it is in use: pressing it says
                      exactly what is holding the account, which a greyed-out
                      button never does. */}
                  <form action={deleteCoaAccount.bind(null, a.id)}>
                    <button className="reject icon" type="submit"
                      title={
                        a._count.bills || a._count.children
                          ? `In use — ${a._count.bills} bill(s), ${a._count.children} sub-account(s)`
                          : "Delete"
                      }
                      aria-label="Delete"><IconTrash /></button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
