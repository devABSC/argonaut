"use server";

import { revalidatePath } from "next/cache";
import type { StepActor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageCatalog } from "@/lib/rbac";

const PATH = "/workflow/routes";

async function requireCatalogAdmin() {
  const u = await requireUser();
  if (!canManageCatalog({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
}

function readRow(formData: FormData) {
  const actorRaw = String(formData.get("actor") ?? "APPROVER");
  const actor: StepActor = actorRaw === "REQUESTOR" ? "REQUESTOR" : "APPROVER";
  const sla = Number(formData.get("slaDays") ?? 1);

  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    slaDays: Number.isFinite(sla) && sla > 0 ? Math.floor(sla) : 1,
    actor,
    groupName: String(formData.get("groupName") ?? "").trim() || null,
    // A requestor step has no approvers — the requester is implicitly the actor.
    approverIds:
      actor === "APPROVER"
        ? formData.getAll("approverIds").map(String).filter(Boolean)
        : [],
  };
}

export async function addStep(formData: FormData) {
  await requireCatalogAdmin();

  const subcategoryId = String(formData.get("subcategoryId") ?? "");
  const row = readRow(formData);
  if (!subcategoryId || !row.name) return;

  const last = await prisma.workflowStep.findFirst({
    where: { subcategoryId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  await prisma.workflowStep.create({
    data: {
      subcategoryId,
      sequence: (last?.sequence ?? 0) + 1,
      name: row.name,
      description: row.description,
      slaDays: row.slaDays,
      actor: row.actor,
      groupName: row.groupName,
      approvers: { create: row.approverIds.map((userId) => ({ userId })) },
    },
  });
  revalidatePath(PATH);
}

export async function saveStep(formData: FormData) {
  await requireCatalogAdmin();

  const id = String(formData.get("stepId") ?? "");
  if (!id) return;

  const existing = await prisma.workflowStep.findUnique({ where: { id } });
  if (!existing) return;

  const row = readRow(formData);

  await prisma.workflowStep.update({
    where: { id },
    data: {
      name: row.name || existing.name,
      description: row.description,
      slaDays: row.slaDays,
      actor: row.actor,
      groupName: row.groupName,
      // Replaced wholesale — simpler than diffing, and the set is tiny.
      approvers: {
        deleteMany: {},
        create: row.approverIds.map((userId) => ({ userId })),
      },
    },
  });
  revalidatePath(PATH);
}

export async function deleteStep(stepId: string) {
  await requireCatalogAdmin();

  const step = await prisma.workflowStep.findUnique({ where: { id: stepId } });
  if (!step) return;

  await prisma.workflowStep.delete({ where: { id: stepId } });

  // Close the gap so sequences stay 1..n. Parked negative first because
  // (subcategoryId, sequence) is unique.
  const rest = await prisma.workflowStep.findMany({
    where: { subcategoryId: step.subcategoryId },
    orderBy: { sequence: "asc" },
  });
  await prisma.$transaction([
    ...rest.map((r, i) =>
      prisma.workflowStep.update({ where: { id: r.id }, data: { sequence: -(i + 1) } }),
    ),
    ...rest.map((r, i) =>
      prisma.workflowStep.update({ where: { id: r.id }, data: { sequence: i + 1 } }),
    ),
  ]);
  revalidatePath(PATH);
}
