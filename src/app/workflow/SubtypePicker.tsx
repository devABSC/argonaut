"use client";

import { useRouter } from "next/navigation";

/**
 * One dropdown listing every subtype as "Service Type + Service Subtype".
 * The choice lives in the URL, which is what loads that subtype's form.
 */
export default function SubtypePicker({
  options,
  selected,
}: {
  options: { id: string; label: string }[];
  selected: string;
}) {
  const router = useRouter();

  return (
    <div className="picker one">
      <div className="pvf">
        <label>Service Type + Service Subtype</label>
        <select
          value={selected}
          onChange={(e) => {
            const v = e.target.value;
            router.push(
              v
                ? `/workflow/service-forms?t=types&form=${v}`
                : "/workflow/service-forms?t=types",
            );
          }}
        >
          <option value="">— choose a form —</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}
