import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "./AppShell";

/**
 * Shared renderer for every main-nav section. Enforces, in order:
 * signed in -> role may see the section -> the tab actually exists.
 */
export default async function SectionPage({
  sectionKey,
  tab,
}: {
  sectionKey: string;
  tab: string;
}) {
  const { user, nav, section, tab: active } = await requireAccess(sectionKey, tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
      <div className="panel">
        <h2>{active.label}</h2>
        <p>
          This tab is wired up and role-gated, but has no fields yet — the{" "}
          {section.label} data model is still to be specified.
        </p>
      </div>
    </AppShell>
  );
}
