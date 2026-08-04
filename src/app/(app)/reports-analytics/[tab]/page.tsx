import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import LogsPanel from "../LogsPanel";
import SqlPanel from "../SqlPanel";

export default async function ReportsTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { tab } = await params;
  const { q, page } = await searchParams;

  const { user, nav, section, tab: active } = await requireAccess("reports-analytics", tab);

  return (
    <>
      {active.slug === "sql-queries" ? (
        <SqlPanel />
      ) : active.slug === "logs" ? (
        <LogsPanel q={q ?? ""} page={Math.max(1, Number(page) || 1)} />
      ) : (
        <div className="panel">
          <h2>{active.label}</h2>
          <p>Not built yet — Log History is the working tab.</p>
        </div>
      )}
    </>
  );
}
