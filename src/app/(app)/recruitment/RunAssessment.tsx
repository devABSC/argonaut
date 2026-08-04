"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** What a run has taken in practice — the bar is paced against this. */
const TYPICAL_SECONDS = 60;

function Progress() {
  const { pending } = useFormStatus();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(t);
  }, [pending]);

  if (!pending) return null;

  // Eases toward 95% and stops there. The last 5% belongs to the response
  // actually arriving — a bar that reaches 100% before the work is done is
  // just a lie with rounded corners.
  const pct = Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / (TYPICAL_SECONDS / 2.5)))));
  const left = Math.max(0, Math.round(TYPICAL_SECONDS - elapsed));

  return (
    <div className="runbar full" role="status" aria-live="polite">
      <div className="runtrack">
        <div className="runfill" style={{ width: `${pct}%` }} />
      </div>
      <span className="tree-meta">
        {pct}% · {Math.round(elapsed)}s elapsed
        {left > 0 ? ` · about ${left}s left` : " · almost there"}
      </span>
    </div>
  );
}

function Go({ rerun }: { rerun: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" type="submit" disabled={pending}>
      {pending && <span className="spinner" aria-hidden="true" />}
      {pending
        ? "Analysing…"
        : rerun
          ? "Run Argonaut AI Analytics again"
          : "Run Argonaut AI Analytics"}
    </button>
  );
}

/**
 * The run costs money, so the role is asked for first — an assessment against
 * the wrong role is a wasted charge, and the role is what makes it useful.
 */
export default function RunAssessment({
  action, candidateId, rerun, defaultRole,
}: {
  action: (fd: FormData) => Promise<void>;
  candidateId: string;
  rerun: boolean;
  defaultRole: string;
}) {
  return (
    <form action={action} className="addrow asrow">
      <input type="hidden" name="candidateId" value={candidateId} />
      <input
        name="role"
        defaultValue={defaultRole}
        placeholder="Assess against which role?"
        autoComplete="off"
      />
      <Go rerun={rerun} />
      <Progress />
    </form>
  );
}
