"use client";

import { useState } from "react";

/**
 * Service Type / Service Subtype as a linked pair. The two selects sit at
 * different points in the field list, so state lives here and each select is
 * rendered through this one component via the `slot` prop.
 */
export function CascadePair({
  tree,
  slot,
  name,
}: {
  tree: Record<string, string[]>;
  slot: "type" | "subtype";
  name: string;
}) {
  const [type, setType] = useState("");
  const types = Object.keys(tree);
  const subtypes = type ? (tree[type] ?? []) : [];

  if (slot === "type") {
    return (
      <select name={name} value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">— choose —</option>
        {types.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    );
  }

  return (
    <>
      <select name={name} disabled={!type} defaultValue="">
        <option value="">{type ? "— choose —" : "Pick a service type first"}</option>
        {subtypes.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {type && subtypes.length === 0 && (
        <span className="pvhelp">{type} has no subtypes yet</span>
      )}
    </>
  );
}

/**
 * Both selects together, kept in one component so the subtype list reacts to
 * the type without any cross-component wiring.
 */
export default function CascadeLookup({
  tree,
  typeLabel,
  subtypeLabel,
  typeRequired,
  subtypeRequired,
}: {
  tree: Record<string, string[]>;
  typeLabel: string;
  subtypeLabel: string;
  typeRequired?: boolean;
  subtypeRequired?: boolean;
}) {
  const [type, setType] = useState("");
  const types = Object.keys(tree);
  const subtypes = type ? (tree[type] ?? []) : [];

  return (
    <>
      <div className="pvf">
        <label>{typeLabel} {typeRequired && <span className="rq">*</span>}</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">— choose —</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="pvf">
        <label>{subtypeLabel} {subtypeRequired && <span className="rq">*</span>}</label>
        <select disabled={!type} defaultValue="">
          <option value="">{type ? "— choose —" : "Pick a service type first"}</option>
          {subtypes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="pvhelp">
          {!type
            ? "Narrows to the chosen service type"
            : subtypes.length === 0
              ? `${type} has no subtypes yet`
              : `${subtypes.length} subtype(s) under ${type}`}
        </span>
      </div>
    </>
  );
}
