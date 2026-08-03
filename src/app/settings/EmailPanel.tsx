import { mailConfig, saveMailConfig, clearMailSecret } from "../actions/mailconfig";
import { IconTrash } from "../icons";
import SubmitButton from "../SubmitButton";

const LABEL: Record<string, string> = {
  smtp_host: "SMTP host",
  smtp_port: "SMTP port",
  smtp_user: "SMTP user",
  smtp_pass: "SMTP password",
  smtp_secure: "SMTP secure (true/false)",
  mailgun_domain: "Mailgun domain",
  mailgun_region: "Mailgun region (US/EU)",
  mailgun_api_key: "Mailgun API key",
  mail_from: "From address",
  anthropic_api_key: "Anthropic API key",
};

const HINT: Record<string, string> = {
  smtp_host: "smtp.example.com",
  smtp_port: "587",
  smtp_user: "no-reply@atomitsoln.com",
  smtp_secure: "false for 587, true for 465",
  mailgun_domain: "mg.znergee.com",
  mailgun_region: "US",
  mail_from: "Argonaut <no-reply@atomitsoln.com>",
  anthropic_api_key: "sk-ant-…",
};

/**
 * Sending credentials, editable without a redeploy. A value saved here wins
 * over the matching environment variable — the same arrangement benta uses.
 */
export default async function EmailPanel() {
  const fields = await mailConfig();

  return (
    <>
      <div className="panel">
        <h2>Email configuration</h2>
        <p>
          Anything set here overrides the environment variable of the same name,
          so credentials can be rotated without a redeploy. Passwords and API
          keys are never sent back to this page — they show only as set, and
          leaving one blank keeps the stored value rather than wiping it.
        </p>

        <form action={saveMailConfig} className="empform" style={{ marginTop: 4 }}>
          <p className="secdiv">SMTP — used for your own domain and corporate recipients</p>
          <div className="grid3">
            {fields.filter((f) => f.key.startsWith("smtp_")).map((f) => (
              <label key={f.key}>
                <span>
                  {LABEL[f.key]}
                  {f.isSet && <em className="setflag"> saved</em>}
                  {f.fromEnv && <em className="setflag env"> from env</em>}
                </span>
                <input
                  name={f.key}
                  type={f.secret ? "password" : "text"}
                  defaultValue={f.value}
                  placeholder={f.secret && f.isSet ? "•••••• leave blank to keep" : HINT[f.key] ?? ""}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>

          <p className="secdiv">Mailgun — used for Gmail, Yahoo and Outlook recipients</p>
          <div className="grid3">
            {fields.filter((f) => f.key.startsWith("mailgun_") || f.key === "mail_from").map((f) => (
              <label key={f.key}>
                <span>
                  {LABEL[f.key]}
                  {f.isSet && <em className="setflag"> saved</em>}
                  {f.fromEnv && <em className="setflag env"> from env</em>}
                </span>
                <input
                  name={f.key}
                  type={f.secret ? "password" : "text"}
                  defaultValue={f.value}
                  placeholder={f.secret && f.isSet ? "•••••• leave blank to keep" : HINT[f.key] ?? ""}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>

          <p className="secdiv">Anthropic — reads uploaded CVs in Recruitment</p>
          <div className="grid3">
            {fields.filter((f) => f.key === "anthropic_api_key").map((f) => (
              <label key={f.key}>
                <span>
                  {LABEL[f.key]}
                  {f.isSet && <em className="setflag"> saved</em>}
                  {f.fromEnv && <em className="setflag env"> from env</em>}
                </span>
                <input
                  name={f.key}
                  type="password"
                  defaultValue={f.value}
                  placeholder={f.isSet ? "•••••• leave blank to keep" : HINT[f.key]}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>

          <SubmitButton label="Save configuration" />
        </form>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Stored secrets</h2>
        <p>Clearing one hands control back to the environment variable, if there is one.</p>
        <div className="rowacts" style={{ gap: 10, flexWrap: "wrap" }}>
          {fields.filter((f) => f.secret).map((f) => (
            <form action={clearMailSecret.bind(null, f.key)} key={f.key}>
              <button className="reject icon" type="submit" disabled={!f.isSet}
                      title={f.isSet ? `Clear ${LABEL[f.key]}` : `${LABEL[f.key]} is not stored`}
                      aria-label={`Clear ${LABEL[f.key]}`}>
                <IconTrash />
              </button>
            </form>
          ))}
          <span className="tree-meta">
            {fields.filter((f) => f.secret && f.isSet).map((f) => LABEL[f.key]).join(", ") || "none stored"}
          </span>
        </div>
      </div>
    </>
  );
}
