import { prisma } from "@/lib/prisma";
import { saveVerifyItem, deleteVerifyItem } from "../actions/candidates";
import { VERIFY_STATUS, VERIFY_PILL } from "@/lib/candidate-views";
import { IconSave, IconTrash } from "../icons";

/**
 * The assessment's lists, turned into rows two people work through.
 *
 * A claim to verify and a question to ask are the same shape — something
 * raised, answered by the recruiter and by the hiring manager — so they share
 * one table and differ only in what the column is called.
 *
 * Laid out as a grid rather than a real table: each row is its own form, and a
 * <form> cannot span table cells. Linking inputs by `form=` id instead drops
 * their values under server actions.
 */
export default async function CheckList({
  candidateId,
  kind,
  title,
  blurb,
  itemLabel,
}: {
  candidateId: string;
  kind: "verify" | "question";
  title: string;
  blurb: string;
  itemLabel: string;
}) {
  const rows = await prisma.verifyItem.findMany({
    where: { candidateId, kind },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return null;

  const open = rows.filter((r) => r.status === "Open").length;

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <div className="cat-head">
        <h2>{title} <span className="count">{rows.length}</span></h2>
        <span className="spacer" />
        {open > 0 && <span className="pill s-PENDING">{open} open</span>}
      </div>
      <p>{blurb}</p>

      <div className={`checklist${kind === "question" ? " withanswer" : ""}`}>
        <div className="checkhead">
          <span className="numcol">No.</span>
          <span>{itemLabel}</span>
          {kind === "question" && <span>Candidate&rsquo;s answer</span>}
          <span>Recruiter Remarks</span>
          <span>Hiring Manager Remarks</span>
          <span>Status</span>
          <span />
        </div>

        {rows.map((r, i) => (
          <form action={saveVerifyItem} className="checkrow" key={r.id}>
            <input type="hidden" name="itemId" value={r.id} />

            <span className="numcol">{i + 1}</span>

            <span className="citem">
              {r.item}
              <span className={`pill ${VERIFY_PILL[r.status] ?? "s-PENDING"}`}>{r.status}</span>
            </span>

            {kind === "question" && (
              // Read-only here: these are the candidate's words, and a remark
              // about them belongs in the recruiter's own column.
              <span className="canswer">
                {r.candidateAnswer
                  ? r.candidateAnswer
                  : <em className="tree-meta">not answered yet</em>}
              </span>
            )}

            <textarea name="recruiterRemarks" rows={2} defaultValue={r.recruiterRemarks ?? ""}
                      placeholder="What you found" />
            <textarea name="managerRemarks" rows={2} defaultValue={r.managerRemarks ?? ""}
                      placeholder="Manager's view" />

            <select name="status" defaultValue={r.status} aria-label="Status">
              {VERIFY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <span className="rowacts">
              <button className="save icon" type="submit" title="Save remarks" aria-label="Save remarks">
                <IconSave />
              </button>
              <button className="reject icon" type="submit" title="Remove" aria-label="Remove"
                      formAction={deleteVerifyItem.bind(null, r.id)}>
                <IconTrash />
              </button>
            </span>
          </form>
        ))}
      </div>
    </div>
  );
}
