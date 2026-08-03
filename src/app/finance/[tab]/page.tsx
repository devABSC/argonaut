import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import { findSection } from "@/lib/nav";
import AppShell, { type TopTab } from "../../AppShell";
import CashAdvanceList from "../CashAdvanceList";

export default async function FinanceTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("finance", tab);

  // The left pane carries BIR / Payroll / Payable / Receivable; this strip is
  // the same on every one of them, so it comes straight from the nav.
  const topTabs: TopTab[] = (findSection("finance")?.topTabs ?? []).map((t) => ({
    href: `/finance/${t.slug}`,
    label: t.label,
    on: t.slug === active.slug,
  }));

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
      topTabs={topTabs}
    >
      {active.slug === "cash-advance" ? (
        <CashAdvanceList />
      ) : (
        <div className="panel">
          <h2>{active.label}</h2>
          <p>
            This page is wired up and role-gated, but has no fields yet — the{" "}
            {active.label} data model is still to be specified.
          </p>
        </div>
      )}
    </AppShell>
  );
}
