"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageCatalog } from "@/lib/rbac";

const PATH = "/workflow/tasks";

async function requireCatalogAdmin() {
  const u = await requireUser();
  if (!canManageCatalog({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
}

export async function createTask(formData: FormData) {
  await requireCatalogAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (await prisma.task.findUnique({ where: { name } })) throw new Error("TASK_NAME_TAKEN");

  const last = await prisma.task.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.task.create({
    data: { name, description, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  revalidatePath(PATH);
}

export async function updateTask(formData: FormData) {
  await requireCatalogAdmin();

  const id = String(formData.get("taskId") ?? "");
  if (!id) return;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return;

  const name = String(formData.get("name") ?? "").trim() || existing.name;
  const description = String(formData.get("description") ?? "").trim() || null;

  await prisma.task.update({ where: { id }, data: { name, description } });
  revalidatePath(PATH);
}

export async function deleteTask(taskId: string) {
  await requireCatalogAdmin();
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(PATH);
}
