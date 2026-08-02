import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { visibleNav, findSection, canViewSection } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/rbac";
import AppShell from "../../AppShell";
import CatalogPanel from "../CatalogPanel";
import TreePanel from "../TreePanel";
import ServiceFormsPanel from "../ServiceFormsPanel";

export default async function WorkflowTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { tab } = await params;
  const { view } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewSection(user.role, "workflow")) notFound();

  const section = findSection("workflow");
  const active = section?.tabs.find((t) => t.slug === tab);
  if (!section || !active) notFound();

  const tree = view === "tree";

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={visibleNav(user.role)}
      activeSection="workflow"
      activeTab={active.slug}
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

      {active.slug === "service-forms" && <ServiceFormsPanel />}
    </AppShell>
  );
}
