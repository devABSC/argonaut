import { decide } from "../actions/approvals";
import { IconCheck, IconX } from "../icons";

type Approval = {
  id: string;
  sequence: number;
  stepName: string;
  actor: string;
  decision: string;
  remarks: string | null;
  decidedAt: Date | null;
  approverId: string;
  approver: { name: string };
};

type Step = {
  id: string;
  sequence: number;
  name: string;
  description: string | null;
  slaDays: number;
  actor: string;
  approvers: { user: { name: string } }[];
};

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

/**
 * Every step of the subtype's route, with the ticket's recorded decisions laid
 * over the top. Driven by the route itself rather than only by the snapshot, so
 * a step with nobody assigned still appears — otherwise it would silently
 * vanish from the ticket.
 */
export default function RouteTrail({
  steps,
  approvals,
  viewerId,
  closed,
}: {
  steps: Step[];
  approvals: Approval[];
  viewerId: string;
  closed: boolean;
}) {
  const pending = approvals.filter((a) => a.decision === "PENDING");
  const currentSeq = pending.length ? Math.min(...pending.map((a) => a.sequence)) : null;

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <h2>Routes <span className="count">{steps.length} step{steps.length === 1 ? "" : "s"}</span></h2>

      {steps.length === 0 ? (
        <p style={{ marginTop: 14 }}>
          This subtype has no route configured, so the ticket was approved on submission.
        </p>
      ) : (
        <ol className="trail">
          {steps.map((st, idx) => {
            // Matched on the snapshotted step name. Rows saved before names were
            // recorded fall back to the sequence band the snapshot used.
            const band = (idx + 1) * 100;
            const rows = approvals
              .filter((a) =>
                a.stepName ? a.stepName === st.name : a.sequence >= band && a.sequence < band + 100,
              )
              .sort((a, b) => a.sequence - b.sequence);

            const decided = rows.length > 0 && rows.every((r) => r.decision !== "PENDING");
            const rejected = rows.some((r) => r.decision === "REJECTED");
            const isCurrent = currentSeq !== null && rows.some((r) => r.sequence === currentSeq);
            const unassigned = rows.length === 0;

            const state = rejected
              ? "rejected"
              : decided
                ? "approved"
                : isCurrent
                  ? "current"
                  : unassigned
                    ? "skipped"
                    : "waiting";

            return (
              <li key={st.id} className={`trailrow ${state}`}>
                <span className="dot" aria-hidden="true" />

                <div className="trailmain">
                  <div className="trailtop">
                    <b className="route">{st.name}</b>
                    <span className="who">
                      {st.actor === "REQUESTOR"
                        ? "REQUESTOR"
                        : st.approvers.map((a) => a.user.name).join(", ").toUpperCase() || "UNASSIGNED"}
                    </span>
                    <span className="spacer" />
                    <span className="when">SLA {st.slaDays}d</span>
                    <span className={`pill ${
                      rejected ? "s-REJECTED"
                        : decided ? "s-ACTIVE"
                        : isCurrent ? "s-PENDING"
                        : "s-SUSPENDED"
                    }`}>
                      {rejected ? "REJECTED" : decided ? "APPROVED" : isCurrent ? "AWAITING" : unassigned ? "NO ONE ASSIGNED" : "QUEUED"}
                    </span>
                  </div>

                  {st.description && <p className="reason dim">{st.description}</p>}

                  {rows.map((r) => {
                    const mine = r.decision === "PENDING" && r.sequence === currentSeq && r.approverId === viewerId && !closed;
                    return (
                      <div className="act" key={r.id}>
                        <span className="actwho">{r.approver.name}</span>
                        <span className={`pill ${
                          r.decision === "APPROVED" ? "s-ACTIVE" : r.decision === "REJECTED" ? "s-REJECTED" : "s-PENDING"
                        }`}>{r.decision}</span>
                        {r.decidedAt && <span className="when">{fmt(r.decidedAt)}</span>}
                        {r.remarks && <span className="reason">{r.remarks}</span>}

                        {mine && (
                          <form className="decide" action={decide.bind(null, r.id)}>
                            <input name="remarks" placeholder="Remarks or reason (optional)" />
                            <button className="approve icon" type="submit" name="decision" value="APPROVED" title="Approve" aria-label="Approve">
                              <IconCheck />
                            </button>
                            <button className="reject icon" type="submit" name="decision" value="REJECTED" title="Reject" aria-label="Reject">
                              <IconX />
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}

                  {unassigned && (
                    <p className="reason dim">
                      No approver was assigned to this step when the ticket was raised, so it is not awaiting anyone.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
