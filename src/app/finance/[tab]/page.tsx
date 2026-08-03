import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import { findSection, FINANCE_CONFIG_TABS } from "@/lib/nav";
import AppShell, { type TopTab } from "../../AppShell";
import CashAdvanceList from "../CashAdvanceList";

export default async function FinanceTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("finance", tab);

  // The strip belongs to Expenses / Cash Adv / Bills only. BIR, Payroll,
  // Payable and Receivable are their own pages in the left pane and do not
  // carry a copy of it.
  const strip = findSection("finance")?.topTabs ?? [];
  const onStrip = strip.some((t) => t.slug === active.slug);
  // Config carries its own strip; Chart of Accounts sits under it rather than
  // beside Payroll and Payable in the left pane.
  const inConfig = active.slug === "config" || FINANCE_CONFIG_TABS.some((t) => t.slug === active.slug);

  const topTabs: TopTab[] = inConfig
    ? FINANCE_CONFIG_TABS.map((t) => ({
        href: `/finance/${t.slug}`,
        label: t.label,
        title: t.title,
        on: t.slug === active.slug || (active.slug === "config" && t.slug === FINANCE_CONFIG_TABS[0].slug),
      }))
    : onStrip
      ? strip.map((t) => ({ href: `/finance/${t.slug}`, label: t.label, on: t.slug === active.slug }))
      : [];

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
      ) : inConfig ? (
        <div className="panel">
          <h2>Chart of Accounts</h2>
          <p>
            The account codes everything in Finance posts against. Not built
            yet — say what the code structure should look like and it can be.
          </p>
        </div>
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
