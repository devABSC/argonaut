"use client";

import { useFormStatus } from "react-dom";

function Go({ rerun }: { rerun: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" type="submit" disabled={pending}>
      {pending && <span className="spinner" aria-hidden="true" />}
      {pending
        ? "Analysing — this takes a minute…"
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
    </form>
  );
}
