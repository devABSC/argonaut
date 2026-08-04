import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import SendPanel from "../SendPanel";
import TemplatesPanel from "../TemplatesPanel";
import DiagnosticsPanel from "../DiagnosticsPanel";

export default async function MarketingTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("marketing", tab);

  return (
    <>
      {active.slug === "send" && <SendPanel />}
      {active.slug === "templates" && <TemplatesPanel />}
      {active.slug === "diagnostics" && <DiagnosticsPanel />}
    </>
  );
}
