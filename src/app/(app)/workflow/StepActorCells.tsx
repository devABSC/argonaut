"use client";

import { useState } from "react";

const ACTORS = [
  { value: "REQUESTOR", label: "Requestor" },
  { value: "APPROVER", label: "Approver" },
];

/**
 * User Role and Approver, paired. One approver is picked from a collapsed
 * dropdown rather than a list of every user. A requestor step routes back to
 * whoever raised the ticket, so its picker is cleared and disabled — and a
 * disabled select posts nothing.
 */
export default function StepActorCells({
  actor: initialActor,
  users,
  selected = [],
}: {
  actor: string;
  users: { id: string; email: string }[];
  selected?: string[];
}) {
  const [actor, setActor] = useState(initialActor);
  const isRequestor = actor === "REQUESTOR";

  return (
    <>
      <select name="actor" value={actor} onChange={(e) => setActor(e.target.value)}>
        {ACTORS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>

      {isRequestor ? (
        <select disabled className="blanked">
          <option>Goes back to the requestor</option>
        </select>
      ) : (
        <select name="approverIds" defaultValue={selected[0] ?? ""}>
          <option value="">Select approver</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
        </select>
      )}
    </>
  );
}
