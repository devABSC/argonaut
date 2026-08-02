import { prisma } from "@/lib/prisma";
import { addApprover, moveApprover, removeApprover } from "../actions/catalog";
import { IconPlus, IconTrash, IconUp, IconDown } from "../icons";

/**
 * The approval route for each subtype: named people in sequence. A request
 * copies this chain when it is submitted, so edits here only affect new tickets.
 */
export default async function RoutesPanel() {
  const [cats, users] = await Promise.all([
    prisma.requestCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            approvers: {
              orderBy: { sequence: "asc" },
              include: { approver: { select: { name: true, role: true } } },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  const subs = cats.flatMap((c) => c.subcategories.map((s) => ({ ...s, categoryName: c.name })));

  return (
    <>
      <div className="panel">
        <h2>Approval routes</h2>
        <p>
          Each subtype has its own chain of named approvers, applied in order.
          A ticket copies the chain when submitted, so changes here affect only
          new tickets. A subtype with no approvers is approved on submission.
        </p>
      </div>

      {subs.length === 0 ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <p>No subtypes yet — add one on the Service Type tab.</p>
        </div>
      ) : (
        subs.map((s) => {
          const taken = new Set(s.approvers.map((a) => a.approverId));
          const available = users.filter((u) => !taken.has(u.id));

          return (
            <div className="panel" key={s.id} style={{ marginTop: 18 }}>
              <div className="cat-head">
                <h2>{s.categoryName} › {s.name}</h2>
                <span className="spacer" />
                {s.approvers.length === 0
                  ? <span className="pill s-PENDING">no approvers — auto-approved</span>
                  : <span className="pill s-ACTIVE">{s.approvers.length} step{s.approvers.length === 1 ? "" : "s"}</span>}
              </div>

              {s.approvers.length > 0 && (
                <ol className="chain">
                  {s.approvers.map((a, i) => (
                    <li key={a.id}>
                      <span className="seq">{a.sequence}</span>
                      <span className="who">{a.approver.name}</span>
                      <span className={`pill r-${a.approver.role}`}>{a.approver.role.replace("_", " ")}</span>
                      <span className="spacer" />
                      <form action={moveApprover.bind(null, a.id, "up")}>
                        <button className="nudge" type="submit" title="Move up" aria-label="Move up" disabled={i === 0}>
                          <IconUp />
                        </button>
                      </form>
                      <form action={moveApprover.bind(null, a.id, "down")}>
                        <button className="nudge" type="submit" title="Move down" aria-label="Move down" disabled={i === s.approvers.length - 1}>
                          <IconDown />
                        </button>
                      </form>
                      <form action={removeApprover.bind(null, a.id)}>
                        <button className="reject icon" type="submit" title="Remove" aria-label="Remove">
                          <IconTrash />
                        </button>
                      </form>
                    </li>
                  ))}
                </ol>
              )}

              <form action={addApprover} className="inline-form">
                <input type="hidden" name="subcategoryId" value={s.id} />
                <select name="approverId" required defaultValue="">
                  <option value="" disabled>Add an approver…</option>
                  {available.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} — {u.role.replace("_", " ")}</option>
                  ))}
                </select>
                <button type="submit" className="icon" title="Add approver" aria-label="Add approver" disabled={available.length === 0}>
                  <IconPlus />
                </button>
              </form>
            </div>
          );
        })
      )}
    </>
  );
}
