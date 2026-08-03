import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";
import PipelineBoard from "../PipelineBoard";
import ClientsPanel from "../ClientsPanel";
import ContactsPanel from "../ContactsPanel";

export default async function CrmTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("crm", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
      {active.slug === "pipeline" && <PipelineBoard />}
      {active.slug === "clients" && <ClientsPanel />}
      {active.slug === "contacts" && <ContactsPanel />}
    </AppShell>
  );
}
