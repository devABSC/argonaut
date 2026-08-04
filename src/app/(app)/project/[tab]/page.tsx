import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import ProjectList from "../ProjectList";

export default async function ProjectTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("project", tab);

  return (
    <>
      {active.slug === "projects" ? (
        <ProjectList viewer={{ id: user.id, role: user.role, email: user.email }} />
      ) : (
        <div className="panel">
          <h2>{active.label}</h2>
          <p>
            This page is wired up and role-gated, but has no fields yet — the{" "}
            {active.label} data model is still to be specified.
          </p>
        </div>
      )}
    </>
  );
}
