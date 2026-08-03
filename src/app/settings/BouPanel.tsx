import { prisma } from "@/lib/prisma";
import { saveBou, createBou, deleteBou } from "../actions/bou";
import ActiveToggle from "./ActiveToggle";
import Link from "next/link";
import { IconSave, IconTrash, IconPlus } from "../icons";

/** The BOU register. Only active BOUs are offered anywhere in HRIS. */
export default async function BouPanel({ showInactive = false }: { showInactive?: boolean }) {
  // Retired BOUs outnumber live ones, so they are hidden until asked for.
  const [bous, retired] = await Promise.all([
    prisma.bou.findMany({
      where: showInactive ? {} : { isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      // Active staff only — status 0 is active, 1 and above are leavers.
      include: { _count: { select: { employees: { where: { status: 0 } } } } },
    }),
    prisma.bou.count({ where: { isActive: false } }),
  ]);

  // Companies come from the register, so a BOU cannot be pointed at a code
  // that was never registered. Inactive ones are still offered when a BOU
  // already sits on them, rather than silently blanking the field.
  const companies = await prisma.company.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { code: true, name: true, isActive: true },
  });
  const inUse = new Set(bous.map((b) => b.companyCode).filter(Boolean));
  const options = companies.filter((c) => c.isActive || inUse.has(c.code));
  const orphan = (code: string) => code && !companies.some((c) => c.code === code);
  const active = bous.filter((b) => b.isActive).length;

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>
          Business Operating Units{" "}
          <span className="count">
            {active} active{showInactive ? ` of ${bous.length}` : ""}
          </span>
        </h2>
        <span className="spacer" />
        {retired > 0 && (
          <Link
            className="viewtoggle"
            href={showInactive ? "/settings/bou" : "/settings/bou?inactive=1"}
          >
            {showInactive ? `Hide ${retired} inactive` : `Show ${retired} inactive`}
          </Link>
        )}
      </div>
      <p>
        Flicking Active saves the row on the spot. Only active BOUs appear in
        the HRIS filters and on the employee form.
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
            <select name="companyCode" defaultValue={b.companyCode}>
              <option value="">— no company —</option>
              {options.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
              {/* A code the register never knew — kept so saving the row does
                  not quietly discard it. */}
              {orphan(b.companyCode) && (
                <option value={b.companyCode}>{b.companyCode} (unregistered)</option>
              )}
            </select>
            <input name="managerName" defaultValue={b.managerName ?? ""} placeholder="Manager" />
            <input name="managerEmail" type="email" defaultValue={b.managerEmail ?? ""} placeholder="manager@…" />
            <span className={b._count.employees > 0 ? "pill s-ACTIVE" : "tree-meta"}>
              {b._count.employees}
            </span>
            <ActiveToggle
              defaultChecked={b.isActive}
              label={b.isDefault ? "Default" : b.isActive ? "Active" : "Inactive"}
            />
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
          <select name="companyCode" defaultValue={options[0]?.code ?? ""}>
            <option value="">— no company —</option>
            {options.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
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
