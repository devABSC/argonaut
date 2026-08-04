import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { effectiveAccess, grantsToJson } from "./access";
import type { User } from "@prisma/client";
import type { RoleKey } from "./roles";

export { PASSWORD_MAX_AGE_DAYS, passwordExpired, needsPasswordChange } from "./password-policy";

const SESSION_COOKIE = "argonaut_session";
const SESSION_DAYS = 30;

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// Session tokens must be unguessable — Math.random() is not a CSPRNG and would
// let an attacker forge a session, bypassing every role check below.
function randToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export async function createSession(userId: string): Promise<void> {
  const token = randToken();

  // Resolved once, here, rather than on every page this person opens.
  const who = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: { select: { key: true } } },
  });
  const access = who
    ? grantsToJson(await effectiveAccess({ id: who.id, role: who.role.key as RoleKey }))
    : undefined;

  await prisma.session.create({
    data: {
      token, userId,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5),
      access,
      accessAt: access ? new Date() : null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, with `role` flattened to its stable key. */
export type SessionUser = Omit<User, "role"> & {
  role: RoleKey;
  roleId: string;
  /** The privileges resolved at sign-in, as stored on the session. */
  access?: unknown;
  sessionToken?: string;
};


export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { role: { select: { key: true } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  // Re-checked on every request, so a suspension or rejection takes effect
  // immediately rather than waiting for the 30-day cookie to lapse.
  if (session.user.status !== "ACTIVE") return null;

  const { role, ...rest } = session.user;
  // Carried along so the gate does not have to ask the database again.
  return { ...rest, role: role.key as RoleKey, access: session.access, sessionToken: token };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
