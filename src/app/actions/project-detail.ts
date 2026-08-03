"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
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
    select: { name: true, description: true, status: true, launchedAt: true, closedAt: true },
  });
  if (!before) return;

  const after = {
    name,
    description: text(formData, "description"),
    status: String(formData.get("status") ?? "Planning"),
    launchedAt,
    closedAt,
  };
  const changes = diff(before, after, {
    name: "Project name", description: "Description", status: "Status",
    launchedAt: "Date launched", closedAt: "Date closed",
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
  done(where, changes.length ? `Project saved — ${changes.length} field${changes.length === 1 ? "" : "s"} changed.` : "Nothing changed.");
}

export async function addMilestone(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const me = await requireProjectMember(projectId);
  const name = String(formData.get("name") ?? "").trim();
  const where = at(projectId, "milestone");
  if (!projectId || !name) done(where, "Not added — a milestone needs a name.");

  await prisma.milestone.create({
    data: {
      projectId,
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

export async function deleteMilestone(id: string) {
  const owner = await prisma.milestone.findUnique({ where: { id }, select: { projectId: true } });
  if (!owner) return;
  const me = await requireProjectMember(owner.projectId);
  const m = await prisma.milestone.delete({ where: { id }, select: { name: true, projectId: true } });
  const where = at(m.projectId, "milestone");
  revalidatePath(where);
  await logHistory({ type: "delete", module: "Project > Milestones", description: `Deleted milestone ${m.name}`, user: { id: me.userId, name: me.name } });
  done(where, `Milestone "${m.name}" deleted.`);
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
