import { prisma } from "./prisma";

/**
 * An approved cash advance lands on the requester's statement as a payment.
 *
 * The company handing money over credits the person's account — the same
 * convention the statement already uses, where a charge is money they laid out
 * and a credit settles it.
 *
 * Never throws. Posting is a consequence of the approval, not a condition of
 * it: a statement that cannot be written must not undo a decision that has
 * already been made and emailed.
 */
export async function postCashAdvanceToSoa(requestId: string): Promise<void> {
  try {
    const req = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        reference: true,
        subject: true,
        details: true,
        closedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        subcategory: { select: { name: true } },
      },
    });
    if (!req) return;

    // Cash advances only. Matched on the subtype's name, the same way Finance's
    // own Cash Adv list finds them.
    if (!/cash advance/i.test(req.subcategory?.name ?? "")) return;

    const raw = (req.details as Record<string, unknown> | null)?.amount;
    const amount = Number(String(raw ?? "").replace(/[^\d.-]/g, ""));
    // No amount, or a nil one, is nothing to post.
    if (!Number.isFinite(amount) || amount <= 0) return;

    // Already posted — an approval replayed must not credit the account twice.
    const sourceRef = `SR:${req.id}`;
    if (await prisma.soaLine.findUnique({ where: { sourceRef }, select: { id: true } })) return;

    // The requester as an employee. The account link first, the work address
    // as the fallback for records that have not been linked yet.
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { userId: req.requester.id },
          { emailAdd: { equals: req.requester.email, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, bou: { select: { name: true, code: true } } },
    });
    // Nobody to bill it to. Silent rather than guessing at a person.
    if (!employee) {
      console.error(`CA ${req.reference}: no employee record for ${req.requester.email}, not posted`);
      return;
    }

    let soa = await prisma.soa.findUnique({ where: { employeeId: employee.id }, select: { id: true, ref: true, status: true } });

    // No statement yet — an approved advance is reason enough to open one.
    if (!soa) {
      const now = new Date();
      const yymm = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const prefix = `${yymm}-${employee.bou?.code ?? "NOBOU"}-`;
      const n = await prisma.soa.count({ where: { ref: { startsWith: prefix } } });
      soa = await prisma.soa.create({
        data: {
          ref: `${prefix}${String(n + 1).padStart(6, "0")}`,
          employeeId: employee.id,
          bouName: employee.bou?.name ?? null,
          createdById: req.requester.id,
        },
        select: { id: true, ref: true, status: true },
      });
    }

    await prisma.soaLine.create({
      data: {
        soaId: soa.id,
        date: req.closedAt ?? new Date(),
        particulars: `Cash advance released — ${req.reference}${req.subject ? ` · ${req.subject}` : ""}`,
        credit: amount,
        debit: 0,
        sourceRef,
      },
    });

    // A closed statement still takes the posting — the money moved — but say so
    // where someone will see it.
    if (soa.status === "Closed") {
      console.warn(`CA ${req.reference} posted to ${soa.ref}, which is closed.`);
    }
  } catch (e) {
    console.error("cash advance not posted to SOA:", (e as Error).message);
  }
}
