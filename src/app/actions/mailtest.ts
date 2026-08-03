"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { notify, routeToMailgun } from "@/lib/notify";
import { mailgunConfigured } from "@/lib/mailgun";
import { logHistory } from "@/lib/log";
import { done } from "@/lib/flash";

const PATH = "/marketing/diagnostics";

/** What the engine can currently do, without sending anything. */
export async function mailStatus() {
  const smtpPass =
    (await prisma.setting.findUnique({ where: { key: "smtp_pass" } }).catch(() => null))?.value ||
    process.env.SMTP_PASS;

  return {
    smtp: {
      host: process.env.SMTP_HOST ?? null,
      port: process.env.SMTP_PORT ?? "587",
      user: process.env.SMTP_USER ? "set" : null,
      pass: smtpPass ? "set" : null,
      ready: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && smtpPass),
    },
    mailgun: {
      domain: process.env.MAILGUN_DOMAIN ?? null,
      key: process.env.MAILGUN_API_KEY ? "set" : null,
      ready: await mailgunConfigured(),
    },
    from: process.env.MAIL_FROM ?? null,
  };
}

/** Which transport a given address would take. */
export async function whichTransport(email: string): Promise<"mailgun" | "smtp"> {
  return (await mailgunConfigured()) && (await routeToMailgun(email)) ? "mailgun" : "smtp";
}

/**
 * Sends a real test email and reports exactly what happened, reading the
 * outbox row back so a failure surfaces its reason rather than vanishing.
 */
export async function sendTestEmail(formData: FormData) {
  const me = await requireUser();
  if (!canManageUsers({ id: me.id, role: me.role })) throw new Error("FORBIDDEN");

  const to = String(formData.get("to") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    done(PATH, "That does not look like an email address.");
  }

  const stamp = new Date().toISOString();
  await notify({
    to,
    kind: "test",
    subject: `Argonaut test email — ${stamp.slice(11, 19)} UTC`,
    body: [
      "This is a test from Argonaut's email engine.",
      "",
      `Sent at: ${stamp}`,
      `Requested by: ${me.name}`,
      "",
      "If you are reading this, delivery works.",
    ].join("\n"),
  });

  const row = await prisma.notification.findFirst({
    where: { to, kind: "test" },
    orderBy: { createdAt: "desc" },
  });

  await logHistory({
    type: "send", module: "Marketing > Diagnostics",
    description: `Test email to ${to} — ${row?.status ?? "unknown"}`, user: me,
  });

  if (!row) done(PATH, "Test ran but nothing was recorded — that itself is a bug.");
  if (row.status === "sent") {
    done(PATH, `Sent to ${to} via ${row.provider}. Check the inbox, and the spam folder.`);
  }
  if (row.status === "failed") {
    done(PATH, `Failed: ${row.failReason ?? "no reason recorded"}`);
  }
  done(PATH, `Queued only — no transport is configured, so nothing left the building. ${row.failReason ?? ""}`);
}
