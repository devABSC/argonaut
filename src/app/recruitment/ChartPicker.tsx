"use client";

import { useRouter } from "next/navigation";

/**
 * Which recruiter the chart is showing. Combined is the empty choice, so the
 * default view is everyone's uploads and narrowing is one pick away.
 *
 * Navigates on change rather than waiting for a button — a filter that needs a
 * second click reads as not working.
 */
export default function ChartPicker({
  recruiter,
  recruiters,
  hrefFor,
  allLabel = "All recruiters (combined)",
  label = "Recruiter shown in the chart",
}: {
  recruiter: string;
  recruiters: { id: string; name: string; count: number }[];
  /** Built by the server so the chart's other filters ride along. */
  hrefFor: Record<string, string>;
  /** The empty choice. Null when every option is a real value, like a year. */
  allLabel?: string | null;
  label?: string;
}) {
  const router = useRouter();

  return (
    <select
      className="chartpick"
      defaultValue={recruiter}
      aria-label={label}
      onChange={(e) => router.push(hrefFor[e.target.value] ?? hrefFor[""])}
    >
      {allLabel !== null && <option value="">{allLabel}</option>}
      {recruiters.map((r) => (
        <option key={r.id} value={r.id}>{r.count ? `${r.name} (${r.count})` : r.name}</option>
      ))}
    </select>
  );
}
