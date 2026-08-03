import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import AppShell from "../../AppShell";
import CandidateList from "../CandidateList";

export default async function RecruitmentTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ q?: string; recruiter?: string; bou?: string; stage?: string }>;
}) {
  const { tab } = await params;
  const { q, recruiter, bou, stage } = await searchParams;
  const { user, nav, section, tab: active } = await requireAccess("recruitment", tab);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={nav}
      activeSection={section.key}
      activeTab={active.slug}
    >
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
