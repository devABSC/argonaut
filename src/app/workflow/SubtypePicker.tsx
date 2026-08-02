"use client";

import { useRouter } from "next/navigation";

/**
 * One dropdown listing every subtype as "Service Type + Service Subtype".
 * The choice lives in the URL, which is what loads the form or route below it.
 */
export default function SubtypePicker({
  options,
  selected,
  href,
  label = "Service Type + Service Subtype",
}: {
  options: { id: string; label: string }[];
  selected: string;
  /** Builds the URL for a chosen id; called with "" when cleared. */
  href: (id: string) => string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <div className="picker one">
      <div className="pvf">
        <label>{label}</label>
        <select value={selected} onChange={(e) => router.push(href(e.target.value))}>
          <option value="">— choose —</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}
