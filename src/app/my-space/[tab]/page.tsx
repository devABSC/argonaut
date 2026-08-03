import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";
import { MyPersonalInfo, MyStatutory, MyPassword, MyNotifications } from "../MyPanels";

export default async function MySpaceTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("my-space", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
      {active.slug === "personal-info" ? (
        <MyPersonalInfo email={user.email} />
      ) : active.slug === "statutory" ? (
        <MyStatutory email={user.email} />
      ) : active.slug === "change-password" ? (
        <MyPassword name={user.name} changedAt={user.passwordChangedAt ?? null} />
      ) : active.slug === "notifications" ? (
        <MyNotifications email={user.email} />
      ) : (
        <div className="panel">
          <h2>{active.label}</h2>
          <p>Your own corner of Argonaut — pick a tab above.</p>
        </div>
      )}
    </AppShell>
  );
}
