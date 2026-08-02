import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { visibleNav, findSection, canViewSection } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import AppShell from "../../AppShell";
import NewRequestPanel from "../NewRequestPanel";
import RequestList from "../RequestList";

export default async function ServiceDeskTab({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ sub?: string; new?: string }>;
}) {
  const { tab } = await params;
  const { sub, new: created } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewSection(user.role, "service-desk")) notFound();

  const section = findSection("service-desk");
  const active = section?.tabs.find((t) => t.slug === tab);
  if (!section || !active) notFound();

  const mine =
    active.slug === "my-requests"
      ? await prisma.serviceRequest.findMany({
          where: { requesterId: user.id },
          orderBy: { createdAt: "desc" },
          include: {
            subcategory: { select: { name: true, category: { select: { name: true } } } },
            approvals: {
              orderBy: { sequence: "asc" },
              include: { approver: { select: { name: true } } },
            },
          },
        })
      : [];

  const toApprove =
    active.slug === "approvals"
      ? await prisma.serviceRequest.findMany({
          where: {
            status: { in: ["SUBMITTED", "IN_REVIEW"] },
            approvals: { some: { approverId: user.id, decision: "PENDING" } },
          },
          orderBy: { createdAt: "asc" },
          include: {
            requester: { select: { name: true } },
            subcategory: { select: { name: true, category: { select: { name: true } } } },
            approvals: {
              orderBy: { sequence: "asc" },
              include: { approver: { select: { name: true } } },
            },
          },
        })
      : [];

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={visibleNav(user.role)}
      activeSection="service-desk"
      activeTab={active.slug}
    >
      {active.slug === "new-request" && <NewRequestPanel subId={sub} requesterName={user.name} />}

      {active.slug === "my-requests" && (
        <>
          {created && (
            <div className="banner">
              Ticket <b>{created}</b> submitted.
            </div>
          )}
          <RequestList
            title="My requests"
            rows={mine}
            emptyText="You have not raised any requests yet."
          />
        </>
      )}

      {active.slug === "approvals" && (
        <RequestList
          title="For my approval"
          rows={toApprove}
          showRequester
          emptyText="Nothing is waiting on you."
        />
      )}
    </AppShell>
  );
}
