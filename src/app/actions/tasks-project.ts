"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const PATH = "/project/tasks";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

async function requireProjectUser() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role }) && u.role !== "SUPERVISOR") {
    throw new Error("FORBIDDEN");
  }
  return u;
}

export async function createProjectTask(formData: FormData) {
  const me = await requireProjectUser();

  const description = String(formData.get("description") ?? "").trim();
  if (!description) done(PATH, "Nothing saved — a task needs a description.");

  const assigneeId = text(formData, "assigneeId");
  const bouId = text(formData, "bouId");

  // The assignee must actually sit in the chosen BOU — the picker enforces it,
  // but a stale form could post a mismatch.
  const assignee = assigneeId
    ? await prisma.employee.findUnique({
        where: { id: assigneeId },
        select: { firstName: true, lastName: true, bouId: true },
      })
    : null;
  if (assigneeId && !assignee) done(PATH, "That employee no longer exists.");
  if (assignee && bouId && assignee.bouId !== bouId) {
    done(PATH, "That employee is not in the chosen BOU — pick the BOU again.");
  }

  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const dueDate = dueRaw ? new Date(`${dueRaw}T00:00:00Z`) : null;

  const task = await prisma.projectTask.create({
    data: {
      description,
      title: text(formData, "title"),
      bouId,
      assigneeId,
      status: String(formData.get("status") ?? "Open"),
      priority: String(formData.get("priority") ?? "Normal"),
      dueDate: dueDate && !isNaN(+dueDate) ? dueDate : null,
      createdById: me.id,
    },
  });

  revalidatePath(PATH);
  await logHistory({
    type: "create", module: "Project > Tasks",
    description: assignee
      ? `Assigned a task to ${assignee.firstName} ${assignee.lastName}`
      : "Raised an unassigned task",
    user: me,
  });
  done(
    PATH,
    assignee
      ? `Task assigned to ${assignee.firstName} ${assignee.lastName}.`
      : `Task added — nobody assigned yet (${task.id.slice(-6).toUpperCase()}).`,
  );
}

export async function setTaskStatus(formData: FormData) {
  const me = await requireProjectUser();

  const id = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) return;

  const t = await prisma.projectTask.update({
    where: { id },
    data: { status, doneAt: status === "Done" ? new Date() : null },
    select: { assignee: { select: { firstName: true, lastName: true } } },
  });

  revalidatePath(PATH);
  await logHistory({
    type: "update", module: "Project > Tasks",
    description: `Task for ${t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "nobody"} → ${status}`,
    user: me,
  });
  done(PATH, `Task marked ${status}.`);
}

export async function deleteProjectTask(taskId: string) {
  const me = await requireProjectUser();
  await prisma.projectTask.delete({ where: { id: taskId } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Project > Tasks", description: "Deleted a task", user: me });
  done(PATH, "Task deleted.");
}
