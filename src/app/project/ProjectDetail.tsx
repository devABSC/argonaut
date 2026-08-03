import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  PROJECT_STATUS, MILESTONE_STATUS, ROADBLOCK_STATUS, RISK_STATUS,
  SEVERITY, LIKELIHOOD, SUB_PILL, TASK_STATUS,
} from "@/lib/projects";
import {
  saveProjectInfo,
  addMilestone, setMilestoneStatus, deleteMilestone, moveMilestone, renameMilestone,
  addMilestoneTask, setMilestoneTaskStatus, deleteMilestoneTask,
  addRoadblock, setRoadblockStatus, deleteRoadblock,
  addRisk, setRiskStatus, deleteRisk,
} from "../actions/project-detail";
import { IconSave, IconTrash, IconPlus, IconUp, IconDown, IconEdit } from "../icons";
import CellSelect from "../settings/CellSelect";
import LeadPicker from "./LeadPicker";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
const dayInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Members first — the people already on the project are the likely owners. */
async function ownerOptions(projectId: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { holder: "asc" },
  });
  return members.map((m) => ({
    value: m.employee.id,
    label: `${m.employee.firstName} ${m.employee.lastName} — ${m.holder}`,
  }));
}

function OwnerField({ options }: { options: { value: string; label: string }[] }) {
  return (
    <select name="ownerId" defaultValue="" title="Owner" aria-label="Owner">
      <option value="">{options.length ? "— owner —" : "— add members first —"}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const Owner = ({ o }: { o: { firstName: string; lastName: string } | null }) =>
  o ? <>{o.firstName} {o.lastName}</> : <span className="muted">nobody</span>;

export default async function ProjectDetail({
  projectId,
  view,
  edit,
}: {
  projectId: string;
  view: string;
  /** Id of the milestone being renamed, from ?edit= — one row at a time. */
  edit?: string;
}) {
  if (view === "milestone") {
    const [rows, owners] = await Promise.all([
      prisma.milestone.findMany({
        where: { projectId },
        // The run is the order the user set, not the order the dates imply.
        orderBy: [{ seq: "asc" }, { createdAt: "asc" }],
        include: {
          owner: { select: { firstName: true, lastName: true } },
          tasks: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
        },
      }),
      ownerOptions(projectId),
    ]);
    const doneCount = rows.filter((r) => r.status === "Done").length;

    // The current milestone: the next one still to be reached, soonest first.
    // Undated ones fall behind dated ones rather than jumping the queue.
    const base = `/project/project/${projectId}/milestone`;
    const outstanding = rows.filter((r) => r.status !== "Done" && r.status !== "Missed");
    // Sequential, so the current one is simply the first still to be reached.
    const current = outstanding.find((r) => r.status === "In Progress") ?? outstanding[0] ?? null;

    // The table shows the run in order. Pulling the current one to the top
    // would fight the arrows the user just pressed.
    const ordered = rows;

    return (
      <>
        {current && (
          <div className="panel current">
            <div className="cat-head">
              <span className="pill s-PENDING">Current milestone</span>
              <span className="spacer" />
              {current.dueDate && (
                <span className={current.dueDate < new Date() ? undefined : "tree-meta"}>
                  due {day(current.dueDate)}
                  {current.dueDate < new Date() && <span className="you">overdue</span>}
                </span>
              )}
            </div>
            <h2 style={{ marginTop: 6 }}>{current.name}</h2>
            {current.description && <p>{current.description}</p>}
            <dl className="tmeta wide">
              <div><dt>Status</dt><dd>{current.status}</dd></div>
              <div>
                <dt>Owner</dt>
                <dd>{current.owner ? `${current.owner.firstName} ${current.owner.lastName}` : "—"}</dd>
              </div>
              <div><dt>Position</dt><dd>{rows.findIndex((r) => r.id === current.id) + 1} of {rows.length}</dd></div>
            </dl>
          </div>
        )}

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="cat-head">
            <h2>Milestones <span className="count">{rows.length}</span></h2>
            <span className="spacer" />
            {rows.length > 0 && <span className="tree-meta">{doneCount} of {rows.length} done</span>}
          </div>

          {/* One row, above the list it feeds — the list stays in view while
              typing, and the next entry is one tab away. */}
          <form action={addMilestone} className="addrow msrow">
            <input type="hidden" name="projectId" value={projectId} />
            <input name="name" required placeholder="Milestone" autoComplete="off" />
            <input name="description" placeholder="Description (optional)" autoComplete="off" />
            <input name="dueDate" type="date" title="Due date" aria-label="Due date" />
            <OwnerField options={owners} />
            <select name="status" defaultValue="Pending" title="Status" aria-label="Status">
              {MILESTONE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="save icon" type="submit" title="Add milestone" aria-label="Add milestone">
              <IconPlus />
            </button>
          </form>
          {rows.length === 0 ? (
            <p style={{ marginTop: 16 }}>No milestones yet.</p>
          ) : (
            <div className="tablewrap">
              <table className="utable">
                <thead><tr>
                  <th className="numcol">No.</th><th>Milestone</th><th>Due</th>
                  <th>Owner</th><th>Status</th><th>Completed</th><th />
                </tr></thead>
                <tbody>
                  {ordered.map((m, i) => {
                    const late = m.dueDate && m.dueDate < new Date() && m.status !== "Done";
                    const open = m.tasks.filter((t) => t.status !== "Closed").length;
                    return (
                      <Fragment key={m.id}>
                        <tr className={m.id === current?.id ? "iscurrent" : undefined}>
                          <td className="numcol">{i + 1}</td>
                          <td>
                            {m.id === edit ? (
                              // The whole form lives in this one cell — a form
                              // cannot span table cells and keep its values.
                              <form action={renameMilestone} className="renameform">
                                <input type="hidden" name="milestoneId" value={m.id} />
                                <input name="name" defaultValue={m.name} required autoFocus
                                  aria-label="Milestone name" />
                                <input name="description" defaultValue={m.description ?? ""}
                                  placeholder="Description (optional)" aria-label="Description" />
                                <button className="save icon" type="submit" title="Save" aria-label="Save">
                                  <IconSave />
                                </button>
                                <Link className="subtab" href={base}>Cancel</Link>
                              </form>
                            ) : (
                              <>
                                <b>{m.name}</b>
                                {m.description && <span className="muted"> — {m.description}</span>}
                              </>
                            )}
                          </td>
                          <td className={late ? "nowrap" : "muted nowrap"}>
                            {day(m.dueDate)}{late && <span className="you">overdue</span>}
                          </td>
                          <td><Owner o={m.owner} /></td>
                          <td>
                            <form action={setMilestoneStatus}>
                              <input type="hidden" name="milestoneId" value={m.id} />
                              <CellSelect name="status" defaultValue={m.status}
                                options={MILESTONE_STATUS.map((s) => ({ value: s, label: s }))} />
                            </form>
                          </td>
                          <td className="muted nowrap">{day(m.completedAt)}</td>
                          <td className="rowacts">
                            {/* Sequential, so the run is reordered by hand.
                                Disabled at the ends rather than hidden, so the
                                buttons do not shift as rows move. */}
                            <form action={moveMilestone.bind(null, m.id, "up")}>
                              <button className="ghost icon" type="submit" disabled={i === 0}
                                title="Move up" aria-label="Move up"><IconUp /></button>
                            </form>
                            <form action={moveMilestone.bind(null, m.id, "down")}>
                              <button className="ghost icon" type="submit" disabled={i === ordered.length - 1}
                                title="Move down" aria-label="Move down"><IconDown /></button>
                            </form>
                            <Link className="ghost icon" href={`${base}?edit=${m.id}`}
                              title="Rename" aria-label="Rename"><IconEdit /></Link>
                            {/* A milestone carrying tasks cannot be deleted —
                                removing it would take its tasks with it. */}
                            {m.tasks.length > 0 ? (
                              <button className="reject icon" type="button" disabled
                                title={`Has ${m.tasks.length} task${m.tasks.length === 1 ? "" : "s"} — delete those first`}
                                aria-label="Delete unavailable while this milestone has tasks">
                                <IconTrash />
                              </button>
                            ) : (
                              <form action={deleteMilestone.bind(null, m.id)}>
                                <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                              </form>
                            )}
                          </td>
                        </tr>

                        {/* Tasks belong to the milestone above, so they sit in
                            its row rather than in a table of their own. */}
                        <tr className="subrow">
                          <td />
                          <td colSpan={6}>
                            <div className="subtasks">
                              <div className="subhead">
                                <span className="tree-meta">Tasks</span>
                                <span className="count">{m.tasks.length}</span>
                                {open > 0 && <span className="tree-meta">{open} open</span>}
                              </div>

                              {m.tasks.map((t) => (
                                <div className="taskline" key={t.id}>
                                  <span className="taskname">
                                    <b>{t.name}</b>
                                    {t.description && <span className="muted"> — {t.description}</span>}
                                  </span>
                                  <span className="muted nowrap" title="Started on">{day(t.startedAt)}</span>
                                  <span className="muted nowrap" title="Closed on">{day(t.closedAt)}</span>
                                  <form action={setMilestoneTaskStatus}>
                                    <input type="hidden" name="taskId" value={t.id} />
                                    <CellSelect name="status" defaultValue={t.status}
                                      options={TASK_STATUS.map((v) => ({ value: v, label: v }))} />
                                  </form>
                                  <form action={deleteMilestoneTask.bind(null, t.id)}>
                                    <button className="reject icon" type="submit" title="Delete task" aria-label="Delete task"><IconTrash /></button>
                                  </form>
                                </div>
                              ))}

                              <form action={addMilestoneTask} className="addrow taskadd">
                                <input type="hidden" name="milestoneId" value={m.id} />
                                <input name="name" required placeholder="Task" autoComplete="off" />
                                <input name="description" placeholder="Description (optional)" autoComplete="off" />
                                <input name="startedAt" type="date" title="Started on" aria-label="Started on" />
                                <input name="closedAt" type="date" title="Closed on" aria-label="Closed on" />
                                <select name="status" defaultValue="Open" title="Status" aria-label="Status">
                                  {TASK_STATUS.map((v) => <option key={v} value={v}>{v}</option>)}
                                </select>
                                <button className="save icon" type="submit" title="Add task" aria-label="Add task">
                                  <IconPlus />
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  if (view === "roadblocks") {
    const [rows, owners] = await Promise.all([
      prisma.roadblock.findMany({
        where: { projectId },
        orderBy: [{ status: "asc" }, { raisedAt: "desc" }],
        include: { owner: { select: { firstName: true, lastName: true } } },
      }),
      ownerOptions(projectId),
    ]);
    const open = rows.filter((r) => r.status !== "Resolved").length;

    return (
      <>
        <div className="panel">
          <h2>Raise a roadblock</h2>
          <p>Something stopping the work now — a risk that has already happened.</p>
          <form action={addRoadblock} className="statgrid">
            <input type="hidden" name="projectId" value={projectId} />
            <label className="statfield full"><span>What is blocking the work?</span>
              <textarea name="description" rows={2} required /></label>
            <label className="statfield"><span>Severity</span>
              <select name="severity" defaultValue="Medium">
                {SEVERITY.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <label className="statfield"><span>Status</span>
              <select name="status" defaultValue="Open">
                {ROADBLOCK_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <OwnerField options={owners} />
            <div className="statacts">
              <button className="btn-primary" type="submit"><IconPlus /> Raise roadblock</button>
            </div>
          </form>
        </div>

        <div className="panel" style={{ marginTop: 18 }}>
          <div className="cat-head">
            <h2>Roadblocks <span className="count">{rows.length}</span></h2>
            <span className="spacer" />
            {open > 0 && <span className="pill s-REJECTED">{open} unresolved</span>}
          </div>
          {rows.length === 0 ? (
            <p style={{ marginTop: 16 }}>Nothing blocking this project.</p>
          ) : (
            <div className="tablewrap">
              <table className="utable">
                <thead><tr>
                  <th className="numcol">No.</th><th>Roadblock</th><th>Severity</th>
                  <th>Owner</th><th>Status</th><th>Raised</th><th>Resolved</th><th />
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="numcol">{i + 1}</td>
                      <td>{r.description}</td>
                      <td>
                        <span className={`pill ${r.severity === "Critical" || r.severity === "High" ? "s-REJECTED" : "s-PENDING"}`}>
                          {r.severity}
                        </span>
                      </td>
                      <td><Owner o={r.owner} /></td>
                      <td>
                        <form action={setRoadblockStatus}>
                          <input type="hidden" name="roadblockId" value={r.id} />
                          <CellSelect name="status" defaultValue={r.status}
                            options={ROADBLOCK_STATUS.map((s) => ({ value: s, label: s }))} />
                        </form>
                      </td>
                      <td className="muted nowrap">{day(r.raisedAt)}</td>
                      <td className="muted nowrap">{day(r.resolvedAt)}</td>
                      <td className="rowacts">
                        <form action={deleteRoadblock.bind(null, r.id)}>
                          <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  if (view === "risks") {
    const [rows, owners] = await Promise.all([
      prisma.risk.findMany({
        where: { projectId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: { owner: { select: { firstName: true, lastName: true } } },
      }),
      ownerOptions(projectId),
    ]);
    const live = rows.filter((r) => r.status === "Open").length;

    return (
      <>
        <div className="panel">
          <h2>Log a risk</h2>
          <p>Something that might go wrong. Once it has, raise it as a roadblock instead.</p>
          <form action={addRisk} className="statgrid">
            <input type="hidden" name="projectId" value={projectId} />
            <label className="statfield full"><span>Risk</span>
              <textarea name="description" rows={2} required /></label>
            <label className="statfield"><span>Likelihood</span>
              <select name="likelihood" defaultValue="Medium">
                {LIKELIHOOD.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <label className="statfield"><span>Impact</span>
              <select name="impact" defaultValue="Medium">
                {LIKELIHOOD.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <label className="statfield"><span>Status</span>
              <select name="status" defaultValue="Open">
                {RISK_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <OwnerField options={owners} />
            <label className="statfield full"><span>Mitigation</span>
              <textarea name="mitigation" rows={2} placeholder="What reduces it?" /></label>
            <div className="statacts">
              <button className="btn-primary" type="submit"><IconPlus /> Log risk</button>
            </div>
          </form>
        </div>

        <div className="panel" style={{ marginTop: 18 }}>
          <div className="cat-head">
            <h2>Risks <span className="count">{rows.length}</span></h2>
            <span className="spacer" />
            {live > 0 && <span className="pill s-PENDING">{live} open</span>}
          </div>
          {rows.length === 0 ? (
            <p style={{ marginTop: 16 }}>No risks logged.</p>
          ) : (
            <div className="tablewrap">
              <table className="utable">
                <thead><tr>
                  <th className="numcol">No.</th><th>Risk</th><th>Likelihood</th><th>Impact</th>
                  <th>Mitigation</th><th>Owner</th><th>Status</th><th />
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="numcol">{i + 1}</td>
                      <td>{r.description}</td>
                      <td className="muted">{r.likelihood}</td>
                      <td className="muted">{r.impact}</td>
                      <td className="muted">{r.mitigation ?? "—"}</td>
                      <td><Owner o={r.owner} /></td>
                      <td>
                        <form action={setRiskStatus}>
                          <input type="hidden" name="riskId" value={r.id} />
                          <CellSelect name="status" defaultValue={r.status}
                            options={RISK_STATUS.map((s) => ({ value: s, label: s }))} />
                        </form>
                      </td>
                      <td className="rowacts">
                        <form action={deleteRisk.bind(null, r.id)}>
                          <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  // Project Info
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      user: { select: { name: true } },
      members: {
        orderBy: { holder: "asc" },
        include: { employee: { select: { firstName: true, lastName: true, jobTitle: true } } },
      },
      manager: { select: { firstName: true, lastName: true, jobTitle: true } },
      oicManager: { select: { firstName: true, lastName: true, jobTitle: true } },
      _count: { select: { milestones: true, roadblocks: true, risks: true } },
    },
  });
  if (!p) return <div className="panel"><p>That project no longer exists.</p></div>;

  // Only active staff can hold a role, and only BOUs with someone in them are
  // worth offering.
  const staffRows = await prisma.employee.findMany({
    where: { status: 0 },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, jobTitle: true, bouId: true },
  });
  const staff = staffRows.map((e) => ({
    id: e.id, name: `${e.lastName}, ${e.firstName}`, jobTitle: e.jobTitle, bouId: e.bouId,
  }));
  const bouCounts = new Map<string, number>();
  for (const e of staffRows) if (e.bouId) bouCounts.set(e.bouId, (bouCounts.get(e.bouId) ?? 0) + 1);
  const bous = (await prisma.bou.findMany({ where: { isActive: true }, select: { id: true, name: true } }))
    .filter((b) => bouCounts.has(b.id))
    .map((b) => ({ id: b.id, name: b.name, count: bouCounts.get(b.id)! }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="panel">
        <h2>Project Info</h2>
        <form action={saveProjectInfo} className="statgrid">
          <input type="hidden" name="projectId" value={p.id} />
          <label className="statfield"><span>Project name</span>
            <input name="name" defaultValue={p.name} required /></label>
          <label className="statfield"><span>Status</span>
            <select name="status" defaultValue={p.status}>
              {PROJECT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label>
          <label className="statfield"><span>Date launched</span>
            <input name="launchedAt" type="date" defaultValue={dayInput(p.launchedAt)} /></label>
          <label className="statfield"><span>Date closed</span>
            <input name="closedAt" type="date" defaultValue={dayInput(p.closedAt)} /></label>
          <label className="statfield full"><span>Customer</span>
            <input name="customer" defaultValue={p.customer ?? ""} autoComplete="off"
              placeholder="Who the work is for" /></label>
          <label className="statfield full"><span>Project description</span>
            <textarea name="description" rows={3} defaultValue={p.description ?? ""} /></label>

          <LeadPicker
            label="Project Manager"
            name="managerId"
            staff={staff}
            bous={bous}
            selected={p.managerId ?? ""}
          />
          <LeadPicker
            label="OIC Project Manager"
            name="oicManagerId"
            staff={staff}
            bous={bous}
            selected={p.oicManagerId ?? ""}
            hint="covers when the manager cannot"
          />

          <div className="statacts">
            <button className="btn-primary" type="submit"><IconSave /> Save project</button>
          </div>
        </form>

        <p className="secdiv">At a glance</p>
        <dl className="tmeta wide">
          <div><dt>Owner</dt><dd>{p.user.name}</dd></div>
          <div>
            <dt>Project Manager</dt>
            <dd>{p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : "—"}</dd>
          </div>
          <div>
            <dt>OIC Project Manager</dt>
            <dd>{p.oicManager ? `${p.oicManager.firstName} ${p.oicManager.lastName}` : "—"}</dd>
          </div>
          <div><dt>Members</dt><dd>{p.members.length}</dd></div>
          <div><dt>Milestones</dt><dd>{p._count.milestones}</dd></div>
          <div><dt>Roadblocks</dt><dd>{p._count.roadblocks}</dd></div>
          <div><dt>Risks</dt><dd>{p._count.risks}</dd></div>
        </dl>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Members <span className="count">{p.members.length}</span></h2>
        {p.members.length === 0 ? (
          <p style={{ marginTop: 16 }}>Nobody assigned — add members from the Projects list.</p>
        ) : (
          <div className="memberlist" style={{ marginTop: 12 }}>
            {p.members.map((m) => (
              <div className="memberrow" key={m.id}>
                <span className="mname">
                  <b>{m.employee.firstName} {m.employee.lastName}</b>
                  {m.employee.jobTitle && <span className="tree-meta"> {m.employee.jobTitle}</span>}
                </span>
                <span className="pill s-ACTIVE">{m.holder}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
