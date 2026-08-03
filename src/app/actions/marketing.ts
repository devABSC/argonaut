"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { notify } from "@/lib/notify";
import { logHistory } from "@/lib/log";
import { done } from "@/lib/flash";

const TEMPLATES = "/marketing/templates";
const SEND = "/marketing/send";

async function requireMarketer() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
  return u;
}

/** Splits on commas, semicolons or newlines and keeps what looks like an address. */
export async function parseEmails(raw: string): Promise<string[]> {
  return [...new Set(
    raw.split(/[,;\n]/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
  )];
}

function splitEmails(raw: string): string[] {
  return [...new Set(
    raw.split(/[,;\n]/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
  )];
}

/* ----------------------------------------------------------- templates --- */

export async function saveTemplate(formData: FormData) {
  const me = await requireMarketer();

  const id = String(formData.get("templateId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const data = {
    name,
    subject: String(formData.get("subject") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    signature: String(formData.get("signature") ?? "").trim(),
  };

  if (id) {
    await prisma.emailTemplate.update({ where: { id }, data });
  } else {
    if (await prisma.emailTemplate.findUnique({ where: { name } })) {
      throw new Error("TEMPLATE_NAME_TAKEN");
    }
    await prisma.emailTemplate.create({
      data: { ...data, createdById: me.id, createdByName: me.name },
    });
  }

  revalidatePath(TEMPLATES);
  await logHistory({
    type: id ? "update" : "create", module: "Marketing > Templates",
    description: `${id ? "Saved" : "Added"} template ${name}`, user: me,
  });
  done(TEMPLATES, `Template ${name} ${id ? "saved" : "added"}.`);
}

export async function deleteTemplate(templateId: string) {
  const me = await requireMarketer();
  const t = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
  if (!t) return;

  await prisma.emailTemplate.delete({ where: { id: templateId } });
  revalidatePath(TEMPLATES);
  await logHistory({
    type: "delete", module: "Marketing > Templates",
    description: `Deleted template ${t.name}`, user: me,
  });
  done(TEMPLATES, `Template ${t.name} deleted.`);
}

/* ---------------------------------------------------------------- send --- */

/**
 * Sends one personalised email per recipient rather than a BCC blast — it
 * lands better and each gets its own outbox row. Unsubscribed addresses are
 * dropped, and anyone who already received this template is skipped unless
 * the sender ticks resend.
 */
export async function sendCampaign(formData: FormData) {
  const me = await requireMarketer();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const signature = String(formData.get("signature") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();
  const resend = formData.get("resend") === "on";

  const parsed = splitEmails(String(formData.get("recipients") ?? ""));
  if (!subject || !body || parsed.length === 0) {
    done(SEND, "Nothing sent — a subject, a body and at least one valid address are required.");
  }

  const suppressed = new Set(
    (await prisma.suppression.findMany({
      where: { email: { in: parsed } }, select: { email: true },
    })).map((s) => s.email),
  );
  let recipients = parsed.filter((e) => !suppressed.has(e));
  const unsubscribed = parsed.length - recipients.length;

  let alreadySent = 0;
  if (templateId && !resend) {
    const seen = new Set(
      (await prisma.emailTemplateRecipient.findMany({
        where: { templateId, email: { in: recipients } }, select: { email: true },
      })).map((r) => r.email),
    );
    alreadySent = recipients.filter((e) => seen.has(e)).length;
    recipients = recipients.filter((e) => !seen.has(e));
  }

  if (recipients.length === 0) {
    done(SEND, `Nothing sent — ${unsubscribed} unsubscribed, ${alreadySent} already had this template.`);
  }

  const text = [body, signature].filter(Boolean).join("\n\n");
  for (const to of recipients) {
    await notify({ to, subject, body: text, kind: "marketing" });
    if (templateId) {
      await prisma.emailTemplateRecipient
        .create({ data: { templateId, email: to } })
        .catch(() => {/* already logged for this template */});
    }
  }

  await logHistory({
    type: "send", module: "Marketing > Send",
    description: `Sent "${subject}" to ${recipients.length} recipient(s)`, user: me,
  });

  const extra = [
    unsubscribed ? `${unsubscribed} unsubscribed` : "",
    alreadySent ? `${alreadySent} already had it` : "",
  ].filter(Boolean).join(", ");

  done(SEND, `Sent to ${recipients.length} recipient(s)${extra ? ` — skipped ${extra}` : ""}.`);
}

export async function addSuppression(formData: FormData) {
  const me = await requireMarketer();
  const emails = splitEmails(String(formData.get("emails") ?? ""));
  if (emails.length === 0) return;

  const reason = String(formData.get("reason") ?? "").trim() || null;
  for (const email of emails) {
    await prisma.suppression.upsert({ where: { email }, update: { reason }, create: { email, reason } });
  }

  revalidatePath(SEND);
  await logHistory({
    type: "create", module: "Marketing > Suppression",
    description: `Suppressed ${emails.length} address(es)`, user: me,
  });
  done(SEND, `${emails.length} address(es) added to the unsubscribe list.`);
}

export async function removeSuppression(email: string) {
  const me = await requireMarketer();
  await prisma.suppression.delete({ where: { email } }).catch(() => {});
  revalidatePath(SEND);
  await logHistory({
    type: "delete", module: "Marketing > Suppression",
    description: `Removed ${email} from the unsubscribe list`, user: me,
  });
  done(SEND, `${email} removed from the unsubscribe list.`);
}
