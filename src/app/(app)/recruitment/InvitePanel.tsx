import { prisma } from "@/lib/prisma";
import { createInvite, revokeInvite } from "@/app/actions/candidates";
import { IconTrash, IconPlus } from "@/app/icons";
import CopyLink from "./CopyLink";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://argonaut.znergee.com";

const when = (d: Date | null) =>
  d ? d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) : "—";

/**
 * The link a candidate answers through. Made here, sent by hand — there is no
 * automatic email, so nothing reaches a candidate that a recruiter did not
 * choose to send.
 */
export default async function InvitePanel({ candidateId }: { candidateId: string }) {
  const [invites, questions, answered] = await Promise.all([
    prisma.candidateInvite.findMany({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.verifyItem.count({ where: { candidateId, kind: "question" } }),
    prisma.verifyItem.count({ where: { candidateId, kind: "question", NOT: { candidateAnswer: null } } }),
  ]);

  const live = invites.find((i) => !i.revokedAt && !i.submittedAt && i.expiresAt > new Date());

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <div className="cat-head">
        <h2>Ask the candidate</h2>
        <span className="spacer" />
        {questions > 0 && (
          <span className="tree-meta">{answered} of {questions} answered</span>
        )}
      </div>
      <p>
        Creates a link the candidate opens to answer the interview questions in
        their own words. It shows them the questions and nothing else — not the
        assessment, not the risks, not a word anyone here has written. Copy it
        and send it yourself; nothing is emailed automatically.
      </p>

      {questions === 0 ? (
        <p className="tree-meta">
          Add the interview questions to the checklist first — there is nothing to ask yet.
        </p>
      ) : live ? (
        <>
          <CopyLink url={`${APP_URL}/interview/${live.token}`} />
          <div className="rowacts" style={{ marginTop: 10 }}>
            <span className="tree-meta">
              Issued {when(live.createdAt)} · closes {when(live.expiresAt)}
              {live.openedAt ? ` · opened ${when(live.openedAt)}` : " · not opened yet"}
            </span>
            <form action={revokeInvite.bind(null, live.id)}>
              <button className="reject icon" type="submit" title="Revoke this link" aria-label="Revoke link">
                <IconTrash />
              </button>
            </form>
          </div>
        </>
      ) : (
        <form action={createInvite} className="addrow aslink">
          <input type="hidden" name="candidateId" value={candidateId} />
          <input name="message" placeholder="A note to the candidate (optional)" autoComplete="off" />
          <button className="btn-primary" type="submit">
            <IconPlus /> Create interview link
          </button>
        </form>
      )}

      {invites.length > 0 && (
        <>
          <p className="secdiv">Links issued <span className="count">{invites.length}</span></p>
          <div className="tablewrap">
            <table className="utable stacked">
              <thead>
                <tr><th>Issued</th><th>By</th><th>Opened</th><th>Answered</th><th>State</th></tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const state = i.submittedAt ? "Answered"
                    : i.revokedAt ? "Revoked"
                    : i.expiresAt < new Date() ? "Expired" : "Live";
                  const pill = state === "Answered" ? "s-ACTIVE"
                    : state === "Live" ? "s-PENDING" : "s-SUSPENDED";
                  return (
                    <tr key={i.id}>
                      <td className="muted nowrap" data-label="Issued">{when(i.createdAt)}</td>
                      <td className="muted" data-label="By">{i.createdBy?.name ?? "—"}</td>
                      <td className="muted nowrap" data-label="Opened">{when(i.openedAt)}</td>
                      <td className="muted nowrap" data-label="Answered">{when(i.submittedAt)}</td>
                      <td data-label="State"><span className={`pill ${pill}`}>{state}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
