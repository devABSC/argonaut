import { prisma } from "./prisma";
import { notify } from "./notify";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://argonaut.znergee.com";
const link = (reference: string) => `${APP_URL}/service-desk/ticket/${encodeURIComponent(reference)}`;

/**
 * Ticket notifications. Each is fire-and-forget: `notify` swallows its own
 * errors so a mail problem never rolls back the action that caused it.
 */

/** Tells whoever the ticket now waits on that it needs them. */
export async function noticeAwaitingApprover(requestId: string): Promise<void> {
  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: { select: { name: true } },
      subcategory: { select: { name: true, category: { select: { name: true } } } },
      approvals: {
        where: { decision: "PENDING" },
        orderBy: { sequence: "asc" },
        include: { approver: { select: { name: true, email: true } } },
      },
    },
  });
  if (!req) return;

  const next = req.approvals[0];
  if (!next?.approver.email) return;

  await notify({
    to: next.approver.email,
    kind: "step_awaiting",
    requestId,
    subject: `[${req.reference}] Awaiting your approval — ${req.subject}`,
    body: [
      `Hello ${next.approver.name},`,
      ``,
      `A request is waiting on you.`,
      ``,
      `Ticket:   ${req.reference}`,
      `Service:  ${req.subcategory.category.name} > ${req.subcategory.name}`,
      `Step:     ${next.stepName || "Approval"}`,
      `Raised by: ${req.requester.name}`,
      `Subject:  ${req.subject}`,
      ``,
      `Open it here: ${link(req.reference)}`,
    ].join("\n"),
  });
}

/** Confirms to the requester that their ticket was raised. */
export async function noticeTicketRaised(requestId: string): Promise<void> {
  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: { select: { name: true, email: true } },
      subcategory: { select: { name: true, category: { select: { name: true } } } },
    },
  });
  if (!req?.requester.email) return;

  await notify({
    to: req.requester.email,
    kind: "ticket_submitted",
    requestId,
    subject: `[${req.reference}] Ticket raised — ${req.subject}`,
    body: [
      `Hello ${req.requester.name},`,
      ``,
      `Your request has been logged.`,
      ``,
      `Ticket:  ${req.reference}`,
      `Service: ${req.subcategory.category.name} > ${req.subcategory.name}`,
      `Status:  ${req.status}`,
      ``,
      `Track it here: ${link(req.reference)}`,
    ].join("\n"),
  });
}

/** Tells the requester a decision was made on their ticket. */
export async function noticeDecision(
  requestId: string,
  by: string,
  decision: string,
  remarks: string | null,
  stepName: string,
): Promise<void> {
  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { requester: { select: { name: true, email: true } } },
  });
  if (!req?.requester.email) return;

  await notify({
    to: req.requester.email,
    kind: "ticket_decided",
    requestId,
    subject: `[${req.reference}] ${decision === "APPROVED" ? "Approved" : "Rejected"} at ${stepName} — ${req.subject}`,
    body: [
      `Hello ${req.requester.name},`,
      ``,
      `${by} ${decision === "APPROVED" ? "approved" : "rejected"} your request at the "${stepName}" step.`,
      remarks ? `\nRemarks: ${remarks}` : ``,
      ``,
      `Ticket: ${req.reference}`,
      `Status: ${req.status}`,
      ``,
      `Open it here: ${link(req.reference)}`,
    ].join("\n"),
  });
}
