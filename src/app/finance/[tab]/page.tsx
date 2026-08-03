import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import { findSection, FINANCE_CONFIG_TABS, FINANCE_RECEIVABLE_TABS } from "@/lib/nav";
import AppShell, { type TopTab } from "../../AppShell";
import CashAdvanceList from "../CashAdvanceList";
import SoaPanel from "../SoaPanel";

export default async function FinanceTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ bou?: string; emp?: string; ref?: string; editLine?: string; receipt?: string }>;
}) {
  const { tab } = await params;
  const { bou, emp, ref, editLine, receipt } = await searchParams;
  const { user, nav, section, tab: active } = await requireAccess("finance", tab);

  // The strip belongs to Expenses / Cash Adv / Bills only. BIR, Payroll,
  // Payable and Receivable are their own pages in the left pane and do not
  // carry a copy of it.
  const strip = findSection("finance")?.topTabs ?? [];
  const onStrip = strip.some((t) => t.slug === active.slug);
  // Config carries its own strip; Chart of Accounts sits under it rather than
  // beside Payroll and Payable in the left pane.
  const inConfig = active.slug === "config" || FINANCE_CONFIG_TABS.some((t) => t.slug === active.slug);
  // Receivable carries its own strip the same way Config does.
  const inReceivable =
    active.slug === "receivable" || FINANCE_RECEIVABLE_TABS.some((t) => t.slug === active.slug);

  const sub =
    inConfig ? { tabs: FINANCE_CONFIG_TABS, parent: "config" }
    : inReceivable ? { tabs: FINANCE_RECEIVABLE_TABS, parent: "receivable" }
    : null;

  const topTabs: TopTab[] = sub
    ? sub.tabs.map((t) => ({
        href: `/finance/${t.slug}`,
        label: t.label,
        title: t.title,
        on: t.slug === active.slug || (active.slug === sub.parent && t.slug === sub.tabs[0].slug),
      }))
    : onStrip
      ? strip.map((t) => ({ href: `/finance/${t.slug}`, label: t.label, title: t.title, on: t.slug === active.slug }))
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
      ) : active.slug === "soa" ? (
        <SoaPanel bou={bou} emp={emp} soaRef={ref} editLine={editLine} receipt={receipt}
          viewer={{ id: user.id, role: user.role, email: user.email }} />
      ) : inReceivable ? (
        <div className="panel">
          <h2>Ageing</h2>
          <p>
            How long each receivable has been outstanding. Not built yet — say
            which buckets you want (30 / 60 / 90 days, or your own) and it can be.
          </p>
        </div>
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
