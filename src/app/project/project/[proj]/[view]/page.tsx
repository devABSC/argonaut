import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import { PROJECT_VIEWS, isProjectView, PROJECT_PILL } from "@/lib/projects";
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

      <div className="subtabs" role="tablist">
        {PROJECT_VIEWS.map((v) => (
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
      </div>

      <ProjectDetail projectId={proj} view={view} />
    </AppShell>
  );
}
