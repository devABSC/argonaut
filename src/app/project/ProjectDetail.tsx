import { prisma } from "@/lib/prisma";
import {
  PROJECT_STATUS, MILESTONE_STATUS, ROADBLOCK_STATUS, RISK_STATUS,
  SEVERITY, LIKELIHOOD, SUB_PILL,
} from "@/lib/projects";
import {
  saveProjectInfo,
  addMilestone, setMilestoneStatus, deleteMilestone,
  addRoadblock, setRoadblockStatus, deleteRoadblock,
  addRisk, setRiskStatus, deleteRisk,
} from "../actions/project-detail";
import { IconSave, IconTrash, IconPlus } from "../icons";
import CellSelect from "../settings/CellSelect";

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
    <label className="statfield">
      <span>Owner</span>
      <select name="ownerId" defaultValue="">
        <option value="">
          {options.length ? "— nobody —" : "— add members first —"}
        </option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

const Owner = ({ o }: { o: { firstName: string; lastName: string } | null }) =>
  o ? <>{o.firstName} {o.lastName}</> : <span className="muted">nobody</span>;

export default async function ProjectDetail({
  projectId,
  view,
}: {
  projectId: string;
  view: string;
}) {
  if (view === "milestone") {
    const [rows, owners] = await Promise.all([
      prisma.milestone.findMany({
        where: { projectId },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        include: { owner: { select: { firstName: true, lastName: true } } },
      }),
      ownerOptions(projectId),
    ]);
    const doneCount = rows.filter((r) => r.status === "Done").length;

    return (
      <>
        <div className="panel">
          <h2>Add a milestone</h2>
          <form action={addMilestone} className="statgrid">
            <input type="hidden" name="projectId" value={projectId} />
            <label className="statfield"><span>Milestone</span>
              <input name="name" required placeholder="What is being reached?" /></label>
            <label className="statfield"><span>Due date</span>
              <input name="dueDate" type="date" /></label>
            <label className="statfield"><span>Status</span>
              <select name="status" defaultValue="Pending">
                {MILESTONE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <OwnerField options={owners} />
            <label className="statfield full"><span>Description</span>
              <textarea name="description" rows={2} /></label>
            <div className="statacts">
              <button className="btn-primary" type="submit"><IconPlus /> Add milestone</button>
            </div>
          </form>
        </div>

        <div className="panel" style={{ marginTop: 18 }}>
          <div className="cat-head">
            <h2>Milestones <span className="count">{rows.length}</span></h2>
            <span className="spacer" />
            {rows.length > 0 && <span className="tree-meta">{doneCount} of {rows.length} done</span>}
          </div>
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
                  {rows.map((m, i) => {
                    const late = m.dueDate && m.dueDate < new Date() && m.status !== "Done";
                    return (
                      <tr key={m.id}>
                        <td className="numcol">{i + 1}</td>
                        <td>
                          <b>{m.name}</b>
                          {m.description && <span className="muted"> — {m.description}</span>}
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
                          <form action={deleteMilestone.bind(null, m.id)}>
                            <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                          </form>
                        </td>
                      </tr>
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
      _count: { select: { milestones: true, roadblocks: true, risks: true } },
    },
  });
  if (!p) return <div className="panel"><p>That project no longer exists.</p></div>;

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
          <label className="statfield full"><span>Project description</span>
            <textarea name="description" rows={3} defaultValue={p.description ?? ""} /></label>
          <div className="statacts">
            <button className="btn-primary" type="submit"><IconSave /> Save project</button>
          </div>
        </form>

        <p className="secdiv">At a glance</p>
        <dl className="tmeta wide">
          <div><dt>Owner</dt><dd>{p.user.name}</dd></div>
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
