"use client";

import { useMemo, useState } from "react";

export type Staff = { id: string; name: string; email: string; bouId: string | null; bouName: string | null };

/**
 * Choose a BOU, then tick the people in it. Checked addresses post as `emp`
 * and are merged with anything typed into the Recipients box, so the two ways
 * of addressing a campaign can be combined.
 */
export default function AudiencePicker({ staff, bous }: {
  staff: Staff[];
  bous: { id: string; name: string; count: number }[];
}) {
  const [bou, setBou] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return staff.filter(
      (s) =>
        (!bou || s.bouId === bou) &&
        (!term || s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term)),
    );
  }, [staff, bou, q]);

  const allShown = shown.length > 0 && shown.every((s) => picked.has(s.email));

  function toggle(email: string) {
    const next = new Set(picked);
    next.has(email) ? next.delete(email) : next.add(email);
    setPicked(next);
  }

  function toggleAllShown() {
    const next = new Set(picked);
    for (const s of shown) allShown ? next.delete(s.email) : next.add(s.email);
    setPicked(next);
  }

  return (
    <div className="full audience">
      <div className="picker">
        <div className="pvf">
          <label>BOU</label>
          <select value={bou} onChange={(e) => setBou(e.target.value)}>
            <option value="">— all BOUs ({staff.length}) —</option>
            {bous.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.count})</option>
            ))}
          </select>
        </div>
        <div className="pvf">
          <label>Find</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" />
        </div>
      </div>

      <div className="audbar">
        <button type="button" onClick={toggleAllShown} disabled={!shown.length}>
          {allShown ? "Clear these" : `Select all ${shown.length}`}
        </button>
        <span className="tree-meta">
          {picked.size} selected{picked.size ? ` · ${shown.length} shown` : ""}
        </span>
        {picked.size > 0 && (
          <button type="button" className="clearall" onClick={() => setPicked(new Set())}>
            Clear all
          </button>
        )}
      </div>

      <div className="audlist">
        {shown.length === 0 ? (
          <p className="tree-meta">Nobody here has an email address on file.</p>
        ) : (
          shown.map((s) => (
            <label className="tickrow" key={s.id}>
              <input
                type="checkbox"
                checked={picked.has(s.email)}
                onChange={() => toggle(s.email)}
              />
              {/* One line per person: the tick, the name, then the details.
                  Long addresses trim rather than wrap the row onto two. */}
              <span className="tickwho">
                <b>{s.name}</b>
                <span className="muted">{s.email}</span>
                {s.bouName && <span className="tree-meta">{s.bouName}</span>}
              </span>
            </label>
          ))
        )}
      </div>

      {/* Only the ticked addresses are posted, whatever the filter shows. */}
      {[...picked].map((email) => (
        <input key={email} type="hidden" name="emp" value={email} />
      ))}
    </div>
  );
}
