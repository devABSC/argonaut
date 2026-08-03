import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import { canSeeProject } from "@/lib/project-scope";
import { PROJECT_SECTIONS, isProjectView, PROJECT_PILL } from "@/lib/projects";
import AppShell from "../../../../AppShell";
import ProjectDetail from "../../../ProjectDetail";

/** One project's record. Access rides on the Projects tab. */
export default async function ProjectView({
  params,
}: {
  params: Promise<{ proj: string; view: string }>;
}) {
  const { proj, view } = await params;
  if (!isProjectView(view)) notFound();

  const { user, nav, section } = await requireAccess("project", "projects");

  // The list is scoped to membership; so is the URL. A project someone is not
  // on must 404 for them, not merely be absent from a list.
  if (!(await canSeeProject({ id: user.id, role: user.role, email: user.email }, proj))) {
    notFound();
  }

  const p = await prisma.project.findUnique({
    where: { id: proj },
    select: { name: true, status: true },
  });
  if (!p) notFound();

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab="projects"
    >
      <div className="viewbar">
        <Link className="viewtoggle" href="/project/projects">← Back to projects</Link>
        <span className="spacer" />
        <span className="tree-meta">{p.name}</span>
        <span className={`pill ${PROJECT_PILL[p.status] ?? "s-PENDING"}`}>{p.status}</span>
      </div>

      {/* Two levels: the record's tabs, then what that tab is made of.
          Milestones, roadblocks and risks all belong to the project's info,
          so they sit under it rather than beside it. */}
      {PROJECT_SECTIONS.map((sec) => (
        <div key={sec.slug} className="subtabs" role="tablist">
          <span className="subtab on parent">{sec.label}</span>
          <span className="subtabs-nest">
            {sec.views.map((v) => (
              <Link
                key={v.slug}
                role="tab"
                aria-selected={v.slug === view}
                className={v.slug === view ? "subtab on" : "subtab"}
                href={`/project/project/${proj}/${v.slug}`}
              >
                {v.label}
              </Link>
            ))}
          </span>
        </div>
      ))}

      <ProjectDetail projectId={proj} view={view} />
    </AppShell>
  );
}
