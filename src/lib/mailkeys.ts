/** Mail settings held in the Setting table; a value there beats the env var. */
export const MAIL_KEYS = [
  "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_secure",
  "mailgun_domain", "mailgun_region", "mailgun_api_key", "mail_from",
  // Not mail, but the same arrangement: a key held in the Setting table so it
  // can be set and rotated without a redeploy. Used to read uploaded CVs.
  "anthropic_api_key",
] as const;

export type MailKey = (typeof MAIL_KEYS)[number];

/** Never echoed back to the browser, never written to the audit log. */
export const MAIL_SECRETS = new Set<string>(["smtp_pass", "mailgun_api_key", "anthropic_api_key"]);
