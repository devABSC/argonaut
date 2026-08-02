import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { visibleNav, findSection, canViewSection } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/rbac";
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
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Role gate happens server-side; hiding the nav item alone is not access control.
  if (!canViewSection(user.role, sectionKey)) notFound();

  const section = findSection(sectionKey);
  const active = section?.tabs.find((t) => t.slug === tab);
  if (!section || !active) notFound();

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={visibleNav(user.role)}
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
