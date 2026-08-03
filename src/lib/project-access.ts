import { prisma } from "./prisma";
import { requireUser } from "./auth";

/**
 * Who may see and touch which projects.
 *
 * Membership is the gate: an employee sees a project only if they are on it,
 * and may only change one they are on. The owner and Administrators see
 * everything, since somebody has to create a project and add its first member.
 *
 * Users are matched to their HRIS record by email — `Employee.userId` is not
 * populated. A user with no employee record has no memberships and therefore
 * sees nothing, which is the correct direction to fail in.
 */

const SEES_ALL = ["SUPER_USER", "ADMINISTRATOR"];

export type Viewer = {
  userId: string;
  name: string;
  role: string;
  /** Their HRIS record, if their email matches one. */
  employeeId: string | null;
  seesAll: boolean;
};

export async function projectViewer(): Promise<Viewer> {
  const u = await requireUser();
  const emp = await prisma.employee.findFirst({
    where: { emailAdd: { equals: u.email, mode: "insensitive" } },
    select: { id: true },
  });
  return {
    userId: u.id,
    name: u.name,
    role: u.role,
    employeeId: emp?.id ?? null,
    seesAll: SEES_ALL.includes(u.role),
  };
}

/**
 * The `where` for any project query. Enforced in the query rather than by
 * hiding rows — a filtered render still ships the data to the client.
 */
export function projectScope(v: Viewer) {
  if (v.seesAll) return {};
  if (!v.employeeId) return { id: "__none__" }; // no HRIS record, no projects
  return { members: { some: { employeeId: v.employeeId } } };
}

/** May this viewer open, and therefore change, this project? */
export async function canTouchProject(v: Viewer, projectId: string): Promise<boolean> {
  if (v.seesAll) return true;
  if (!v.employeeId) return false;
  const m = await prisma.projectMember.findUnique({
    where: { projectId_employeeId: { projectId, employeeId: v.employeeId } },
    select: { id: true },
  });
  return !!m;
}

/**
 * Guards a write. Throws rather than returning false — a non-member reaching a
 * project action is a bug or an attack, not a form error.
 */
export async function requireProjectMember(projectId: string): Promise<Viewer> {
  const v = await projectViewer();
  if (!(await canTouchProject(v, projectId))) throw new Error("NOT_A_PROJECT_MEMBER");
  return v;
}

/** How a value reads in the change trail. */
export function display(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export type FieldChange = { field: string; oldValue: string | null; newValue: string | null };

/**
 * Compares what was loaded against what was submitted, and returns only the
 * fields that actually moved — a trail full of no-op rows is as unreadable as
 * no trail at all.
 */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
): FieldChange[] {
  const out: FieldChange[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const o = display(before[key]);
    const n = display(after[key]);
    if (o !== n) out.push({ field: label, oldValue: o, newValue: n });
  }
  return out;
}
