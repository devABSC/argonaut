"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser, hashPassword } from "@/lib/auth";
import { logHistory } from "@/lib/log";
import { checkStrength } from "@/lib/password-strength";
import { isReused, rememberPassword } from "@/lib/password-history";

export type ChangeState = { error?: string };

/**
 * Changing your own password. The current one is required — a stolen session
 * should not be enough to lock the real owner out.
 */
export async function changeOwnPassword(_prev: ChangeState, formData: FormData): Promise<ChangeState> {
  const me = await requireUser();

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const weak = checkStrength(password);
  if (weak) return { error: weak };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const row = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) {
    return { error: "Your current password is not right." };
  }
  if (await isReused(me.id, password, row.passwordHash)) {
    return { error: "You have used that password before. Choose a new one." };
  }

  await rememberPassword(me.id, row.passwordHash);
  await prisma.user.update({
    where: { id: me.id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  await logHistory({
    type: "update", module: "Account",
    description: "Changed own password", user: { id: me.id, name: me.name },
  });

  redirect("/");
}

/** Flags someone to pick a new password next time they sign in. */
export async function requirePasswordChange(userId: string) {
  const me = await requireUser();
  if (me.role !== "SUPER_USER" && me.role !== "ADMINISTRATOR") throw new Error("FORBIDDEN");

  const target = await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: true, updatedById: me.id },
    select: { name: true },
  });

  await logHistory({
    type: "update", module: "Settings > Users",
    description: `Required ${target.name} to change their password`,
    user: { id: me.id, name: me.name },
  });

  const { done } = await import("@/lib/flash");
  done("/settings/users", `${target.name} will be asked to set a new password at next sign-in.`);
}
