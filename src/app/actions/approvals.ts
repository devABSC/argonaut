"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { noticeDecision, noticeAwaitingApprover } from "@/lib/notices";

/**
 * Record one decision on a ticket. Only the person the step is assigned to may
 * act, and only when every earlier step is already decided — so the route runs
 * in order rather than letting a later approver jump the queue.
 */
export async function decide(approvalId: string, formData: FormData) {
  const user = await requireUser();

  const decision = String(formData.get("decision") ?? "");
  if (decision !== "APPROVED" && decision !== "REJECTED") throw new Error("BAD_DECISION");
  const remarks = String(formData.get("remarks") ?? "").trim() || null;

  const approval = await prisma.requestApproval.findUnique({
    where: { id: approvalId },
    include: { request: { include: { approvals: true } } },
  });
  if (!approval) throw new Error("NOT_FOUND");
  if (approval.approverId !== user.id) throw new Error("NOT_YOURS");
  if (approval.decision !== "PENDING") throw new Error("ALREADY_DECIDED");

  const earlierPending = approval.request.approvals.some(
    (a) => a.sequence < approval.sequence && a.decision === "PENDING",
  );
  if (earlierPending) throw new Error("EARLIER_STEP_PENDING");

  await prisma.requestApproval.update({
    where: { id: approvalId },
    data: { decision, remarks, decidedAt: new Date() },
  });

  // A rejection closes the ticket immediately; otherwise it moves on until
  // nothing is left pending.
  const rest = approval.request.approvals.filter((a) => a.id !== approvalId);
  const stillPending = rest.filter((a) => a.decision === "PENDING");

  if (decision === "REJECTED") {
    await prisma.serviceRequest.update({
      where: { id: approval.requestId },
      data: { status: "REJECTED", closedAt: new Date() },
    });
  } else if (stillPending.length === 0) {
    await prisma.serviceRequest.update({
      where: { id: approval.requestId },
      data: { status: "APPROVED", closedAt: new Date() },
    });
  } else {
    await prisma.serviceRequest.update({
      where: { id: approval.requestId },
      data: {
        status: "IN_REVIEW",
        currentSequence: Math.min(...stillPending.map((a) => a.sequence)),
      },
    });
  }

  // Tell the requester what happened, then whoever is next in line.
  await noticeDecision(
    approval.requestId, user.name, decision, remarks, approval.stepName || "Approval",
  );
  if (decision === "APPROVED" && stillPending.length > 0) {
    await noticeAwaitingApprover(approval.requestId);
  }

  revalidatePath(`/service-desk/ticket/${approval.request.reference}`);
  revalidatePath("/service-desk/my-requests");
  revalidatePath("/service-desk/approvals");
}
