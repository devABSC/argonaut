import { prisma } from "@/lib/prisma";
import { sendCampaign, addSuppression, removeSuppression } from "../actions/marketing";
import { IconTrash, IconPlus } from "../icons";
import SubmitButton from "../SubmitButton";
import TemplatePicker from "./TemplatePicker";

export default async function SendPanel() {
  const [templates, suppressed, sentCount] = await Promise.all([
    prisma.emailTemplate.findMany({ orderBy: { name: "asc" } }),
    prisma.suppression.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.notification.count({ where: { kind: "marketing" } }),
  ]);

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Send email</h2>
          <span className="spacer" />
          <span className="tree-meta">{sentCount} sent to date</span>
        </div>
        <p>
          One personalised email per recipient rather than a blind copy blast —
          it lands better and each gets its own outbox row. Unsubscribed
          addresses are dropped automatically, and anyone who already received
          the chosen template is skipped unless you tick resend.
        </p>

        <form action={sendCampaign} className="empform" style={{ marginTop: 4 }}>
          <TemplatePicker templates={templates} />

          <label className="full">
            <span>Recipients</span>
            <textarea
              name="recipients" rows={3} required
              placeholder="one@example.com, two@example.com — commas, semicolons or new lines"
            />
          </label>

          <div className="checkrow">
            <label className="req">
              <input type="checkbox" name="resend" /> Resend to people who already got this template
            </label>
          </div>

          <SubmitButton label="Send campaign" />
        </form>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Unsubscribe list <span className="count">{suppressed.length}</span></h2>
        <p>Addresses here are skipped by every campaign, no exceptions.</p>

        <form action={addSuppression} className="inline-form">
          <input name="emails" placeholder="Addresses to suppress" required />
          <input name="reason" placeholder="Reason (optional)" />
          <button type="submit" className="icon" title="Add" aria-label="Add"><IconPlus /></button>
        </form>

        {suppressed.length > 0 && (
          <div className="tablewrap" style={{ marginTop: 14 }}>
            <table className="utable stacked">
              <thead><tr><th>Email</th><th>Reason</th><th>Added</th><th /></tr></thead>
              <tbody>
                {suppressed.map((s) => (
                  <tr key={s.email}>
                    <td data-label="Email"><b>{s.email}</b></td>
                    <td data-label="Reason" className="muted">{s.reason ?? "—"}</td>
                    <td data-label="Added" className="muted nowrap">{s.createdAt.toISOString().slice(0, 10)}</td>
                    <td>
                      <form action={removeSuppression.bind(null, s.email)}>
                        <button className="reject icon" type="submit" title="Remove" aria-label="Remove"><IconTrash /></button>
                      </form>
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
