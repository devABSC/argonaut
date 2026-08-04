import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import PersonalInfoPanel from "../../../PersonalInfoPanel";
import StatutoryPanel from "../../../StatutoryPanel";
import EmployeeTabs, { EMP_VIEWS, isEmpView } from "../../../EmployeeTabs";

/**
 * One employee's record, with its own tab strip. Access rides on the
 * Employees tab — anyone who may list people may open a person.
 */
export default async function EmployeeView({
  params,
}: {
  params: Promise<{ emp: string; view: string }>;
}) {
  const { emp, view } = await params;
  if (!isEmpView(view)) notFound();

  const { user, nav, section } = await requireAccess("hris", "employees");

  const person = await prisma.employee.findUnique({
    where: { id: emp },
    select: { individ: true, firstName: true, lastName: true, jobTitle: true },
  });
  if (!person) notFound();

  const label = EMP_VIEWS.find((v) => v.slug === view)!.label;
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ");

  return (
    <>
      <div className="viewbar">
        <Link className="viewtoggle" href="/hris/employees">← Back to employees</Link>
        <span className="spacer" />
        <span className="tree-meta">
          {name} · {person.individ}
        </span>
      </div>

      <EmployeeTabs empId={emp} active={view} />

      {view === "personal-info" ? (
        <PersonalInfoPanel empId={emp} />
      ) : view === "statutory" ? (
        <StatutoryPanel empId={emp} />
      ) : (
        <div className="panel">
          <h2>{label}</h2>
          <p>
            {label} for {name} is not wired up yet — the tab is here, the data
            behind it still has to be modelled.
          </p>
        </div>
      )}
    </>
  );
}
