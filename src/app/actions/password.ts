"use server";

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { logHistory } from "@/lib/log";

export type ResetState = { error?: string; notice?: string; stage?: "request" | "verify" };

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

/** Six digits, uniformly random — Math.random is not good enough for this. */
function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Step one: email a one-time code.
 *
 * The reply never reveals whether the address exists — otherwise this becomes
 * a way to enumerate accounts. Suspended and pending accounts get the same
 * silence.
 */
export async function requestReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email.", stage: "request" };

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.status === "ACTIVE") {
    // Retire any code still outstanding, so only the newest works.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = newCode();
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
      },
    });

    await notify({
      to: email,
      kind: "password_reset",
      subject: `Argonaut password reset code: ${code}`,
      body: [
        `Hello ${user.name},`,
        ``,
        `Your password reset code is ${code}.`,
        `It expires in ${CODE_TTL_MIN} minutes and can be used once.`,
        ``,
        `If you did not ask for this, ignore this email — your password has not changed.`,
      ].join("\n"),
    });

    await logHistory({
      type: "request", module: "Sign in > Forgot password",
      description: `Reset code issued for ${email}`, user: null,
    });
  }

  return {
    stage: "verify",
    notice: `If ${email} has an active account, a code is on its way. It expires in ${CODE_TTL_MIN} minutes.`,
  };
}

/**
 * Step two: check the code, then set the new password.
 *
 * A correct code is required every time — there is no path here that changes a
 * password without one. Every session is dropped afterwards, so anyone already
 * signed in with the old password is turned out.
 */
export async function confirmReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!/^\d{6}$/.test(code)) return { error: "The code is six digits.", stage: "verify" };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", stage: "verify" };
  if (password !== confirm) return { error: "The two passwords do not match.", stage: "verify" };

  const user = await prisma.user.findUnique({ where: { email } });
  const bad = { error: "That code is wrong or has expired.", stage: "verify" as const };
  if (!user || user.status !== "ACTIVE") return bad;

  const reset = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!reset) return bad;

  if (reset.attempts >= MAX_ATTEMPTS) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
    return { error: "Too many attempts. Request a new code.", stage: "request" };
  }

  if (!(await bcrypt.compare(code, reset.codeHash))) {
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { attempts: { increment: 1 } },
    });
    return bad;
  }

  // Refuse the password they are already using — expiry must mean a real change.
  if (await bcrypt.compare(password, user.passwordHash)) {
    return { error: "Choose a password you have not used here before.", stage: "verify" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    // Anyone holding a session signed in under the old password.
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  await logHistory({
    type: "update", module: "Sign in > Forgot password",
    description: `Password reset completed for ${email}`, user: null,
  });

  return { notice: "Password changed. Sign in with your new password." };
}
