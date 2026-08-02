"use client";

import { useState } from "react";

const ACTORS = [
  { value: "REQUESTOR", label: "Requestor" },
  { value: "APPROVER", label: "Approver" },
];

/**
 * User Role and Approvers, paired. A requestor step routes back to the person
 * who raised the ticket, so it has no approvers to pick — the field is cleared
 * and disabled, and a disabled select posts nothing.
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
        <select disabled size={3} className="blanked">
          <option>Goes back to the requestor</option>
        </select>
      ) : (
        <span className="approvercell">
          <span className="assigned">
            {selected.length === 0
              ? "None assigned"
              : users.filter((u) => selected.includes(u.id)).map((u) => u.email).join(", ")}
          </span>
          <select name="approverIds" multiple size={3} defaultValue={selected}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
          <span className="hint">Ctrl/Cmd-click to select more than one</span>
        </span>
      )}
    </>
  );
}
