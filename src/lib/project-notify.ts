import { prisma } from "./prisma";
import { notify } from "./notify";

/**
 * The work address for an employee, if there is one to write to.
 *
 * The HRIS record first, then the linked account — an employee may have been
 * imported without an address but still hold a login.
 */
async function addressOf(employeeId: string) {
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, emailAdd: true, user: { select: { email: true } } },
  });
  if (!e) return null;
  const to = e.emailAdd?.trim() || e.user?.email?.trim();
  return to ? { to, name: `${e.firstName} ${e.lastName}`, firstName: e.firstName } : null;
}

/**
 * Tells someone they have been put on a project.
 *
 * Sent to the person themselves, not their manager: being added to a project
 * is something you need to know about your own week.
 */
export async function notifyMemberAdded(
  projectId: string,
  employeeId: string,
  holder: string,
  byName: string,
): Promise<boolean> {
  try {
    const [p, who] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, customer: true, description: true },
      }),
      addressOf(employeeId),
    ]);
    // Nobody to write to is not a failure; it is a record without an address.
    if (!p || !who) return false;

    return await notify({
      to: who.to,
      subject: `You have been added to ${p.name}`,
      body:
        `Hello ${who.firstName},\n\n` +
        `${byName} added you to the project ${p.name} as ${holder}.\n` +
        (p.customer ? `Customer: ${p.customer}\n` : "") +
        (p.description ? `\n${p.description}\n` : "") +
        `\nYou can see the project, its milestones and the work under them in Argonaut.`,
      kind: "project-member",
    });
  } catch (e) {
    console.error("member-added notice failed:", (e as Error).message);
    return false;
  }
}

/**
 * Tells someone a task has been put in their name.
 *
 * Sent on assignment, whether the task was just created or handed over — the
 * point is that the person now owns it.
 */
export async function notifyTaskAssigned(
  taskId: string,
  byName: string,
): Promise<boolean> {
  try {
    const t = await prisma.milestoneTask.findUnique({
      where: { id: taskId },
      select: {
        name: true, description: true, startedAt: true, assigneeId: true,
        milestone: { select: { name: true, project: { select: { name: true } } } },
      },
    });
    if (!t?.assigneeId) return false;

    const who = await addressOf(t.assigneeId);
    if (!who) return false;

    const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

    return await notify({
      to: who.to,
      subject: `A task was assigned to you — ${t.name}`,
      body:
        `Hello ${who.firstName},\n\n` +
        `${byName} assigned you a task on ${t.milestone.project.name}.\n\n` +
        `Task: ${t.name}\n` +
        `Milestone: ${t.milestone.name}\n` +
        (t.description ? `Details: ${t.description}\n` : "") +
        (day(t.startedAt) ? `Started on: ${day(t.startedAt)}\n` : "") +
        `\nMark it Closed in Argonaut when it is done.`,
      kind: "project-task",
    });
  } catch (e) {
    console.error("task-assigned notice failed:", (e as Error).message);
    return false;
  }
}

/**
 * Tells the project manager that something was assigned on their project.
 *
 * Only the manager, on purpose: assignments happen often, and copying every
 * member turns a useful signal into noise. Widen the audience when there is a
 * reason to, not by default.
 *
 * Never throws. A mail problem must not roll back the assignment that
 * triggered it — `notify` already swallows delivery failures, and a project
 * with no manager simply has nobody to tell.
 */
export async function notifyProjectManager(
  projectId: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        manager: {
          select: {
            firstName: true,
            lastName: true,
            emailAdd: true,
            // The employee record carries a work address; the linked account
            // is the fallback for someone whose HRIS row has none.
            user: { select: { email: true } },
          },
        },
      },
    });

    const to = p?.manager?.emailAdd?.trim() || p?.manager?.user?.email?.trim();
    if (!p || !to) return;

    await notify({
      to,
      subject,
      body: `Hello ${p.manager!.firstName},\n\n${body}\n\nProject: ${p.name}`,
      kind: "project-assignment",
    });
  } catch (e) {
    console.error("project manager notify failed:", (e as Error).message);
  }
}
