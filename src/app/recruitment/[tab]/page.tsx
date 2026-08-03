import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";
import CandidateList from "../CandidateList";
import UploadChart, { isSpan } from "../UploadChart";

export default async function RecruitmentTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{
    q?: string; recruiter?: string; bou?: string; stage?: string;
    span?: string; mode?: string;
  }>;
}) {
  const { tab } = await params;
  const { q, recruiter, bou, stage, span, mode } = await searchParams;
  const { user, nav, section, tab: active } = await requireAccess("recruitment", tab);

  // Monthly reads best on a young pipeline; the other spans are one click away.
  const useSpan = span && isSpan(span) ? span : "monthly";
  const useMode = mode === "each" ? "each" : "combined";

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
      {active.slug === "candidates" && (
        <UploadChart
          viewer={{ id: user.id, role: user.role }}
          span={useSpan}
          mode={useMode}
          recruiter={recruiter ?? ""}
          query={{
            q: q ?? "", recruiter: recruiter ?? "", bou: bou ?? "", stage: stage ?? "",
            span: useSpan, mode: useMode,
          }}
        />
      )}

      <CandidateList
        viewer={{ id: user.id, role: user.role }}
        q={q ?? ""}
        recruiter={recruiter ?? ""}
        bou={bou ?? ""}
        stage={stage ?? ""}
      />
    </AppShell>
  );
}
