import { decide } from "@/app/actions/approvals";
import DecideButtons from "./DecideButtons";
import { slaState, HOURS_PER_SLA_DAY } from "@/lib/sla";

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
  approvers: { userId: string; user: { name: string } }[];
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
  requesterName,
  startedAt,
  closed,
}: {
  steps: Step[];
  approvals: Approval[];
  viewerId: string;
  requesterName: string;
  /** When the clock starts for the first step. */
  startedAt: Date;
  closed: boolean;
}) {
  const now = new Date();
  // Rows saved before step names were recorded carry an empty stepName. Those
  // are matched by who acted rather than by sequence: the old numbering
  // counted only steps that had an approver, so it points at the wrong step.
  const legacy = approvals.length > 0 && approvals.every((a) => !a.stepName);
  const pending = approvals.filter((a) => a.decision === "PENDING");
  const currentSeq = pending.length ? Math.min(...pending.map((a) => a.sequence)) : null;

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <h2>Workflow <span className="count">{steps.length} step{steps.length === 1 ? "" : "s"}</span></h2>

      {steps.length === 0 ? (
        <p style={{ marginTop: 14 }}>
          This subtype has no route configured, so the ticket was approved on submission.
        </p>
      ) : (
        <ol className="trail">
          {(() => {
            // Each step's clock starts when the one before it was decided.
            let clock = startedAt;
            return steps.map((st) => {
            const assigned = new Set(st.approvers.map((a) => a.userId));
            const rows = approvals
              .filter((a) =>
                legacy
                  ? st.actor === "APPROVER" && assigned.has(a.approverId)
                  : a.stepName === st.name,
              )
              .sort((a, b) => a.sequence - b.sequence);

            const decided = rows.length > 0 && rows.every((r) => r.decision !== "PENDING");
            const rejected = rows.some((r) => r.decision === "REJECTED");
            const isCurrent = currentSeq !== null && rows.some((r) => r.sequence === currentSeq);
            // Nobody is on the step at all, versus the ticket simply predating
            // the snapshot — very different things to tell the reader.
            const noOne = st.actor === "APPROVER" && st.approvers.length === 0;
            const unrecorded = rows.length === 0 && !noOne;

            // Measured to the last decision on the step, or to now while open.
            const decidedTimes = rows.map((r) => r.decidedAt).filter((d): d is Date => !!d);
            const endedAt = decidedTimes.length
              ? new Date(Math.max(...decidedTimes.map((d) => d.getTime())))
              : null;
            const stepStart = clock;
            const sla = slaState(stepStart, endedAt ?? now, st.slaDays);
            const started = decided || isCurrent;
            if (endedAt) clock = endedAt;

            const state = rejected
              ? "rejected"
              : decided
                ? "approved"
                : isCurrent
                  ? "current"
                  : rows.length === 0
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
                        ? requesterName.toUpperCase()
                        : st.approvers.map((a) => a.user.name).join(", ").toUpperCase() || "UNASSIGNED"}
                    </span>
                    <span className="spacer" />
                    <span
                      className={`slachip ${
                        !started ? "idle" : sla.breached ? "over" : sla.atRisk ? "risk" : "ok"
                      }`}
                      title={`Working hours only — ${HOURS_PER_SLA_DAY}h a day, Monday to Friday`}
                    >
                      {started ? `${sla.used} / ${sla.allowed}` : `SLA ${sla.allowed}`}
                      {started && sla.breached && <b> over</b>}
                    </span>
                    <span className={`pill ${
                      rejected ? "s-REJECTED"
                        : decided ? "s-ACTIVE"
                        : isCurrent ? "s-PENDING"
                        : "s-SUSPENDED"
                    }`}>
                      {rejected ? "REJECTED"
                        : decided ? "APPROVED"
                        : isCurrent ? "AWAITING"
                        : noOne ? "NO ONE ASSIGNED"
                        : unrecorded ? "NOT RECORDED"
                        : "QUEUED"}
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
                            <DecideButtons />
                          </form>
                        )}
                      </div>
                    );
                  })}

                  {noOne && (
                    <p className="reason dim">
                      No approver is set on this step, so nothing waits here. Assign one under Workflow → Routes.
                    </p>
                  )}
                  {unrecorded && (
                    <p className="reason dim">
                      This ticket was raised before the step was captured, so no decision is recorded against it.
                    </p>
                  )}
                </div>
              </li>
            );
            });
          })()}
        </ol>
      )}
    </div>
  );
}
