"use client";

import { useFormStatus } from "react-dom";
import { IconCheck, IconX } from "../icons";

/**
 * Approve and reject, with a spinner on whichever was pressed. Both are
 * disabled while the decision is in flight — a double-click on an approval is
 * not something to leave to chance.
 */
export default function DecideButtons() {
  const { pending, data } = useFormStatus();
  const clicked = pending ? data?.get("decision") : null;

  return (
    <>
      <button
        className="approve icon" type="submit" name="decision" value="APPROVED"
        title="Approve" aria-label="Approve" disabled={pending}
      >
        {clicked === "APPROVED" ? <span className="spinner" aria-hidden="true" /> : <IconCheck />}
      </button>
      <button
        className="reject icon" type="submit" name="decision" value="REJECTED"
        title="Reject" aria-label="Reject" disabled={pending}
      >
        {clicked === "REJECTED" ? <span className="spinner" aria-hidden="true" /> : <IconX />}
      </button>
    </>
  );
}
