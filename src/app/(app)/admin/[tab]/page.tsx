import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AgencyPanel from "../AgencyPanel";
import { agencyForSlug } from "@/lib/agencies";

export default async function AdminTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("admin", tab);
  const agency = agencyForSlug(active.slug);

  return (
    <>
      {agency ? (
        <AgencyPanel agency={agency} isOwner={user.role === "SUPER_USER"} />
      ) : (
        <div className="panel">
          <h2>{active.label}</h2>
          <p>This page is wired up and role-gated, but has no fields yet.</p>
        </div>
      )}
    </>
  );
}
