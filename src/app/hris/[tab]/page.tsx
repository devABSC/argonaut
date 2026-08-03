import { redirect } from "next/navigation";
import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";
import EmployeeList from "../EmployeeList";
import { isEmpView } from "../EmployeeTabs";

export default async function HrisTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ q?: string; page?: string; bou?: string; dept?: string; company?: string; emp?: string; added?: string; name?: string }>;
}) {
  const { tab } = await params;
  const { q, page, bou, dept, company, emp, added, name } = await searchParams;

  // The per-employee views moved into a person's record. Old links still land.
  if (isEmpView(tab)) {
    redirect(emp ? `/hris/employee/${emp}/${tab}` : "/hris/employees");
  }

  const { user, nav, section, tab: active } = await requireAccess("hris", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
      {active.slug === "employees" ? (
        <EmployeeList
          q={q ?? ""}
          bou={bou ?? ""}
          dept={dept ?? ""}
          company={company ?? ""}
          page={Math.max(1, Number(page) || 1)}
          viewer={{ role: user.role, company: user.company }}
          added={added}
          addedName={name}
        />
      ) : (
        <div className="panel">
          <h2>{active.label}</h2>
          <p>
            This page is wired up and role-gated, but has no fields yet — say
            what {active.label} should hold and it can be built.
          </p>
        </div>
      )}
    </AppShell>
  );
}
