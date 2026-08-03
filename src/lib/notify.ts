import { promises as dnsp } from "dns";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "./prisma";
import { getMailgunConfig, mailgunConfigured, sendViaMailgun } from "./mailgun";
import { renderStandard } from "./email-template";

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

/**
 * Settings saved in the UI win over environment variables, so credentials can
 * be rotated without a redeploy. Read fresh on every send.
 */
export async function smtpSettings() {
  const rows = await prisma.setting
    .findMany({ where: { key: { in: ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_secure"] } } })
    .catch(() => []);
  const s = new Map(rows.map((r) => [r.key, r.value]));

  const port = Number(s.get("smtp_port") || process.env.SMTP_PORT || 587);
  const secureRaw = s.get("smtp_secure") ?? process.env.SMTP_SECURE;

  return {
    host: s.get("smtp_host") || process.env.SMTP_HOST || undefined,
    user: s.get("smtp_user") || process.env.SMTP_USER || undefined,
    pass: s.get("smtp_pass") || process.env.SMTP_PASS || undefined,
    port,
    secure: secureRaw ? secureRaw === "true" : port === 465,
  };
}

async function getTransport(): Promise<Transporter | null> {
  const { host, user, pass, port, secure } = await smtpSettings();
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    // Fail fast rather than hanging a request for a minute.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

export interface NotifyInput {
  to: string;
  subject: string;
  body: string;
  kind: string;
  requestId?: string;
  fromName?: string;
  /**
   * Which email template dresses the message. Standard NoReply unless a
   * caller names another; pass null only for mail that must go out bare.
   */
  template?: string | null;
}

/**
 * Records the notification, then tries to deliver it. Never throws — a mail
 * problem must not roll back the action that triggered it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const { text, html } =
    input.template === null
      ? { text: input.body, html: undefined as string | undefined }
      : await renderStandard(input.subject, input.body, input.template);

  const note = await prisma.notification.create({
    data: {
      channel: "email",
      to: input.to,
      subject: input.subject,
      body: text,
      kind: input.kind,
      requestId: input.requestId ?? null,
    },
  });

  try {
    const preferMailgun = (await mailgunConfigured()) && (await routeToMailgun(input.to));

    if (preferMailgun) {
      try {
        const { id } = await sendViaMailgun({
          to: input.to, subject: input.subject, text, html, fromName: input.fromName,
        });
        await prisma.notification.update({
          where: { id: note.id },
          data: { provider: "mailgun", providerId: id || null, status: "sent", sentAt: new Date() },
        });
        return;
      } catch (e) {
        // A rejected key or an unverified domain must not swallow the message —
        // SMTP reaches every recipient Mailgun would have, just with less
        // reporting. Fall through rather than fail.
        console.error("mailgun failed, falling back to SMTP:", (e as Error).message);
      }
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

    const fromSetting = await prisma.setting.findUnique({ where: { key: "mail_from" } }).catch(() => null);
    const { user: smtpUser } = await smtpSettings();
    const from =
      fromSetting?.value ||
      process.env.MAIL_FROM ||
      (await getMailgunConfig()).from ||
      smtpUser ||
      "Argonaut <no-reply@localhost>";
    await tx.sendMail({
      from: input.fromName ? `${input.fromName} <${from.replace(/^.*</, "").replace(/>$/, "")}>` : from,
      to: input.to,
      subject: input.subject,
      text,
      html,
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
