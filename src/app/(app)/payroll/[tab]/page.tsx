import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";

export default async function PayrollTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("payroll", tab);

  return (
    <>
      <div className="panel">
        <h2>{active.label}</h2>
        <p>
          This page is wired up and role-gated, but has no fields yet — say what
          {" "}{active.label} should hold and it can be built.
        </p>
      </div>
    </>
  );
}
