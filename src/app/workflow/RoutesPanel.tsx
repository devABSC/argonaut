import { prisma } from "@/lib/prisma";
import { addStep, saveStep, deleteStep } from "../actions/routes";
import { IconSave, IconTrash, IconPlus } from "../icons";
import SubtypePicker from "./SubtypePicker";
import StepActorCells from "./StepActorCells";

/**
 * The route for one subtype: sequential steps, each with a status, an SLA and
 * the people who act on it. A ticket copies the chain when submitted.
 */
export default async function RoutesPanel({ subId }: { subId?: string }) {
  const [cats, users, tasks] = await Promise.all([
    prisma.requestCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        subcategories: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.task.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  const options = cats.flatMap((c) =>
    c.subcategories.map((s) => ({ id: s.id, label: `${c.name} ${s.name}` })),
  );

  const sub = subId
    ? await prisma.requestSubcategory.findUnique({
        where: { id: subId },
        include: {
          category: { select: { name: true } },
          steps: {
            orderBy: { sequence: "asc" },
            include: { approvers: { select: { userId: true } } },
          },
        },
      })
    : null;

  const statusOptions = tasks.map((t) => t.name);

  return (
    <>
      <div className="panel">
        <h2>Route</h2>
        <p>
          Pick a subtype, then define the steps a ticket moves through. Step
          names come from the Tasks list. A subtype with no steps is approved on
          submission.
        </p>
        <SubtypePicker
          options={options}
          selected={sub?.id ?? ""}
          basePath="/workflow/routes"
          param="sub"
        />
      </div>

      {sub && (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="cat-head">
            <h2>{sub.category.name} › {sub.name}</h2>
            <span className="spacer" />
            <span className="tree-meta">{sub.steps.length} step{sub.steps.length === 1 ? "" : "s"}</span>
          </div>

          {statusOptions.length === 0 && (
            <p className="pvhelp" style={{ marginTop: 10 }}>
              No tasks defined yet — add them on the Tasks tab and they become the
              route status choices here.
            </p>
          )}

          <div className="fields steps">
            <div className="frow srow shead">
              <span>Steps</span><span>Route Status</span><span>Description</span>
              <span>SLA</span><span>User Role</span><span>Approvers</span><span>Groups</span><span />
            </div>

            {sub.steps.map((st) => {
              const chosen = st.approvers.map((a) => a.userId);
              return (
                <form className="frow srow" action={saveStep} key={st.id}>
                  <input type="hidden" name="stepId" value={st.id} />
                  <span className="seqbox">{st.sequence}</span>

                  <select name="name" defaultValue={st.name}>
                    {!statusOptions.includes(st.name) && <option value={st.name}>{st.name}</option>}
                    {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <input name="description" defaultValue={st.description ?? ""} placeholder="What happens here" />
                  <input name="slaDays" type="number" min="1" defaultValue={st.slaDays} />

                  <StepActorCells actor={st.actor} users={users} selected={chosen} />

                  <select name="groupName" defaultValue={st.groupName ?? ""} disabled>
                    <option value="">Select</option>
                  </select>

                  <span className="rowacts">
                    <button className="save icon" type="submit" title="Save" aria-label="Save"><IconSave /></button>
                    <button
                      className="reject icon" type="submit" title="Delete" aria-label="Delete"
                      formAction={deleteStep.bind(null, st.id)}
                    ><IconTrash /></button>
                  </span>
                </form>
              );
            })}

            <form className="frow srow fadd" action={addStep}>
              <input type="hidden" name="subcategoryId" value={sub.id} />
              <span className="seqbox">{sub.steps.length + 1}</span>

              <select name="name" defaultValue="" required>
                <option value="" disabled>Select Route</option>
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <input name="description" placeholder="What happens here" />
              <input name="slaDays" type="number" min="1" defaultValue={1} />

              <StepActorCells actor="APPROVER" users={users} />

              <select name="groupName" defaultValue="" disabled>
                <option value="">Select</option>
              </select>

              <span className="rowacts">
                <button className="add icon" type="submit" title="Add step" aria-label="Add step">
                  <IconPlus />
                </button>
              </span>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
