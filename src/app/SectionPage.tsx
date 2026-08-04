import { requireAccess } from "@/lib/guard";

/**
 * Shared renderer for a section's placeholder tabs. Enforces, in order:
 * signed in -> role may see the section -> the tab actually exists.
 *
 * The chrome is the layout's job now, so this returns only the content.
 */
export default async function SectionPage({
  sectionKey,
  tab,
}: {
  sectionKey: string;
  tab: string;
}) {
  const { section, tab: active } = await requireAccess(sectionKey, tab);

  return (
    <div className="panel">
      <h2>{active.label}</h2>
      <p>
        This tab is wired up and role-gated, but has no fields yet — the{" "}
        {section.label} data model is still to be specified.
      </p>
    </div>
  );
}
