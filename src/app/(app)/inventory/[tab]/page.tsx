import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import InventoryPanels from "../InventoryPanels";
import ItemMaster from "../ItemMaster";

export default async function InventoryTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ q?: string; cat?: string; type?: string; status?: string; edit?: string }>;
}) {
  const { tab } = await params;
  const sp = await searchParams;
  const { user, nav, section, tab: active } = await requireAccess("inventory", tab);

  return (
    <>
      {active.slug === "item-master" ? (
        <ItemMaster
          q={sp.q} cat={sp.cat} type={sp.type} status={sp.status} edit={sp.edit}
          isOwner={user.role === "SUPER_USER"}
        />
      ) : (
        <InventoryPanels view={active.slug} />
      )}
    </>
  );
}
