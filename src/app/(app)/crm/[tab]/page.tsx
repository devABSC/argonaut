import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import PipelineBoard from "../PipelineBoard";
import ClientsPanel from "../ClientsPanel";
import SuppliersPanel from "../SuppliersPanel";
import ContactsPanel from "../ContactsPanel";

export default async function CrmTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("crm", tab);

  return (
    <>
      {active.slug === "pipeline" && <PipelineBoard />}
      {active.slug === "clients" && <ClientsPanel />}
      {active.slug === "suppliers" && <SuppliersPanel />}
      {active.slug === "contacts" && <ContactsPanel />}
    </>
  );
}
