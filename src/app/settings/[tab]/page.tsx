import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { visibleNav, findSection, canViewSection } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/rbac";
import AppShell from "../../AppShell";
import UsersPanel from "../UsersPanel";

export default async function SettingsTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewSection(user.role, "settings")) notFound();

  const section = findSection("settings");
  const active = section?.tabs.find((t) => t.slug === tab);
  if (!section || !active) notFound();

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={visibleNav(user.role)}
      activeSection="settings"
      activeTab={active.slug}
    >
      {active.slug === "users" && <UsersPanel me={{ id: user.id, role: user.role }} />}
    </AppShell>
  );
}
