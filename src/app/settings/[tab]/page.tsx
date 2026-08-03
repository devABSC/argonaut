import { redirect, notFound } from "next/navigation";
import { requireAccess } from "@/lib/guard";
import { ROLE_LABEL } from "@/lib/rbac";
import AppShell from "../../AppShell";
import UsersPanel from "../UsersPanel";
import RbacPanel from "../RbacPanel";
import CompanyPanel from "../CompanyPanel";
import RolesPanel from "../RolesPanel";
import BouPanel from "../BouPanel";
import EmailPanel from "../EmailPanel";

export default async function SettingsTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ u?: string; bou?: string; inactive?: string }>;
}) {
  const { tab } = await params;
  const { u, bou, inactive } = await searchParams;

  const { user, nav, section, tab: active } = await requireAccess("settings", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection="settings"
      activeTab={active.slug}
    >
      {active.slug === "users" && <UsersPanel me={{ id: user.id, role: user.role }} />}
      {active.slug === "company" && <CompanyPanel />}
      {active.slug === "roles" && <RolesPanel />}
      {active.slug === "bou" && <BouPanel showInactive={inactive === "1"} />}
      {active.slug === "email" && <EmailPanel />}
      {active.slug === "rbac" && <RbacPanel userId={u} bouId={bou} />}
    </AppShell>
  );
}
