import { prisma } from "@/lib/prisma";
import { createTask, updateTask, deleteTask } from "../actions/tasks";
import { IconSave, IconTrash, IconPlus } from "../icons";

/** Master list of task names. Nothing consumes it yet — it is a reference list. */
export default async function TasksPanel() {
  const tasks = await prisma.task.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="panel">
      <h2>Tasks <span className="count">{tasks.length}</span></h2>
      <p>The list of task names and what each one means.</p>

      <div className="fields">
        <div className="frow thead2">
          <span>Task name</span><span>Description</span><span />
        </div>

        {tasks.length === 0 ? (
          <p className="pvempty" style={{ padding: "12px 2px" }}>
            No tasks yet — add the first one below.
          </p>
        ) : (
          tasks.map((t) => (
            <form className="frow trow" action={updateTask} key={t.id}>
              <input type="hidden" name="taskId" value={t.id} />
              <input name="name" defaultValue={t.name} required />
              <input name="description" defaultValue={t.description ?? ""} placeholder="What this task involves" />
              <span className="rowacts">
                <button className="save icon" type="submit" title="Save" aria-label="Save">
                  <IconSave />
                </button>
                <button
                  className="reject icon" type="submit" title="Delete" aria-label="Delete"
                  formAction={deleteTask.bind(null, t.id)}
                >
                  <IconTrash />
                </button>
              </span>
            </form>
          ))
        )}

        <form className="frow trow fadd" action={createTask}>
          <input name="name" placeholder="New task name — e.g. Verify payslip" required />
          <input name="description" placeholder="Description (optional)" />
          <button className="save icon" type="submit" title="Add task" aria-label="Add task">
            <IconPlus />
          </button>
        </form>
      </div>
    </div>
  );
}
