import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";
import SendPanel from "../SendPanel";
import TemplatesPanel from "../TemplatesPanel";
import DiagnosticsPanel from "../DiagnosticsPanel";

export default async function MarketingTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("marketing", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
      {active.slug === "send" && <SendPanel />}
      {active.slug === "templates" && <TemplatesPanel />}
      {active.slug === "diagnostics" && <DiagnosticsPanel />}
    </AppShell>
  );
}
