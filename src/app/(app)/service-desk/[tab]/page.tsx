import { redirect, notFound } from "next/navigation";
import { requireAccess } from "@/lib/guard";
import { ROLE_LABEL } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
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

  const { user, nav, section, tab: active } = await requireAccess("service-desk", tab);

  // Counted on every tab, not just the one being viewed — the point is to see
  // there is something waiting before you go looking for it.
  const [mineCount, approvalCount] = await Promise.all([
    prisma.serviceRequest.count({ where: { requesterId: user.id } }),
    prisma.serviceRequest.count({
      where: {
        status: { in: ["SUBMITTED", "IN_REVIEW"] },
        approvals: { some: { approverId: user.id, decision: "PENDING" } },
      },
    }),
  ]);

  const counts: Record<string, number> = {
    "my-requests": mineCount,
    approvals: approvalCount,
  };
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
    <>
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
    </>
  );
}
