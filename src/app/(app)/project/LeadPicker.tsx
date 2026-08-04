"use client";

import { useMemo, useState } from "react";

export type Staff = { id: string; name: string; jobTitle: string | null; bouId: string | null };

/**
 * Pick one person by narrowing to their BOU first. Used for the roles a
 * project has exactly one of — manager, and whoever covers for them.
 *
 * The BOU is a filter, not a field: it is not saved, it only shortens the list.
 */
export default function LeadPicker({
  label,
  name,
  staff,
  bous,
  selected = "",
  hint,
}: {
  label: string;
  name: string;
  staff: Staff[];
  bous: { id: string; name: string; count: number }[];
  selected?: string;
  hint?: string;
}) {
  // Open on the current holder's BOU, so an edit starts where the value is.
  const [bou, setBou] = useState(staff.find((s) => s.id === selected)?.bouId ?? "");

  const people = useMemo(
    () => (bou ? staff.filter((s) => s.bouId === bou) : staff),
    [staff, bou],
  );

  return (
    <div className="statfield full leadpick">
      <span>{label}{hint && <em className="setflag"> {hint}</em>}</span>
      <div className="picker">
        <div className="pvf">
          <label>BOU</label>
          <select value={bou} onChange={(e) => setBou(e.target.value)} aria-label={`${label} — BOU`}>
            <option value="">— all BOUs —</option>
            {bous.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.count})</option>)}
          </select>
        </div>
        <div className="pvf">
          <label>Employee</label>
          <select name={name} defaultValue={selected} key={bou} aria-label={label}>
            <option value="">
              {people.length ? "— nobody —" : "— no active staff in this BOU —"}
            </option>
            {people.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.jobTitle ? ` — ${s.jobTitle}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
