"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { IconPlus } from "../icons";
import { TASK_STATUS, TASK_PRIORITY } from "@/lib/project-tasks";

export type Staff = { id: string; name: string; jobTitle: string | null; bouId: string | null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" type="submit" disabled={pending}>
      {pending ? <span className="spinner" aria-hidden="true" /> : <IconPlus />}
      {pending ? "Assigning…" : "Assign task"}
    </button>
  );
}

/**
 * Pick the BOU, then the person in it. Nearly 300 employees is too many to
 * scroll, and the BOU is how the work is divided anyway.
 */
export default function TaskAssign({
  staff,
  bous,
}: {
  staff: Staff[];
  bous: { id: string; name: string; count: number }[];
}) {
  const [bou, setBou] = useState("");

  const people = useMemo(
    () => (bou ? staff.filter((s) => s.bouId === bou) : staff),
    [staff, bou],
  );

  return (
    <div className="statgrid">
      <label className="statfield full">
        <span>Task description</span>
        <textarea name="description" rows={3} required placeholder="What needs doing?" />
      </label>

      <label className="statfield">
        <span>BOU</span>
        {/* Changing the BOU clears the assignee — otherwise the form can post
            someone who is no longer in the list. */}
        <select name="bouId" value={bou} onChange={(e) => setBou(e.target.value)}>
          <option value="">— any BOU —</option>
          {bous.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.count})</option>
          ))}
        </select>
      </label>

      <label className="statfield">
        <span>Assignee</span>
        <select name="assigneeId" key={bou}>
          <option value="">
            {people.length ? "— nobody yet —" : "— no active staff in this BOU —"}
          </option>
          {people.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.jobTitle ? ` — ${s.jobTitle}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="statfield">
        <span>Due date</span>
        <input name="dueDate" type="date" />
      </label>

      <label className="statfield">
        <span>Priority</span>
        <select name="priority" defaultValue="Normal">
          {TASK_PRIORITY.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>

      <label className="statfield">
        <span>Status</span>
        <select name="status" defaultValue="Open">
          {TASK_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <div className="statacts"><Submit /></div>
    </div>
  );
}
