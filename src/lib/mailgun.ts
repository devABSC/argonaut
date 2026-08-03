import { prisma } from "./prisma";

/**
 * Mailgun configuration, mirroring benta: values live in the Setting table and
 * fall back to env vars, so keys can be rotated without a redeploy.
 */
export type MailgunRegion = "US" | "EU";

export interface MailgunConfig {
  domain?: string;
  region: MailgunRegion;
  apiKey?: string;
  from?: string;
}

async function setting(key: string): Promise<string | undefined> {
  const r = await prisma.setting.findUnique({ where: { key } }).catch(() => null);
  return r?.value || undefined;
}

export async function getMailgunConfig(): Promise<MailgunConfig> {
  const [domain, region, apiKey, from] = await Promise.all([
    setting("mailgun_domain"),
    setting("mailgun_region"),
    setting("mailgun_api_key"),
    setting("mail_from"),
  ]);
  return {
    domain: domain || process.env.MAILGUN_DOMAIN,
    region: ((region || process.env.MAILGUN_REGION) === "EU" ? "EU" : "US") as MailgunRegion,
    apiKey: apiKey || process.env.MAILGUN_API_KEY,
    from: from || process.env.MAIL_FROM,
  };
}

export async function mailgunConfigured(): Promise<boolean> {
  const c = await getMailgunConfig();
  return Boolean(c.domain && c.apiKey);
}

/** Sends through the Mailgun HTTP API. Returns the provider message id. */
export async function sendViaMailgun(msg: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
}): Promise<{ id: string }> {
  const c = await getMailgunConfig();
  if (!c.domain || !c.apiKey) throw new Error("MAILGUN_NOT_CONFIGURED");

  const base = c.region === "EU" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";

  // `from` may already be "Name <addr>"; pull the bare address out so a
  // per-message display name can be applied without doubling it up.
  const configured = c.from ?? `Argonaut <no-reply@${c.domain}>`;
  const address = configured.includes("<")
    ? configured.replace(/^.*</, "").replace(/>$/, "")
    : configured;
  const from = msg.fromName ? `${msg.fromName} <${address}>` : configured;

  const form = new URLSearchParams();
  form.set("from", from);
  form.set("to", msg.to);
  form.set("subject", msg.subject);
  form.set("text", msg.text);
  if (msg.html) form.set("html", msg.html);

  const res = await fetch(`${base}/v3/${c.domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`api:${c.apiKey}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!res.ok) throw new Error(`MAILGUN_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { id?: string };
  return { id: (json.id ?? "").replace(/^<|>$/g, "") };
}
