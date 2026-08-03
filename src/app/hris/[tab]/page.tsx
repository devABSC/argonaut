import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";
import EmployeeList from "../EmployeeList";

export default async function HrisTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { tab } = await params;
  const { q, page } = await searchParams;

  const { user, nav, section, tab: active } = await requireAccess("hris", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
      {active.slug === "employees" ? (
        <EmployeeList q={q ?? ""} page={Math.max(1, Number(page) || 1)} />
      ) : (
        <div className="panel">
          <h2>{active.label}</h2>
          <p>Pick an employee from the Employees tab — this view is per-person and not wired up yet.</p>
        </div>
      )}
    </AppShell>
  );
}
