import { promises as dnsp } from "dns";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "./prisma";
import { getMailgunConfig, mailgunConfigured, sendViaMailgun } from "./mailgun";

/**
 * Two transports, chosen per recipient — the approach benta settled on.
 *
 * Mailbox hosted by Gmail / Yahoo / Outlook  -> Mailgun (they accept it, and
 *   we get delivery tracking).
 * Everyone else, especially corporate filters -> SMTP, whose sending domain
 *   has full A/MX records and clears strict checks.
 *
 * Every notification is written to the outbox first, so nothing is lost when
 * neither transport is configured — that is also the local dev behaviour.
 */

const mxCache = new Map<string, boolean>();

function isConsumerProvider(domain: string): boolean {
  if (domain === "gmail.com" || domain === "googlemail.com") return true;
  if (domain === "ymail.com" || domain === "rocketmail.com" || /(^|\.)yahoo\./.test(domain)) return true;
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return true;
  return /(^|\.)(outlook|hotmail|live)\./.test(domain);
}

/** True when the recipient is hosted by a provider that likes Mailgun. */
export async function routeToMailgun(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  if (isConsumerProvider(domain)) return true;
  if (mxCache.has(domain)) return mxCache.get(domain)!;

  let friendly = false;
  try {
    const hosts = (await dnsp.resolveMx(domain)).map((m) => m.exchange.toLowerCase());
    friendly = hosts.some(
      (h) =>
        /(^|\.)google(mail)?\.com$|aspmx\.l\.google\.com$/.test(h) ||
        /(^|\.)protection\.outlook\.com$|(^|\.)outlook\.com$/.test(h) ||
        /(^|\.)yahoodns\.net$/.test(h),
    );
  } catch {
    friendly = false; // DNS trouble falls back to SMTP
  }
  mxCache.set(domain, friendly);
  return friendly;
}

/** The SMTP password is read fresh so it can be rotated without a redeploy. */
async function smtpPass(): Promise<string | undefined> {
  const row = await prisma.setting.findUnique({ where: { key: "smtp_pass" } }).catch(() => null);
  return row?.value || process.env.SMTP_PASS || undefined;
}

async function getTransport(): Promise<Transporter | null> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = await smtpPass();
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export interface NotifyInput {
  to: string;
  subject: string;
  body: string;
  kind: string;
  requestId?: string;
  fromName?: string;
}

/**
 * Records the notification, then tries to deliver it. Never throws — a mail
 * problem must not roll back the action that triggered it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const note = await prisma.notification.create({
    data: {
      channel: "email",
      to: input.to,
      subject: input.subject,
      body: input.body,
      kind: input.kind,
      requestId: input.requestId ?? null,
    },
  });

  try {
    const preferMailgun = (await mailgunConfigured()) && (await routeToMailgun(input.to));

    if (preferMailgun) {
      const { id } = await sendViaMailgun({
        to: input.to, subject: input.subject, text: input.body, fromName: input.fromName,
      });
      await prisma.notification.update({
        where: { id: note.id },
        data: { provider: "mailgun", providerId: id || null, status: "sent", sentAt: new Date() },
      });
      return;
    }

    const tx = await getTransport();
    if (!tx) {
      // Nothing configured: the outbox row is the record. Local dev behaviour.
      console.log(`✉️  [log-only → ${input.to}] ${input.subject}`);
      await prisma.notification.update({
        where: { id: note.id },
        data: { status: "queued", failReason: "no transport configured" },
      });
      return;
    }

    const from = process.env.MAIL_FROM ?? (await getMailgunConfig()).from ?? "Argonaut <no-reply@localhost>";
    await tx.sendMail({
      from: input.fromName ? `${input.fromName} <${from.replace(/^.*</, "").replace(/>$/, "")}>` : from,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    await prisma.notification.update({
      where: { id: note.id },
      data: { provider: "smtp", status: "sent", sentAt: new Date() },
    });
  } catch (e) {
    await prisma.notification.update({
      where: { id: note.id },
      data: { status: "failed", failedAt: new Date(), failReason: String((e as Error).message).slice(0, 300) },
    });
    console.error("notify failed:", (e as Error).message);
  }
}
