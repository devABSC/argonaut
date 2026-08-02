import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { addStep, saveStep, deleteStep, deleteRoute } from "../actions/routes";
import { IconSave, IconTrash, IconPlus, IconEdit } from "../icons";
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
          select: { id: true, name: true, _count: { select: { steps: true } } },
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

  // Subtypes that already have a route configured.
  const configured = cats.flatMap((c) =>
    c.subcategories
      .filter((x) => x._count.steps > 0)
      .map((x) => ({ id: x.id, name: x.name, categoryName: c.name, steps: x._count.steps })),
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

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Existing routes <span className="count">{configured.length}</span></h2>
        {configured.length === 0 ? (
          <p style={{ marginTop: 14 }}>No routes defined yet — pick a subtype above and add steps.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable">
              <thead>
                <tr><th className="numcol">No.</th><th>Service Type</th><th>Subtype</th><th>Steps</th><th /></tr>
              </thead>
              <tbody>
                {configured.map((r, i) => (
                  <tr key={r.id}>
                    <td className="numcol">{i + 1}</td>
                    <td className="muted">{r.categoryName}</td>
                    <td><b>{r.name}</b></td>
                    <td><span className="pill s-ACTIVE">{r.steps} step{r.steps === 1 ? "" : "s"}</span></td>
                    <td className="rowacts">
                      <Link className="save icon" href={`/workflow/routes?sub=${r.id}`} title="Edit" aria-label="Edit">
                        <IconEdit />
                      </Link>
                      <form action={deleteRoute.bind(null, r.id)}>
                        <button className="reject icon" type="submit" title="Delete route" aria-label="Delete route">
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
