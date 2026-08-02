import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { visibleNav, findSection, canViewSection } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/rbac";
import AppShell, { type TopTab } from "../../AppShell";
import CatalogPanel from "../CatalogPanel";
import TreePanel from "../TreePanel";
import StandardPanel from "../StandardPanel";
import FormTypesPanel from "../FormTypesPanel";
import RoutesPanel from "../RoutesPanel";
import TasksPanel from "../TasksPanel";

export default async function WorkflowTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ view?: string; t?: string; preview?: string; form?: string }>;
}) {
  const { tab } = await params;
  const { view, t, preview, form } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewSection(user.role, "workflow")) notFound();

  const section = findSection("workflow");
  const active = section?.tabs.find((x) => x.slug === tab);
  if (!section || !active) notFound();

  const tree = view === "tree";
  const formsTab = t === "types" ? "types" : "standard";

  // Service Forms has its own strip; everything else shows Workflow | Routes.
  const topTabs: TopTab[] =
    active.slug === "service-forms"
      ? [
          { href: "/workflow/service-forms", label: "Standard", on: formsTab === "standard" },
          { href: "/workflow/service-forms?t=types", label: "Form Type", on: formsTab === "types" },
        ]
      : [
          { href: "/workflow/service-type", label: "Service Type", on: active.slug === "service-type" },
          { href: "/workflow/tasks", label: "Tasks", on: active.slug === "tasks" },
          { href: "/workflow/routes", label: "Routes", on: active.slug === "routes" },
        ];

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={visibleNav(user.role)}
      activeSection="workflow"
      activeTab={active.slug}
      topTabs={topTabs}
    >
      {active.slug === "service-type" && (
        <>
          <div className="viewbar">
            <Link
              className="viewtoggle"
              href={tree ? "/workflow/service-type" : "/workflow/service-type?view=tree"}
            >
              {tree ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9.5h18M3 15h18M9 4v16" />
                  </svg>
                  View in Table Mode
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3.5" width="7" height="5" rx="1.4" />
                    <rect x="14" y="10" width="7" height="5" rx="1.4" />
                    <rect x="14" y="17" width="7" height="4.5" rx="1.4" />
                    <path d="M6.5 8.5v10.7h7.5M6.5 12.5H14" />
                  </svg>
                  View in Tree Mode
                </>
              )}
            </Link>
          </div>
          {tree ? <TreePanel /> : <CatalogPanel />}
        </>
      )}

      {active.slug === "service-forms" &&
        (formsTab === "types" ? <FormTypesPanel subId={form} /> : <StandardPanel preview={preview === "1"} />)}

      {active.slug === "routes" && <RoutesPanel />}

      {active.slug === "tasks" && <TasksPanel />}
    </AppShell>
  );
}
