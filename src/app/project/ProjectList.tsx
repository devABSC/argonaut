import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { projectScope } from "@/lib/project-scope";
import type { RoleKey } from "@/lib/roles";
import { createProject, setProjectStatus, deleteProject } from "../actions/projects";
import { PROJECT_STATUS, PROJECT_PILL } from "@/lib/projects";
import { IconTrash, IconSave, IconDownload } from "../icons";
import CellSelect from "../settings/CellSelect";
import MemberPicker from "./MemberPicker";

const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

export default async function ProjectList({
  viewer,
}: {
  viewer: { id: string; role: RoleKey; email: string };
}) {
  // A user sees a project only if they are on it. Scoped in the query, not
  // the render.
  const scope = await projectScope(viewer);

  const [projects, staffRows, bouRows] = await Promise.all([
    prisma.project.findMany({
      where: scope,
      orderBy: [{ closedAt: "asc" }, { launchedAt: "desc" }, { createdAt: "desc" }],
      include: {
        user: { select: { name: true } },
        members: {
          orderBy: { holder: "asc" },
          include: { employee: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.employee.findMany({
      where: { status: 0 },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, jobTitle: true, bouId: true, bou: { select: { name: true } } },
    }),
    prisma.bou.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
  ]);

  const staff = staffRows.map((e) => ({
    id: e.id,
    name: `${e.lastName}, ${e.firstName}`,
    jobTitle: e.jobTitle,
    bouId: e.bouId,
    bouName: e.bou?.name ?? null,
  }));

  const counts = new Map<string, number>();
  for (const e of staffRows) if (e.bouId) counts.set(e.bouId, (counts.get(e.bouId) ?? 0) + 1);
  const bous = bouRows
    .filter((b) => counts.has(b.id))
    .map((b) => ({ id: b.id, name: b.name, count: counts.get(b.id)! }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const live = projects.filter((p) => !["Closed", "Cancelled"].includes(p.status)).length;

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Projects <span className="count">{projects.length}</span></h2>
          <span className="spacer" />
          <span className="tree-meta">{live} open</span>
          {/* The written guide to this module, downloadable rather than a page
              to read on screen — it is a deck people take into a briefing. */}
          <a
            className="viewtoggle"
            href="/docs/Argonaut-PROJECT-and-Tasks.pptx"
            download
            title="Download the PROJECT & Tasks guide (PowerPoint)"
          >
            <IconDownload /> Project UserGuide
          </a>
        </div>

        {projects.length === 0 ? (
          <p style={{ marginTop: 16 }}>No projects yet — add one below.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead>
                <tr>
                  <th className="numcol">No.</th>
                  <th>Project</th>
                  <th>Customer</th>
                  <th>Description</th>
                  <th>Launched</th>
                  <th>Closed</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr key={p.id}>
                    <td className="numcol" data-label="No.">{i + 1}</td>
                    <td data-label="Project">
                      <Link className="ticket wrap" href={`/project/project/${p.id}/project-info`}>
                        {p.name}
                      </Link>
                    </td>
                    <td className="muted clip narrow" data-label="Customer" title={p.customer ?? undefined}>
                      {p.customer ?? "—"}
                    </td>
                    <td className="muted clip" data-label="Description" title={p.description ?? undefined}>
                      {p.description ?? "—"}
                    </td>
                    <td className="muted nowrap" data-label="Launched">{fmtDate(p.launchedAt)}</td>
                    <td className="muted nowrap" data-label="Closed">{fmtDate(p.closedAt)}</td>
                    <td data-label="Members">
                      {p.members.length === 0 ? (
                        <span className="muted">nobody assigned</span>
                      ) : (
                        // One name on one line, the rest behind a count. The
                        // full roster is on the project itself; this column
                        // only says who is on it.
                        <span
                          className="peoplecell"
                          title={p.members
                            .map((m) => `${m.employee.firstName} ${m.employee.lastName} — ${m.holder}`)
                            .join("\n")}
                        >
                          <span className="skill">
                            {p.members[0].employee.firstName} {p.members[0].employee.lastName}
                          </span>
                          {p.members.length > 1 && (
                            <span className="tree-meta">+{p.members.length - 1}</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td data-label="Status">
                      <form action={setProjectStatus}>
                        <input type="hidden" name="projectId" value={p.id} />
                        <CellSelect
                          name="status"
                          defaultValue={p.status}
                          options={PROJECT_STATUS.map((s) => ({ value: s, label: s }))}
                        />
                      </form>
                    </td>
                    <td className="muted" data-label="Owner">{p.user.name}</td>
                    <td className="rowacts">
                      <form action={deleteProject.bind(null, p.id)}>
                        <button className="reject icon" type="submit" title="Delete" aria-label="Delete">
                          <IconTrash />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Add a project</h2>
        <p>
          A project can be saved without members or dates — fill in what you
          know and come back to the rest.
        </p>

        <form action={createProject} className="statgrid">
          <label className="statfield full">
            <span>Project name</span>
            <input name="name" required autoComplete="off" placeholder="e.g. Payroll migration" />
          </label>

          <label className="statfield full">
            <span>Project description</span>
            <textarea name="description" rows={3} placeholder="What is this project for?" />
          </label>

          <label className="statfield full">
            <span>Customer</span>
            <input name="customer" autoComplete="off" placeholder="Who the work is for" />
          </label>

          <label className="statfield">
            <span>Date launched</span>
            <input name="launchedAt" type="date" />
          </label>

          <label className="statfield">
            <span>Date closed</span>
            <input name="closedAt" type="date" />
          </label>

          <label className="statfield">
            <span>Status</span>
            <select name="status" defaultValue="Planning">
              {PROJECT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <MemberPicker staff={staff} bous={bous} />

          <div className="statacts">
            <button className="btn-primary" type="submit"><IconSave /> Create project</button>
          </div>
        </form>
      </div>
    </>
  );
}
