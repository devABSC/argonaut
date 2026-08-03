import { prisma } from "@/lib/prisma";
import { createProjectTask, setTaskStatus, deleteProjectTask } from "../actions/tasks-project";
import { TASK_STATUS, TASK_PILL } from "@/lib/project-tasks";
import { IconTrash } from "../icons";
import CellSelect from "../settings/CellSelect";
import TaskAssign from "./TaskAssign";

const fmtDate = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : "—";

export default async function TaskList() {
  const [tasks, staffRows, bouRows] = await Promise.all([
    prisma.projectTask.findMany({
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { firstName: true, lastName: true, jobTitle: true } },
        bou: { select: { name: true } },
        createdBy: { select: { name: true } },
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
  }));

  // Only BOUs with someone assignable are worth offering.
  const counts = new Map<string, number>();
  for (const e of staffRows) if (e.bouId) counts.set(e.bouId, (counts.get(e.bouId) ?? 0) + 1);
  const bous = bouRows
    .filter((b) => counts.has(b.id))
    .map((b) => ({ id: b.id, name: b.name, count: counts.get(b.id)! }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const open = tasks.filter((t) => !["Done", "Cancelled"].includes(t.status)).length;
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < new Date() && !["Done", "Cancelled"].includes(t.status),
  ).length;

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Assign a task</h2>
          <span className="spacer" />
          <span className="tree-meta">{staff.length} active staff across {bous.length} BOUs</span>
        </div>
        <p>
          Write the task, choose the BOU, then pick who is doing it. Only active
          employees appear, and the list narrows to the BOU you choose.
        </p>
        <form action={createProjectTask}>
          <TaskAssign staff={staff} bous={bous} />
        </form>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="cat-head">
          <h2>Tasks <span className="count">{tasks.length}</span></h2>
          <span className="spacer" />
          {overdue > 0 && <span className="pill s-REJECTED">{overdue} overdue</span>}
          <span className="tree-meta">{open} open</span>
        </div>

        {tasks.length === 0 ? (
          <p style={{ marginTop: 16 }}>No tasks yet.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable">
              <thead>
                <tr>
                  <th className="numcol">No.</th>
                  <th>Task</th>
                  <th>BOU</th>
                  <th>Assignee</th>
                  <th>Due</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Raised by</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => {
                  const late =
                    t.dueDate && t.dueDate < new Date() && !["Done", "Cancelled"].includes(t.status);
                  return (
                    <tr key={t.id}>
                      <td className="numcol">{i + 1}</td>
                      <td>
                        {t.title && <b>{t.title}</b>}
                        <span className={t.title ? "muted" : undefined}>
                          {t.title ? ` — ${t.description}` : t.description}
                        </span>
                      </td>
                      <td className="muted">{t.bou?.name ?? "—"}</td>
                      <td>
                        {t.assignee ? (
                          <>
                            <b>{t.assignee.firstName} {t.assignee.lastName}</b>
                            {t.assignee.jobTitle && (
                              <span className="tree-meta"> {t.assignee.jobTitle}</span>
                            )}
                          </>
                        ) : (
                          <span className="muted">nobody assigned</span>
                        )}
                      </td>
                      <td className={late ? "nowrap" : "muted nowrap"}>
                        {fmtDate(t.dueDate)}
                        {late && <span className="you">overdue</span>}
                      </td>
                      <td className="muted">{t.priority}</td>
                      <td>
                        <form action={setTaskStatus}>
                          <input type="hidden" name="taskId" value={t.id} />
                          <CellSelect
                            name="status"
                            defaultValue={t.status}
                            options={TASK_STATUS.map((s) => ({ value: s, label: s }))}
                          />
                        </form>
                      </td>
                      <td className="muted">{t.createdBy?.name ?? "—"}</td>
                      <td className="rowacts">
                        <form action={deleteProjectTask.bind(null, t.id)}>
                          <button className="reject icon" type="submit" title="Delete" aria-label="Delete">
                            <IconTrash />
                          </button>
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
