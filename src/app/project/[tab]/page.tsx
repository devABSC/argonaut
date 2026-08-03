import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";
import ProjectList from "../ProjectList";

export default async function ProjectTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("project", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
      {active.slug === "projects" ? (
        <ProjectList />
      ) : (
        <div className="panel">
          <h2>{active.label}</h2>
          <p>
            This page is wired up and role-gated, but has no fields yet — the{" "}
            {active.label} data model is still to be specified.
          </p>
        </div>
      )}
    </AppShell>
  );
}
