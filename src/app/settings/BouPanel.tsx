import { prisma } from "@/lib/prisma";
import { saveBou, createBou, toggleBou, deleteBou } from "../actions/bou";
import { IconSave, IconTrash, IconPlus } from "../icons";

/** The BOU register. Only active BOUs are offered anywhere in HRIS. */
export default async function BouPanel() {
  const bous = await prisma.bou.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { employees: true } } },
  });
  const active = bous.filter((b) => b.isActive).length;

  return (
    <div className="panel">
      <h2>
        Business Operating Units{" "}
        <span className="count">{active} active of {bous.length}</span>
      </h2>
      <p>
        Only active BOUs appear in the HRIS filters and on the employee form.
        A BOU with employees cannot be deleted — deactivate it instead, which
        keeps existing records intact while stopping new assignments.
      </p>

      <div className="fields">
        <div className="frow bourow bouhead">
          <span>Code</span><span>Name</span><span>Company</span>
          <span>Manager</span><span>Manager email</span><span>Staff</span><span>Active</span><span />
        </div>

        {bous.map((b) => (
          <form className={`frow bourow ${b.isActive ? "" : "retired"}`} action={saveBou} key={b.id}>
            <input type="hidden" name="bouId" value={b.id} />
            <code className="rkey">{b.code}</code>
            <input name="name" defaultValue={b.name} required />
            <input name="companyCode" defaultValue={b.companyCode} />
            <input name="managerName" defaultValue={b.managerName ?? ""} placeholder="Manager" />
            <input name="managerEmail" type="email" defaultValue={b.managerEmail ?? ""} placeholder="manager@…" />
            <span className={b._count.employees > 0 ? "pill s-ACTIVE" : "tree-meta"}>
              {b._count.employees}
            </span>
            <label className="req">
              <input type="checkbox" name="isActive" defaultChecked={b.isActive} />
              {b.isDefault ? "Default" : "Active"}
            </label>
            <span className="rowacts">
              <button className="save icon" type="submit" title="Save" aria-label="Save"><IconSave /></button>
              <button
                className="reject icon" type="submit"
                title={b._count.employees > 0 ? `${b._count.employees} employees — deactivate instead` : "Delete"}
                aria-label="Delete"
                disabled={b._count.employees > 0}
                formAction={deleteBou.bind(null, b.id)}
              ><IconTrash /></button>
            </span>
          </form>
        ))}

        <form className="frow bourow fadd" action={createBou}>
          <input name="code" placeholder="B2026-00001" required />
          <input name="name" placeholder="BOU name" required />
          <input name="companyCode" placeholder="ATO01-165846" />
          <input name="managerName" placeholder="Manager" />
          <input name="managerEmail" type="email" placeholder="manager@…" />
          <span /><span />
          <span className="rowacts">
            <button className="save icon" type="submit" title="Add BOU" aria-label="Add BOU"><IconPlus /></button>
          </span>
        </form>
      </div>
    </div>
  );
}
