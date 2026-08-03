"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { notifyProjectManager } from "@/lib/project-notify";
import { requireProjectMember, diff, display } from "@/lib/project-access";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

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

const at = (id: string, view: string) => `/project/project/${id}/${view}`;

/** Project Info — name, description and dates. */
export async function saveProjectInfo(formData: FormData) {
  const id = String(formData.get("projectId") ?? "");
  if (!id) return;
  const me = await requireProjectMember(id);

  const launchedAt = date(formData, "launchedAt");
  const closedAt = date(formData, "closedAt");
  const where = at(id, "project-info");
  if (launchedAt && closedAt && closedAt < launchedAt) {
    done(where, "Not saved — the close date is before the launch date.");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) done(where, "Not saved — a project needs a name.");

  const before = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true, description: true, customer: true, status: true,
      launchedAt: true, closedAt: true, managerId: true, oicManagerId: true,
    },
  });
  if (!before) return;

  const after = {
    name,
    description: text(formData, "description"),
    customer: text(formData, "customer"),
    status: String(formData.get("status") ?? "Planning"),
    launchedAt,
    closedAt,
    managerId: text(formData, "managerId"),
    oicManagerId: text(formData, "oicManagerId"),
  };
  const changes = diff(before, after, {
    name: "Project name", description: "Description", customer: "Customer", status: "Status",
    launchedAt: "Date launched", closedAt: "Date closed",
    managerId: "Project Manager", oicManagerId: "OIC Project Manager",
  });

  // Trail and update in one transaction — a saved change must never exist
  // without its record of what it replaced.
  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: after }),
    prisma.projectChange.createMany({
      data: changes.map((c) => ({
        projectId: id, entity: "Project", entityName: before.name, ...c,
        actorId: me.userId, actorName: me.name,
      })),
    }),
  ]);

  revalidatePath(where);
  await logHistory({ type: "update", module: "Project > Projects", description: `Saved project ${name}`, user: { id: me.userId, name: me.name } });
  // Handing the project to someone new is itself an assignment worth telling
  // them about. Re-saving the same manager is not.
  if (after.managerId && after.managerId !== before.managerId) {
    await notifyProjectManager(
      id,
      "You were assigned as project manager",
      `${me.name} assigned you as the project manager.`,
    );
  }
  done(where, changes.length ? `Project saved — ${changes.length} field${changes.length === 1 ? "" : "s"} changed.` : "Nothing changed.");
}

export async function addMilestone(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const me = await requireProjectMember(projectId);
  const name = String(formData.get("name") ?? "").trim();
  const where = at(projectId, "milestone");
  if (!projectId || !name) done(where, "Not added — a milestone needs a name.");

  // New milestones go at the end of the run; the arrows move them from there.
  const last = await prisma.milestone.findFirst({
    where: { projectId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });

  await prisma.milestone.create({
    data: {
      projectId,
      seq: (last?.seq ?? 0) + 1,
      name,
      description: text(formData, "description"),
      dueDate: date(formData, "dueDate"),
      status: String(formData.get("status") ?? "Pending"),
      ownerId: text(formData, "ownerId"),
    },
  });

  revalidatePath(where);
  await logHistory({ type: "create", module: "Project > Milestones", description: `Added milestone ${name}`, user: { id: me.userId, name: me.name } });
  done(where, `Milestone "${name}" added.`);
}

export async function setMilestoneStatus(formData: FormData) {
  const id = String(formData.get("milestoneId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) return;

  const prev = await prisma.milestone.findUnique({ where: { id }, select: { projectId: true, status: true } });
  if (!prev) return;
  const me = await requireProjectMember(prev.projectId);

  const m = await prisma.milestone.update({
    where: { id },
    data: { status, completedAt: status === "Done" ? new Date() : null },
    select: { name: true, projectId: true },
  });

  const where = at(m.projectId, "milestone");
  revalidatePath(where);
  await logHistory({ type: "update", module: "Project > Milestones", description: `${m.name} → ${status}`, user: { id: me.userId, name: me.name } });
  done(where, `${m.name} is now ${status}.`);
}

/** Rename a milestone, and fix its description while we are there. */
export async function renameMilestone(formData: FormData) {
  const id = String(formData.get("milestoneId") ?? "");
  if (!id) return;

  const before = await prisma.milestone.findUnique({
    where: { id },
    select: { projectId: true, name: true, description: true },
  });
  if (!before) return;
  const me = await requireProjectMember(before.projectId);

  const where = at(before.projectId, "milestone");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) done(where, "Not saved — a milestone needs a name.");

  const description = text(formData, "description");
  const changes = diff(before, { name, description }, { name: "Milestone", description: "Description" });
  if (changes.length === 0) done(where, "Nothing changed.");

  // Trail and update together, so a renamed milestone always carries what it
  // used to be called.
  await prisma.$transaction([
    prisma.milestone.update({ where: { id }, data: { name, description } }),
    prisma.projectChange.createMany({
      data: changes.map((c) => ({
        projectId: before.projectId, entity: "Milestone", entityId: id,
        entityName: before.name, ...c, actorId: me.userId, actorName: me.name,
      })),
    }),
  ]);

  revalidatePath(where);
  await logHistory({ type: "update", module: "Project > Milestones", description: `Renamed milestone ${before.name} to ${name}`, user: { id: me.userId, name: me.name } });
  done(where, `Milestone saved as "${name}".`);
}

export async function deleteMilestone(id: string) {
  const owner = await prisma.milestone.findUnique({
    where: { id },
    select: { projectId: true, name: true, _count: { select: { tasks: true } } },
  });
  if (!owner) return;
  const me = await requireProjectMember(owner.projectId);

  // The row's delete button is disabled once a milestone has tasks, but the
  // action is reachable on its own — the tasks are protected here, not in the
  // markup.
  if (owner._count.tasks > 0) {
    done(
      at(owner.projectId, "milestone"),
      `"${owner.name}" still has ${owner._count.tasks} task${owner._count.tasks === 1 ? "" : "s"} — close or delete them first.`,
    );
  }

  const m = await prisma.milestone.delete({ where: { id }, select: { name: true, projectId: true } });
  const where = at(m.projectId, "milestone");
  revalidatePath(where);
  await logHistory({ type: "delete", module: "Project > Milestones", description: `Deleted milestone ${m.name}`, user: { id: me.userId, name: me.name } });
  done(where, `Milestone "${m.name}" deleted.`);
}

/**
 * A task under a milestone. Adding one only needs project membership — the
 * person carrying a milestone is picked from the project's members, so the
 * membership check already covers "the member who received the milestone",
 * without locking out the manager who needs to add on their behalf.
 */
/**
 * Move a milestone one place up or down the run. Swaps positions with its
 * neighbour in a transaction, so two people reordering at once can never leave
 * a project with two milestones claiming the same spot.
 */
export async function moveMilestone(id: string, dir: "up" | "down") {
  const me_ = await prisma.milestone.findUnique({
    where: { id },
    select: { projectId: true, seq: true, name: true },
  });
  if (!me_) return;
  const me = await requireProjectMember(me_.projectId);

  const neighbour = await prisma.milestone.findFirst({
    where:
      dir === "up"
        ? { projectId: me_.projectId, seq: { lt: me_.seq } }
        : { projectId: me_.projectId, seq: { gt: me_.seq } },
    orderBy: { seq: dir === "up" ? "desc" : "asc" },
    select: { id: true, seq: true },
  });

  const where = at(me_.projectId, "milestone");
  // Already at the end of the run — nothing to swap with.
  if (!neighbour) done(where, `"${me_.name}" is already ${dir === "up" ? "first" : "last"}.`);

  await prisma.$transaction([
    prisma.milestone.update({ where: { id }, data: { seq: neighbour.seq } }),
    prisma.milestone.update({ where: { id: neighbour.id }, data: { seq: me_.seq } }),
  ]);

  revalidatePath(where);
  await logHistory({ type: "update", module: "Project > Milestones", description: `Moved ${me_.name} ${dir}`, user: { id: me.userId, name: me.name } });
  done(where, `"${me_.name}" moved ${dir}.`);
}

export async function addMilestoneTask(formData: FormData) {
  const milestoneId = String(formData.get("milestoneId") ?? "");
  if (!milestoneId) return;

  const m = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { projectId: true, name: true },
  });
  if (!m) return;
  const me = await requireProjectMember(m.projectId);

  const where = at(m.projectId, "milestone");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) done(where, "Not added — a task needs a name.");

  const startedAt = date(formData, "startedAt");
  const closedAt = date(formData, "closedAt");
  if (startedAt && closedAt && closedAt < startedAt) {
    done(where, "Not added — the close date is before the start date.");
  }

  const status = String(formData.get("status") ?? "Open") === "Closed" ? "Closed" : "Open";

  await prisma.milestoneTask.create({
    data: {
      milestoneId,
      name,
      description: text(formData, "description"),
      startedAt,
      // Closing a task without saying when stamps now, so a closed task always
      // carries a date.
      closedAt: status === "Closed" ? (closedAt ?? new Date()) : closedAt,
      status,
      createdById: me.userId,
    },
  });

  revalidatePath(where);
  await logHistory({ type: "create", module: "Project > Milestones", description: `Added task ${name} under ${m.name}`, user: { id: me.userId, name: me.name } });
  await notifyProjectManager(
    m.projectId,
    "A task was added to your project",
    `${me.name} added the task "${name}" under the milestone ${m.name}.`,
  );
  done(where, `Task "${name}" added under ${m.name}.`);
}

export async function setMilestoneTaskStatus(formData: FormData) {
  const id = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || (status !== "Open" && status !== "Closed")) return;

  const prev = await prisma.milestoneTask.findUnique({
    where: { id },
    select: { milestone: { select: { projectId: true } } },
  });
  if (!prev) return;
  const me = await requireProjectMember(prev.milestone.projectId);

  const t = await prisma.milestoneTask.update({
    where: { id },
    data: { status, closedAt: status === "Closed" ? new Date() : null },
    select: { name: true, milestone: { select: { projectId: true } } },
  });

  const where = at(t.milestone.projectId, "milestone");
  revalidatePath(where);
  await logHistory({ type: "update", module: "Project > Milestones", description: `Task ${t.name} → ${status}`, user: { id: me.userId, name: me.name } });
  done(where, `Task "${t.name}" is now ${status.toLowerCase()}.`);
}

export async function deleteMilestoneTask(id: string) {
  const owner = await prisma.milestoneTask.findUnique({
    where: { id },
    select: { milestone: { select: { projectId: true } } },
  });
  if (!owner) return;
  const me = await requireProjectMember(owner.milestone.projectId);

  const t = await prisma.milestoneTask.delete({
    where: { id },
    select: { name: true, milestone: { select: { projectId: true } } },
  });
  const where = at(t.milestone.projectId, "milestone");
  revalidatePath(where);
  await logHistory({ type: "delete", module: "Project > Milestones", description: `Deleted task ${t.name}`, user: { id: me.userId, name: me.name } });
  done(where, `Task "${t.name}" deleted.`);
}

export async function addRoadblock(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const me = await requireProjectMember(projectId);
  const description = String(formData.get("description") ?? "").trim();
  const where = at(projectId, "roadblocks");
  if (!projectId || !description) done(where, "Not added — describe what is blocking the work.");

  await prisma.roadblock.create({
    data: {
      projectId,
      description,
      severity: String(formData.get("severity") ?? "Medium"),
      status: String(formData.get("status") ?? "Open"),
      ownerId: text(formData, "ownerId"),
    },
  });

  revalidatePath(where);
  await logHistory({ type: "create", module: "Project > Roadblocks", description: "Raised a roadblock", user: { id: me.userId, name: me.name } });
  done(where, "Roadblock raised.");
}

export async function setRoadblockStatus(formData: FormData) {
  const id = String(formData.get("roadblockId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) return;

  const prev = await prisma.roadblock.findUnique({ where: { id }, select: { projectId: true, status: true } });
  if (!prev) return;
  const me = await requireProjectMember(prev.projectId);

  const r = await prisma.roadblock.update({
    where: { id },
    data: { status, resolvedAt: status === "Resolved" ? new Date() : null },
    select: { projectId: true },
  });

  const where = at(r.projectId, "roadblocks");
  revalidatePath(where);
  await logHistory({ type: "update", module: "Project > Roadblocks", description: `Roadblock → ${status}`, user: { id: me.userId, name: me.name } });
  done(where, `Roadblock marked ${status}.`);
}

export async function deleteRoadblock(id: string) {
  const owner = await prisma.roadblock.findUnique({ where: { id }, select: { projectId: true } });
  if (!owner) return;
  const me = await requireProjectMember(owner.projectId);
  const r = await prisma.roadblock.delete({ where: { id }, select: { projectId: true } });
  const where = at(r.projectId, "roadblocks");
  revalidatePath(where);
  await logHistory({ type: "delete", module: "Project > Roadblocks", description: "Deleted a roadblock", user: { id: me.userId, name: me.name } });
  done(where, "Roadblock deleted.");
}

export async function addRisk(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const me = await requireProjectMember(projectId);
  const description = String(formData.get("description") ?? "").trim();
  const where = at(projectId, "risks");
  if (!projectId || !description) done(where, "Not added — describe the risk.");

  await prisma.risk.create({
    data: {
      projectId,
      description,
      likelihood: String(formData.get("likelihood") ?? "Medium"),
      impact: String(formData.get("impact") ?? "Medium"),
      mitigation: text(formData, "mitigation"),
      status: String(formData.get("status") ?? "Open"),
      ownerId: text(formData, "ownerId"),
    },
  });

  revalidatePath(where);
  await logHistory({ type: "create", module: "Project > Risks", description: "Logged a risk", user: { id: me.userId, name: me.name } });
  done(where, "Risk logged.");
}

export async function setRiskStatus(formData: FormData) {
  const id = String(formData.get("riskId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) return;

  const prev = await prisma.risk.findUnique({ where: { id }, select: { projectId: true, status: true } });
  if (!prev) return;
  const me = await requireProjectMember(prev.projectId);

  const r = await prisma.risk.update({
    where: { id },
    data: { status, closedAt: status === "Closed" ? new Date() : null },
    select: { projectId: true },
  });

  const where = at(r.projectId, "risks");
  revalidatePath(where);
  await logHistory({ type: "update", module: "Project > Risks", description: `Risk → ${status}`, user: { id: me.userId, name: me.name } });
  done(where, `Risk marked ${status}.`);
}

export async function deleteRisk(id: string) {
  const owner = await prisma.risk.findUnique({ where: { id }, select: { projectId: true } });
  if (!owner) return;
  const me = await requireProjectMember(owner.projectId);
  const r = await prisma.risk.delete({ where: { id }, select: { projectId: true } });
  const where = at(r.projectId, "risks");
  revalidatePath(where);
  await logHistory({ type: "delete", module: "Project > Risks", description: "Deleted a risk", user: { id: me.userId, name: me.name } });
  done(where, "Risk deleted.");
}
