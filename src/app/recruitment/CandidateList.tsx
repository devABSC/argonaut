import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cvParsingConfigured } from "@/lib/cv-parse";
import { uploadCV, setCandidateStage, deleteCandidate } from "../actions/candidates";
import { STAGES, STAGE_PILL } from "@/lib/candidate-views";
import { IconTrash } from "../icons";
import UploadCV from "./UploadCV";
import CellSelect from "../settings/CellSelect";

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit", month: "short", year: "numeric",
  });

export default async function CandidateList() {
  const [rows, ready] = await Promise.all([
    prisma.candidate.findMany({
      orderBy: { appliedAt: "desc" },
      select: {
        id: true, firstName: true, lastName: true, email: true, mobile: true,
        position: true, stage: true, yearsExperience: true, skills: true,
        appliedAt: true, parsedAt: true, cvFileName: true,
        recruiter: { select: { name: true } },
      },
    }),
    cvParsingConfigured(),
  ]);

  const unread = rows.filter((r) => !r.parsedAt).length;

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Upload CV</h2>
          <span className="spacer" />
          <span className="tree-meta">PDF, Word or Excel · up to 10 MB</span>
        </div>
        <p>
          The CV is read and turned into a candidate record — name, contact,
          position, skills and experience. The file is kept either way, so a CV
          that cannot be read is never lost.
        </p>
        {!ready && (
          <div className="banner">
            No Anthropic API key is set, so CVs will be stored but not read.
            Add <code>anthropic_api_key</code> under Settings → Email.
          </div>
        )}
        <UploadCV action={uploadCV} />
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="cat-head">
          <h2>Candidates <span className="count">{rows.length}</span></h2>
          <span className="spacer" />
          {unread > 0 && <span className="pill s-PENDING">{unread} unread</span>}
        </div>

        {rows.length === 0 ? (
          <p style={{ marginTop: 16 }}>No candidates yet — upload a CV to start.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable">
              <thead>
                <tr>
                  <th className="numcol">No.</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th className="numcol">Yrs</th>
                  <th>Skills</th>
                  <th>Stage</th>
                  <th>Applied</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={c.id}>
                    <td className="numcol">{i + 1}</td>
                    <td>
                      {/* The name is what a recruiter recognises; the id was
                          only ever a stand-in for it. */}
                      <Link className="ticket" href={`/recruitment/candidate/${c.id}/personal-info`}>
                        {c.lastName}, {c.firstName}
                      </Link>
                      {!c.parsedAt && <span className="you">unread</span>}
                    </td>
                    <td>{c.position ?? "—"}</td>
                    <td className="muted">{c.email ?? "—"}</td>
                    <td className="muted nowrap">{c.mobile ?? "—"}</td>
                    <td className="numcol">{c.yearsExperience ?? "—"}</td>
                    <td className="muted">
                      {c.skills.length ? (
                        <span title={c.skills.join(", ")}>
                          {c.skills.slice(0, 3).join(", ")}
                          {c.skills.length > 3 && ` +${c.skills.length - 3}`}
                        </span>
                      ) : "—"}
                    </td>
                    <td>
                      <form action={setCandidateStage}>
                        <input type="hidden" name="candidateId" value={c.id} />
                        <CellSelect
                          name="stage"
                          defaultValue={c.stage}
                          options={STAGES.map((s) => ({ value: s, label: s }))}
                        />
                      </form>
                    </td>
                    <td className="muted nowrap">{fmt(c.appliedAt)}</td>
                    <td className="rowacts">
                      <form action={deleteCandidate.bind(null, c.id)}>
                        <button className="reject icon" type="submit" title="Delete" aria-label="Delete">
                          <IconTrash />
                        </button>
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
