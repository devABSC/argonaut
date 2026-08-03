"use client";

import { useMemo, useState } from "react";
import { HOLDERS } from "@/lib/projects";
import { IconTrash, IconPlus } from "../icons";

export type Staff = { id: string; name: string; jobTitle: string | null; bouId: string | null; bouName: string | null };
export type Member = { employeeId: string; holder: string };

/**
 * Assign members, each with the part they hold. BOU narrows the list first —
 * a flat roster of every active employee is unusable, and people are grouped
 * by BOU anyway.
 *
 * The chosen roster posts as `member` entries of "employeeId:holder", so the
 * whole set arrives in one field and the server can replace it wholesale.
 */
export default function MemberPicker({
  staff,
  bous,
  initial = [],
}: {
  staff: Staff[];
  bous: { id: string; name: string; count: number }[];
  initial?: Member[];
}) {
  const [members, setMembers] = useState<Member[]>(initial);
  const [bou, setBou] = useState("");
  const [pick, setPick] = useState("");

  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const available = useMemo(() => {
    const taken = new Set(members.map((m) => m.employeeId));
    return staff.filter((s) => !taken.has(s.id) && (!bou || s.bouId === bou));
  }, [staff, members, bou]);

  function add() {
    if (!pick) return;
    setMembers([...members, { employeeId: pick, holder: "Member" }]);
    setPick("");
  }

  return (
    <div className="statfield full">
      <span>Assign members</span>

      <div className="picker" style={{ marginTop: 4 }}>
        <div className="pvf">
          <label>BOU</label>
          <select value={bou} onChange={(e) => { setBou(e.target.value); setPick(""); }}>
            <option value="">— all BOUs —</option>
            {bous.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.count})</option>
            ))}
          </select>
        </div>

        <div className="pvf">
          <label>Employee</label>
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">
              {available.length ? "— choose someone —" : "— nobody left here —"}
            </option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.jobTitle ? ` — ${s.jobTitle}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="pvf">
          <label>&nbsp;</label>
          <button type="button" className="btn-primary" onClick={add} disabled={!pick}>
            <IconPlus /> Add
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <p className="tree-meta" style={{ marginTop: 10 }}>
          Nobody assigned yet — a project can be saved without members.
        </p>
      ) : (
        <div className="memberlist">
          {members.map((m, i) => {
            const s = byId.get(m.employeeId);
            return (
              <div className="memberrow" key={m.employeeId}>
                <span className="mname">
                  <b>{s?.name ?? "Unknown"}</b>
                  {s?.bouName && <span className="tree-meta"> {s.bouName}</span>}
                </span>

                <select
                  value={m.holder}
                  onChange={(e) => {
                    const next = [...members];
                    next[i] = { ...m, holder: e.target.value };
                    setMembers(next);
                  }}
                >
                  {HOLDERS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>

                <button
                  type="button"
                  className="reject icon"
                  title={`Remove ${s?.name ?? "member"}`}
                  aria-label="Remove member"
                  onClick={() => setMembers(members.filter((x) => x.employeeId !== m.employeeId))}
                >
                  <IconTrash />
                </button>

                <input type="hidden" name="member" value={`${m.employeeId}:${m.holder}`} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
