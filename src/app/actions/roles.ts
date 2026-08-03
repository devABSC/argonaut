"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const PATH = "/settings/roles";

/** Only the owner reshapes roles — they are the basis of every access check. */
async function requireOwner() {
  const u = await requireUser();
  if (u.role !== "SUPER_USER") throw new Error("FORBIDDEN");
  return u;
}

export async function saveRole(formData: FormData) {
  const me = await requireOwner();

  const key = String(formData.get("key") ?? "");
  if (!key) return;
  const existing = await prisma.role.findUnique({ where: { key } });
  if (!existing) return;

  const rank = Number(formData.get("rank") ?? existing.rank);

  await prisma.role.update({
    where: { key },
    data: {
      label: String(formData.get("label") ?? "").trim() || existing.label,
      description: String(formData.get("description") ?? "").trim() || null,
      rank: Number.isFinite(rank) ? Math.trunc(rank) : existing.rank,
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePath(PATH, "layout");
  await logHistory({ type: "update", module: "Settings > Roles", description: `Saved role ${existing.label}`, user: me });
  done(PATH, `Role ${existing.label} saved.`);
}

/**
 * A role holding users is never removed — deleting it would strand those
 * accounts with a role nothing recognises. Built-in roles are deactivated
 * instead of deleted, since the enum they mirror is part of the schema.
 */
export async function deleteRole(key: string) {
  const me = await requireOwner();

  const profile = await prisma.role.findUnique({ where: { key } });
  if (!profile) return;

  const holders = await prisma.user.count({ where: { role: { key } } });
  if (holders > 0) throw new Error(`ROLE_IN_USE:${holders}`);

  if (profile.isSystem) {
    // Retire rather than remove: the enum member still exists in the schema.
    await prisma.role.update({ where: { key }, data: { isActive: false } });
  } else {
    await prisma.role.delete({ where: { key } });
  }

  // Drop its access-matrix rows; they mean nothing without the role.
  await prisma.menuGrant.deleteMany({ where: { role: { key } } });
  revalidatePath(PATH, "layout");
  await logHistory({ type: "delete", module: "Settings > Roles", description: `${profile.isSystem ? "Retired" : "Deleted"} role ${profile.label}`, user: me });
  done(PATH, `Role ${profile.label} ${profile.isSystem ? "retired" : "deleted"}.`);
}
