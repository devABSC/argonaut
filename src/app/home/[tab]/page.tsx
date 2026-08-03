import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";
import LaunchArticle from "../LaunchArticle";

export default async function HomeTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("home", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
      wide
    >
      <LaunchArticle />
    </AppShell>
  );
}
