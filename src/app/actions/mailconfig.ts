"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logHistory } from "@/lib/log";
import { done } from "@/lib/flash";
import { MAIL_KEYS, MAIL_SECRETS as SECRET } from "@/lib/mailkeys";

const PATH = "/settings/email";

/** Only the owner touches sending credentials. */
async function requireOwner() {
  const u = await requireUser();
  if (u.role !== "SUPER_USER") throw new Error("FORBIDDEN");
  return u;
}



/** Present state, with secrets reported as set/unset rather than echoed back. */
export async function mailConfig() {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...MAIL_KEYS] } } });
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  return MAIL_KEYS.map((key) => ({
    key,
    secret: SECRET.has(key),
    // A secret is never sent to the browser — only whether one exists.
    value: SECRET.has(key) ? "" : (stored.get(key) ?? ""),
    isSet: Boolean(stored.get(key)),
    fromEnv: !stored.get(key) && Boolean(process.env[key.toUpperCase()]),
  }));
}

export async function saveMailConfig(formData: FormData) {
  const me = await requireOwner();

  const changed: string[] = [];
  for (const key of MAIL_KEYS) {
    const raw = formData.get(key);
    if (raw === null) continue;
    const value = String(raw).trim();

    // An empty secret means "leave it alone", not "clear it" — otherwise
    // saving the form would wipe a password you cannot see.
    if (SECRET.has(key) && value === "") continue;

    if (value === "") {
      await prisma.setting.deleteMany({ where: { key } });
    } else {
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    changed.push(key);
  }

  revalidatePath(PATH, "layout");
  await logHistory({
    type: "update", module: "Settings > Email",
    // Never log the values themselves.
    description: `Updated mail settings: ${changed.join(", ") || "nothing"}`,
    user: me,
  });
  done(PATH, changed.length ? `Saved ${changed.length} mail setting(s).` : "Nothing changed.");
}

export async function clearMailSecret(key: string) {
  const me = await requireOwner();
  if (!SECRET.has(key)) throw new Error("NOT_A_SECRET");

  await prisma.setting.deleteMany({ where: { key } });
  revalidatePath(PATH, "layout");
  await logHistory({
    type: "delete", module: "Settings > Email",
    description: `Cleared ${key}`, user: me,
  });
  done(PATH, `${key} cleared — the environment variable takes over again.`);
}
