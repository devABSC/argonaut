"use client";

import { useState } from "react";
import { LOOKUPS } from "@/lib/lookups";
import { KINDS } from "./kinds";

/**
 * The Display Type cell plus the cell that follows it. Only one of the two
 * follow-on inputs is relevant at a time, so the other is hidden rather than
 * left on screen to be filled in and silently ignored:
 *   List   -> free-text choices
 *   Lookup -> source table
 */
export default function FieldTypeCells({
  kind: initialKind,
  options = "",
  optionSource = "",
}: {
  kind: string;
  options?: string;
  optionSource?: string;
}) {
  const [kind, setKind] = useState(initialKind);

  return (
    <>
      <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
        {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
      </select>

      {kind === "SELECT" && (
        <input name="options" defaultValue={options} placeholder="Choices — Cash, Cheque" />
      )}

      {kind === "LOOKUP" && (
        <select name="optionSource" defaultValue={optionSource}>
          <option value="">— choose source table —</option>
          {LOOKUPS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
        </select>
      )}

      {kind !== "SELECT" && kind !== "LOOKUP" && (
        <>
          {/* Preserve the stored values so switching type and back does not wipe them. */}
          <input type="hidden" name="options" value={options} />
          <input type="hidden" name="optionSource" value={optionSource} />
          <span className="fnone">—</span>
        </>
      )}
    </>
  );
}
