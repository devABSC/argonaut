import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";

export default async function PayrollTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("payroll", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
      <div className="panel">
        <h2>{active.label}</h2>
        <p>
          This page is wired up and role-gated, but has no fields yet — say what
          {" "}{active.label} should hold and it can be built.
        </p>
      </div>
    </AppShell>
  );
}
