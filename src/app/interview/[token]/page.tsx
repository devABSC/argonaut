import { openInvite } from "../../actions/interview";
import InterviewForm from "./InterviewForm";

/**
 * The candidate's page. No sign-in, no app shell, and nothing on it but their
 * name and the questions — the assessment, the risks and every internal remark
 * stay on the other side of the login.
 */
export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await openInvite(token);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="login-page">
      <div className="console" style={{ minHeight: "100vh" }}>
        <div className="console__bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
        <div className="card" style={{ maxWidth: 720 }}>{children}</div>
      </div>
    </main>
  );

  if (!invite) {
    return (
      <Shell>
        <p className="eyebrow"><span className="live" />Interview questions</p>
        <h1>This link is not valid</h1>
        <p style={{ marginTop: 12, color: "var(--muted)" }}>
          Check that you copied the whole address, or ask your recruiter to send a new one.
        </p>
      </Shell>
    );
  }

  if (invite.state !== "open") {
    const said = {
      revoked: "This link has been withdrawn.",
      submitted: "Your answers have already been received — thank you.",
      expired: "This link has expired.",
    }[invite.state];
    return (
      <Shell>
        <p className="eyebrow"><span className="live" />Interview questions</p>
        <h1>{invite.state === "submitted" ? "All done" : "Link closed"}</h1>
        <p style={{ marginTop: 12, color: "var(--muted)" }}>
          {said}{invite.state !== "submitted" && " Ask your recruiter for a new one."}
        </p>
      </Shell>
    );
  }

  const c = invite.candidate;

  return (
    <Shell>
      <p className="eyebrow"><span className="live" />Interview questions</p>
      <h1>Hello {c.firstName}</h1>
      <p style={{ marginTop: 12, color: "var(--muted)", fontSize: ".95rem", lineHeight: 1.6 }}>
        {invite.message ??
          `Before we meet, please answer these in your own words. Take the space you need — a short, specific answer is better than a long general one. You can only submit once.`}
      </p>

      <InterviewForm
        token={invite.token}
        questions={c.verifyItems}
        deadline={invite.expiresAt.toISOString().slice(0, 10)}
      />
    </Shell>
  );
}
