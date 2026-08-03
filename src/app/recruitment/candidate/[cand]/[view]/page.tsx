import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import { CAND_VIEWS, isCandView, STAGE_PILL } from "@/lib/candidate-views";
import { canSeeCandidate } from "@/lib/candidate-scope";
import AppShell from "../../../../AppShell";
import CandidatePanel from "../../../CandidatePanel";

/** One candidate's record. Access rides on the Candidates tab. */
export default async function CandidateView({
  params,
}: {
  params: Promise<{ cand: string; view: string }>;
}) {
  const { cand, view } = await params;
  if (!isCandView(view)) notFound();

  const { user, nav, section } = await requireAccess("recruitment", "candidates");

  const c = await prisma.candidate.findUnique({
    where: { id: cand },
    select: { id: true, firstName: true, lastName: true, stage: true, recruiterId: true },
  });
  // Someone else's candidate is not found rather than forbidden — a 403 would
  // confirm the record exists.
  if (!c || !canSeeCandidate(user, c)) notFound();

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab="candidates"
    >
      <div className="viewbar">
        <Link className="viewtoggle" href="/recruitment/candidates">← Back to candidates</Link>
        <span className="spacer" />
        <span className="tree-meta">{c.firstName} {c.lastName}</span>
        <span className={`pill ${STAGE_PILL[c.stage] ?? "s-PENDING"}`}>{c.stage}</span>
      </div>

      <div className="subtabs" role="tablist">
        {CAND_VIEWS.map((v) => (
          <Link
            key={v.slug}
            role="tab"
            aria-selected={v.slug === view}
            className={v.slug === view ? "subtab on" : "subtab"}
            href={`/recruitment/candidate/${cand}/${v.slug}`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <CandidatePanel candidateId={cand} view={view} />
    </AppShell>
  );
}
