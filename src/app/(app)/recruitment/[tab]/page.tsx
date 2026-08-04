import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import CandidateList from "../CandidateList";
import UploadChart, { isSpan } from "../UploadChart";
import JobsPanel from "../JobsPanel";

export default async function RecruitmentTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{
    q?: string; recruiter?: string; bou?: string; stage?: string;
    span?: string; year?: string;
  }>;
}) {
  const { tab } = await params;
  const { q, recruiter, bou, stage, span, year } = await searchParams;
  const { user, nav, section, tab: active } = await requireAccess("recruitment", tab);

  // Monthly reads best on a young pipeline; the other spans are one click away.
  const useSpan = span && isSpan(span) ? span : "monthly";
  const thisYear = new Date().getUTCFullYear();
  const useYear = Number(year) >= 2000 && Number(year) <= thisYear + 1 ? Number(year) : thisYear;

  return (
    <>
      {active.slug === "jobs" && <JobsPanel />}

      {active.slug === "candidates" && (
        <UploadChart
          viewer={{ id: user.id, role: user.role }}
          span={useSpan}
          year={useYear}
          recruiter={recruiter ?? ""}
          query={{
            q: q ?? "", recruiter: recruiter ?? "", bou: bou ?? "", stage: stage ?? "",
            span: useSpan, year: String(useYear),
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
    </>
  );
}
