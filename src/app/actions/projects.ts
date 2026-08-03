"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { projectViewer, requireProjectMember, diff, display } from "@/lib/project-access";

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
      customer: text(formData, "customer"),
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
  const id = String(formData.get("projectId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) return;
  const me = await requireProjectMember(id);

  const before = await prisma.project.findUnique({ where: { id }, select: { name: true, status: true, closedAt: true } });
  if (!before) return;

  const closing = status === "Closed" || status === "Cancelled";
  const closedAt = closing ? new Date() : null;

  const [p] = await prisma.$transaction([
    prisma.project.update({ where: { id }, data: { status, closedAt }, select: { name: true } }),
    prisma.projectChange.createMany({
      data: diff(before, { status, closedAt }, { status: "Status", closedAt: "Date closed" }).map((c) => ({
        projectId: id, entity: "Project", entityName: before.name, ...c,
        actorId: me.userId, actorName: me.name,
      })),
    }),
  ]);

  revalidatePath(PATH);
  await logHistory({ type: "update", module: "Project > Projects", description: `${p.name} → ${status}`, user: { id: me.userId, name: me.name } });
  done(PATH, `${p.name} is now ${status}.`);
}

export async function addProjectMember(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const me = await requireProjectMember(projectId);

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

  const holder = String(formData.get("holder") ?? "Member");
  await prisma.$transaction([
    prisma.projectMember.create({ data: { projectId, employeeId, holder } }),
    prisma.projectChange.create({
      data: {
        projectId, entity: "Member", entityId: employeeId,
        entityName: `${emp!.firstName} ${emp!.lastName}`,
        field: "Member", oldValue: null, newValue: holder, action: "create",
        actorId: me.userId, actorName: me.name,
      },
    }),
  ]);

  revalidatePath(PATH);
  await logHistory({ type: "create", module: "Project > Projects", description: `Added ${emp!.firstName} ${emp!.lastName} to a project`, user: { id: me.userId, name: me.name } });
  done(PATH, `${emp!.firstName} ${emp!.lastName} added.`);
}

export async function removeProjectMember(memberId: string) {
  const row = await prisma.projectMember.findUnique({
    where: { id: memberId },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });
  if (!row) return;
  const me = await requireProjectMember(row.projectId);

  const [m] = await prisma.$transaction([
    prisma.projectMember.delete({
      where: { id: memberId },
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    prisma.projectChange.create({
      data: {
        projectId: row.projectId, entity: "Member", entityId: row.employeeId,
        entityName: `${row.employee.firstName} ${row.employee.lastName}`,
        field: "Member", oldValue: row.holder, newValue: null, action: "delete",
        actorId: me.userId, actorName: me.name,
      },
    }),
  ]);
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Project > Projects", description: `Removed ${m.employee.firstName} ${m.employee.lastName} from a project`, user: { id: me.userId, name: me.name } });
  done(PATH, `${m.employee.firstName} ${m.employee.lastName} removed.`);
}

export async function deleteProject(projectId: string) {
  const me = await requireProjectMember(projectId);
  const p = await prisma.project.delete({ where: { id: projectId }, select: { name: true } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Project > Projects", description: `Deleted project ${p.name}`, user: { id: me.userId, name: me.name } });
  done(PATH, `${p.name} deleted.`);
}
