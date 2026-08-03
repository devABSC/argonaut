import { prisma } from "./prisma";
import type { RoleKey } from "./roles";

/**
 * Who is looking at Statements of Account, and whose they may see.
 *
 * Finance sees every statement. Everyone else sees exactly one — their own —
 * and only if their account can be matched to an employee record. No match
 * means no statement, not everyone's.
 */
export type SoaViewer = {
  admin: boolean;
  /** The viewer's own employee record, when they are not Finance. */
  employeeId: string | null;
};

export async function soaViewer(user: { id: string; role: RoleKey; email: string }): Promise<SoaViewer> {
  if (user.role === "SUPER_USER" || user.role === "ADMINISTRATOR") {
    return { admin: true, employeeId: null };
  }
  // The account link is the reliable one; the work address is the fallback for
  // records that have not been linked yet.
  const e = await prisma.employee.findFirst({
    where: { OR: [{ userId: user.id }, { emailAdd: { equals: user.email, mode: "insensitive" } }] },
    select: { id: true },
  });
  return { admin: false, employeeId: e?.id ?? null };
}

/** The `where` that keeps a non-Finance viewer inside their own statement. */
export function soaWhere(v: SoaViewer) {
  if (v.admin) return {};
  // An unmatched account matches no employee, so it sees nothing rather than
  // everything — the safe direction to fail in.
  return { employeeId: v.employeeId ?? "__none__" };
}

/** Whether this viewer may read and post to a given statement. */
export function canUseSoa(v: SoaViewer, soa: { employeeId: string }): boolean {
  return v.admin || (!!v.employeeId && soa.employeeId === v.employeeId);
}
