"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, createSession, destroySession } from "@/lib/auth";

export type AuthState = { error?: string; notice?: string };

const STATUS_MESSAGE: Record<AccountStatus, string> = {
  PENDING: "Your registration is awaiting HR approval. You'll be able to sign in once it's approved.",
  REJECTED: "This registration was not approved. Contact HR if you think that's a mistake.",
  SUSPENDED: "This account is suspended. Contact HR or your administrator.",
  ACTIVE: "",
};

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (!password) return { error: "Enter your password." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }
  if (user.status !== "ACTIVE") return { error: STATUS_MESSAGE[user.status] };

  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (!name) return { error: "Enter your name." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "That email already has an account — sign in instead." };
  }

  // Bootstrap: the very first account owns the system and is active immediately,
  // since there is nobody yet who could approve it. Everyone after self-registers
  // as a pending Employee until an HR Supervisor or Super User approves.
  const isFirstUser = (await prisma.user.count()) === 0;

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      role: { connect: { key: isFirstUser ? "SUPER_USER" : "EMPLOYEE" } },
      status: isFirstUser ? "ACTIVE" : "PENDING",
      approvedAt: isFirstUser ? new Date() : null,
    },
  });

  if (!isFirstUser) {
    return { notice: "Registration received — an HR Supervisor will review it shortly." };
  }

  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}
