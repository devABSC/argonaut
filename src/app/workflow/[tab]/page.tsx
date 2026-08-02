import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { visibleNav, findSection, canViewSection } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/rbac";
import AppShell from "../../AppShell";
import CatalogPanel from "../CatalogPanel";

export default async function WorkflowTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewSection(user.role, "workflow")) notFound();

  const section = findSection("workflow");
  const active = section?.tabs.find((t) => t.slug === tab);
  if (!section || !active) notFound();

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={visibleNav(user.role)}
      activeSection="workflow"
      activeTab={active.slug}
    >
      {active.slug === "service-type" && <CatalogPanel />}
    </AppShell>
  );
}
