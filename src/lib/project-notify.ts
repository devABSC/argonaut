import { prisma } from "./prisma";
import { notify } from "./notify";

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
