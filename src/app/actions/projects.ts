"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const PATH = "/project/projects";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

/** A date input gives YYYY-MM-DD; anything else is treated as absent. */
function date(f: FormData, k: string): Date | null {
  const v = String(f.get(k) ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return isNaN(+d) ? null : d;
}

async function requireProjectUser() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role }) && u.role !== "SUPERVISOR") {
    throw new Error("FORBIDDEN");
  }
  return u;
}

export async function createProject(formData: FormData) {
  const me = await requireProjectUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) done(PATH, "Nothing saved — a project needs a name.");

  const launchedAt = date(formData, "launchedAt");
  const closedAt = date(formData, "closedAt");
  if (launchedAt && closedAt && closedAt < launchedAt) {
    done(PATH, "Nothing saved — the close date is before the launch date.");
  }

  // Members arrive as "<employeeId>:<holder>" pairs from the picker.
  const picked = formData.getAll("member").map(String).filter(Boolean);
  const seen = new Set<string>();
  const members: { employeeId: string; holder: string }[] = [];
  for (const raw of picked) {
    const [employeeId, holder] = raw.split(":");
    if (!employeeId || seen.has(employeeId)) continue;
    seen.add(employeeId);
    members.push({ employeeId, holder: holder || "Member" });
  }

  const valid = members.length
    ? await prisma.employee.findMany({
        where: { id: { in: members.map((m) => m.employeeId) } },
        select: { id: true },
      })
    : [];
  const live = new Set(valid.map((e) => e.id));

  const project = await prisma.project.create({
    data: {
      name,
      description: text(formData, "description"),
      status: String(formData.get("status") ?? "Planning"),
      launchedAt,
      closedAt,
      userId: me.id,
      members: {
        create: members
          .filter((m) => live.has(m.employeeId))
          .map((m) => ({ employeeId: m.employeeId, holder: m.holder })),
      },
    },
    include: { _count: { select: { members: true } } },
  });

  revalidatePath(PATH);
  await logHistory({
    type: "create", module: "Project > Projects",
    description: `Created project ${name} with ${project._count.members} member(s)`,
    user: me,
  });
  done(
    PATH,
    `${name} created${project._count.members ? ` with ${project._count.members} member${project._count.members === 1 ? "" : "s"}` : " — no members yet"}.`,
  );
}

export async function setProjectStatus(formData: FormData) {
  const me = await requireProjectUser();

  const id = String(formData.get("projectId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) return;

  const closing = status === "Closed" || status === "Cancelled";
  const p = await prisma.project.update({
    where: { id },
    data: { status, closedAt: closing ? new Date() : null },
    select: { name: true },
  });

  revalidatePath(PATH);
  await logHistory({ type: "update", module: "Project > Projects", description: `${p.name} → ${status}`, user: me });
  done(PATH, `${p.name} is now ${status}.`);
}

export async function addProjectMember(formData: FormData) {
  const me = await requireProjectUser();

  const projectId = String(formData.get("projectId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!projectId || !employeeId) done(PATH, "Pick someone to add.");

  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true },
  });
  if (!emp) done(PATH, "That employee no longer exists.");

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_employeeId: { projectId, employeeId } },
  });
  if (existing) done(PATH, `${emp!.firstName} ${emp!.lastName} is already on this project.`);

  await prisma.projectMember.create({
    data: { projectId, employeeId, holder: String(formData.get("holder") ?? "Member") },
  });

  revalidatePath(PATH);
  await logHistory({ type: "create", module: "Project > Projects", description: `Added ${emp!.firstName} ${emp!.lastName} to a project`, user: me });
  done(PATH, `${emp!.firstName} ${emp!.lastName} added.`);
}

export async function removeProjectMember(memberId: string) {
  const me = await requireProjectUser();
  const m = await prisma.projectMember.delete({
    where: { id: memberId },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Project > Projects", description: `Removed ${m.employee.firstName} ${m.employee.lastName} from a project`, user: me });
  done(PATH, `${m.employee.firstName} ${m.employee.lastName} removed.`);
}

export async function deleteProject(projectId: string) {
  const me = await requireProjectUser();
  const p = await prisma.project.delete({ where: { id: projectId }, select: { name: true } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Project > Projects", description: `Deleted project ${p.name}`, user: me });
  done(PATH, `${p.name} deleted.`);
}
