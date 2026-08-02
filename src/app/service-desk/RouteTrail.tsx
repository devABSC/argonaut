import { decide } from "../actions/approvals";
import { IconCheck, IconX } from "../icons";

type Row = {
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

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

/**
 * The route as it stands on this ticket: every step, who owns it, when it was
 * decided and why. The step awaiting the signed-in user carries its own
 * decision form, so acting never means hunting for a separate screen.
 */
export default function RouteTrail({
  rows,
  viewerId,
  closed,
}: {
  rows: Row[];
  viewerId: string;
  closed: boolean;
}) {
  const ordered = [...rows].sort((a, b) => a.sequence - b.sequence);
  const firstPending = ordered.find((r) => r.decision === "PENDING");

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <h2>Routes <span className="count">{ordered.length} step{ordered.length === 1 ? "" : "s"}</span></h2>

      {ordered.length === 0 ? (
        <p style={{ marginTop: 14 }}>
          This subtype has no route configured, so the ticket was approved on submission.
        </p>
      ) : (
        <ol className="trail">
          {ordered.map((r) => {
            const done = r.decision !== "PENDING";
            const isCurrent = firstPending?.id === r.id;
            const mine = isCurrent && r.approverId === viewerId && !closed;
            const state = done ? r.decision.toLowerCase() : isCurrent ? "current" : "waiting";

            return (
              <li key={r.id} className={`trailrow ${state}`}>
                <span className="dot" aria-hidden="true" />

                <div className="trailmain">
                  <div className="trailtop">
                    <b className="route">{r.stepName}</b>
                    <span className="who">
                      {done ? r.approver.name : r.actor === "REQUESTOR" ? "REQUESTOR" : r.approver.name}
                    </span>
                    <span className="spacer" />
                    {done && <span className="when">{r.decidedAt ? fmt(r.decidedAt) : ""}</span>}
                    <span className={`pill ${done ? (r.decision === "APPROVED" ? "s-ACTIVE" : "s-REJECTED") : isCurrent ? "s-PENDING" : "s-SUSPENDED"}`}>
                      {done ? r.decision : isCurrent ? "AWAITING" : "QUEUED"}
                    </span>
                  </div>

                  {r.remarks && <p className="reason">{r.remarks}</p>}

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
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
