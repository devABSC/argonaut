import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { navFor, effectiveAccess } from "@/lib/access";
import { ROLE_LABEL, canViewAllProjects, supervises } from "@/lib/rbac";
import { getStandardForm } from "@/lib/forms";
import AppShell from "../../../AppShell";
import RouteTrail from "../../RouteTrail";

const STATUS_PILL: Record<string, string> = {
  DRAFT: "s-PENDING", SUBMITTED: "s-PENDING", IN_REVIEW: "s-PENDING",
  APPROVED: "s-ACTIVE", REJECTED: "s-REJECTED", CANCELLED: "s-SUSPENDED",
};

export default async function TicketPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await prisma.serviceRequest.findUnique({
    where: { reference: decodeURIComponent(ref) },
    include: {
      requester: { select: { id: true, name: true, email: true, managerId: true } },
      subcategory: {
        select: {
          name: true,
          category: { select: { name: true } },
          formType: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
          steps: {
            orderBy: { sequence: "asc" },
            include: { approvers: { select: { userId: true, user: { select: { name: true } } } } },
          },
        },
      },
      approvals: {
        orderBy: { sequence: "asc" },
        include: { approver: { select: { name: true } } },
      },
    },
  });
  if (!t) notFound();

  // Visible to the requester, anyone in its approval chain, admins, and the
  // requester's own supervisor. Everyone else gets a 404 rather than a hint.
  const isMine = t.requesterId === user.id;
  const isApprover = t.approvals.some((a) => a.approverId === user.id);
  const isTheirSupervisor = supervises(user) && t.requester.managerId === user.id;
  if (!isMine && !isApprover && !isTheirSupervisor && !canViewAllProjects(user)) notFound();

  const standard = await getStandardForm();
  const fields = [...standard.fields, ...t.subcategory.formType.fields];
  const details = (t.details ?? {}) as Record<string, unknown>;

  const answered = fields
    .map((f) => ({ label: f.label, value: details[f.key] }))
    .filter((r) => r.value !== undefined && r.value !== "" && r.value !== false);

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={navFor(await effectiveAccess(user))}
      activeSection="service-desk"
      activeTab="my-requests"
    >
      <div className="viewbar">
        <Link className="viewtoggle" href="/service-desk/my-requests">← Back to requests</Link>
      </div>

      <div className="panel">
        <div className="cat-head">
          <h2><code className="ticket">{t.reference}</code></h2>
          <span className={`pill ${STATUS_PILL[t.status] ?? "s-PENDING"}`}>{t.status}</span>
          <span className="spacer" />
          <span className="tree-meta">
            {t.subcategory.category.name} › {t.subcategory.name}
          </span>
        </div>

        <h3 className="tsubject">{t.subject}</h3>
        {t.description && <p className="tdesc">{t.description}</p>}

        <dl className="tmeta">
          <div><dt>Requester</dt><dd>{t.requester.name}</dd></div>
          <div><dt>Raised</dt><dd>{t.createdAt.toISOString().slice(0, 16).replace("T", " ")}</dd></div>
          <div><dt>Submitted</dt><dd>{t.submittedAt ? t.submittedAt.toISOString().slice(0, 16).replace("T", " ") : "—"}</dd></div>
          <div><dt>Closed</dt><dd>{t.closedAt ? t.closedAt.toISOString().slice(0, 16).replace("T", " ") : "—"}</dd></div>
        </dl>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>{t.subcategory.name} Details <span className="count">{answered.length}</span></h2>
        {answered.length === 0 ? (
          <p style={{ marginTop: 14 }}>No field answers were recorded.</p>
        ) : (
          <dl className="tmeta wide">
            {answered.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>{typeof r.value === "boolean" ? (r.value ? "Yes" : "No") : String(r.value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <RouteTrail
        steps={t.subcategory.steps}
        approvals={t.approvals}
        viewerId={user.id}
        requesterName={t.requester.name}
        closed={t.status === "APPROVED" || t.status === "REJECTED" || t.status === "CANCELLED"}
      />
    </AppShell>
  );
}
