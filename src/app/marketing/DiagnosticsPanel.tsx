import { prisma } from "@/lib/prisma";
import { mailStatus, sendTestEmail } from "../actions/mailtest";
import SubmitButton from "../SubmitButton";

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

/** Whether the engine can send, and a way to prove it. */
export default async function DiagnosticsPanel() {
  const st = await mailStatus();
  const recent = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const Row = ({ label, value, ok }: { label: string; value: string; ok: boolean }) => (
    <div>
      <dt>{label}</dt>
      <dd>
        <span className={`pill ${ok ? "s-ACTIVE" : "s-REJECTED"}`}>{ok ? "ready" : "missing"}</span>{" "}
        <span className="muted">{value}</span>
      </dd>
    </div>
  );

  return (
    <>
      <div className="panel">
        <h2>Mail engine</h2>
        <p>
          Two transports. Gmail, Yahoo and Outlook recipients go via Mailgun;
          everyone else, including your own domain, goes via SMTP. Neither has
          to be configured for the app to work — unsent mail still lands in the
          outbox — but nothing leaves until at least one is.
        </p>

        <dl className="tmeta wide">
          <Row label="SMTP host" value={st.smtp.host ?? "not set"} ok={Boolean(st.smtp.host)} />
          <Row label="SMTP user" value={st.smtp.user ?? "not set"} ok={Boolean(st.smtp.user)} />
          <Row label="SMTP password" value={st.smtp.pass ?? "not set"} ok={Boolean(st.smtp.pass)} />
          <Row label="Mailgun domain" value={st.mailgun.domain ?? "not set"} ok={Boolean(st.mailgun.domain)} />
          <Row label="Mailgun key" value={st.mailgun.key ?? "not set"} ok={Boolean(st.mailgun.key)} />
          <Row label="From address" value={st.from ?? "not set"} ok={Boolean(st.from)} />
        </dl>

        {!st.smtp.ready && !st.mailgun.ready && (
          <p className="pvhelp" style={{ marginTop: 14 }}>
            Nothing is configured, so a test will record to the outbox and stop
            there. Add SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM — or
            MAILGUN_DOMAIN and MAILGUN_API_KEY — in Vercel, then redeploy.
          </p>
        )}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Send a test</h2>
        <p>Sends a real email and reports exactly what happened, including the reason if it fails.</p>
        <form action={sendTestEmail} className="inline-form">
          <input name="to" type="email" placeholder="you@example.com" required />
          <SubmitButton label="Send test" />
        </form>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Outbox <span className="count">{recent.length} most recent</span></h2>
        {recent.length === 0 ? (
          <p style={{ marginTop: 14 }}>Nothing has been sent yet.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead>
                <tr><th>When</th><th>To</th><th>Kind</th><th>Subject</th><th>Via</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recent.map((n) => (
                  <tr key={n.id}>
                    <td className="muted nowrap" data-label="When">{fmt(n.createdAt)}</td>
                    <td data-label="To">{n.to}</td>
                    <td className="muted" data-label="Kind">{n.kind}</td>
                    <td className="muted" data-label="Subject">{n.subject}</td>
                    <td className="muted" data-label="Via">{n.provider ?? "—"}</td>
                    <td data-label="Status">
                      <span className={`pill ${
                        n.status === "sent" ? "s-ACTIVE" : n.status === "failed" ? "s-REJECTED" : "s-PENDING"
                      }`}>{n.status}</span>
                      {n.failReason && <span className="reason">{n.failReason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
