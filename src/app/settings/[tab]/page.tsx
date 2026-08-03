import { redirect, notFound } from "next/navigation";
import { requireAccess } from "@/lib/guard";
import { ROLE_LABEL } from "@/lib/rbac";
import AppShell from "../../AppShell";
import UsersPanel from "../UsersPanel";
import RbacPanel from "../RbacPanel";

export default async function SettingsTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ u?: string }>;
}) {
  const { tab } = await params;
  const { u } = await searchParams;

  const { user, nav, section, tab: active } = await requireAccess("settings", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection="settings"
      activeTab={active.slug}
    >
      {active.slug === "users" && <UsersPanel me={{ id: user.id, role: user.role }} />}
      {active.slug === "rbac" && <RbacPanel userId={u} />}
    </AppShell>
  );
}
