"use client";

import { useRouter } from "next/navigation";

/**
 * One dropdown listing every subtype as "Service Type + Service Subtype".
 * The choice lives in the URL, which is what loads the form or route below it.
 *
 * The target is passed as strings, not a builder function — functions cannot
 * cross the server/client boundary.
 */
export default function SubtypePicker({
  options,
  selected,
  basePath,
  param,
  label = "Service Type + Service Subtype",
}: {
  options: { id: string; label: string }[];
  selected: string;
  /** Path to navigate to, query string included, e.g. "/workflow/service-forms?t=types". */
  basePath: string;
  /** Query parameter carrying the chosen subtype id. */
  param: string;
  label?: string;
}) {
  const router = useRouter();

  function go(id: string) {
    if (!id) return router.push(basePath);
    router.push(`${basePath}${basePath.includes("?") ? "&" : "?"}${param}=${id}`);
  }

  return (
    <div className="picker one">
      <div className="pvf">
        <label>{label}</label>
        <select value={selected} onChange={(e) => go(e.target.value)}>
          <option value="">— choose —</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}
