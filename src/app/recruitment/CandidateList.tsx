import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { candidateScope } from "@/lib/candidate-scope";
import type { RoleKey } from "@/lib/roles";
import { cvParsingConfigured } from "@/lib/cv-parse";
import { uploadCV, setCandidateStage, deleteCandidate } from "../actions/candidates";
import { STAGES, STAGE_PILL } from "@/lib/candidate-views";
import { IconTrash } from "../icons";
import UploadCV from "./UploadCV";
import CellSelect from "../settings/CellSelect";
import CandidateFilters from "./CandidateFilters";

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit", month: "short", year: "numeric",
  });

export default async function CandidateList({
  viewer, q = "", recruiter = "", bou = "", stage = "",
}: {
  viewer: { id: string; role: RoleKey };
  q?: string;
  recruiter?: string;
  bou?: string;
  stage?: string;
}) {
  const scope = candidateScope(viewer);
  const isOwner = viewer.role === "SUPER_USER";
  const term = q.trim();

  // The recruiter filter is the owner's alone — everyone else already sees
  // only their own, so it would be a list of one name.
  const where = {
    ...scope,
    ...(term
      ? {
          OR: [
            { firstName: { contains: term, mode: "insensitive" as const } },
            { lastName: { contains: term, mode: "insensitive" as const } },
            { email: { contains: term, mode: "insensitive" as const } },
            { position: { contains: term, mode: "insensitive" as const } },
            { currentEmployer: { contains: term, mode: "insensitive" as const } },
            { skills: { has: term } },
          ],
        }
      : {}),
    ...(isOwner && recruiter
      ? { recruiterId: recruiter === "none" ? null : recruiter }
      : {}),
    ...(bou ? { bouId: bou === "none" ? null : bou } : {}),
    ...(stage ? { stage } : {}),
  };
  const [rows, ready, recruiterCounts, bouCounts, userRows, bouRows, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      orderBy: { appliedAt: "desc" },
      select: {
        id: true, firstName: true, lastName: true, email: true, mobile: true,
        position: true, stage: true, yearsExperience: true, skills: true,
        appliedAt: true, parsedAt: true, cvFileName: true,
        bou: { select: { name: true } },
        recruiter: { select: { name: true } },
      },
    }),
    cvParsingConfigured(),
    // Counts come from the viewer's own scope, so a recruiter never learns how
    // many candidates anyone else holds.
    prisma.candidate.groupBy({ by: ["recruiterId"], where: scope, _count: { _all: true } }),
    prisma.candidate.groupBy({ by: ["bouId"], where: scope, _count: { _all: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.bou.findMany({ select: { id: true, name: true } }),
    prisma.candidate.count({ where: scope }),
  ]);

  const nameOf = new Map(userRows.map((u) => [u.id, u.name]));
  const bouNameOf = new Map(bouRows.map((b) => [b.id, b.name]));
  const recruiters = recruiterCounts
    .filter((r) => r.recruiterId)
    .map((r) => ({ id: r.recruiterId!, name: nameOf.get(r.recruiterId!) ?? "—", count: r._count._all }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const bous = bouCounts
    .filter((b) => b.bouId)
    .map((b) => ({ id: b.bouId!, name: bouNameOf.get(b.bouId!) ?? "—", count: b._count._all }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
          <h2>
            Candidates{" "}
            <span className="count">
              {rows.length}{rows.length !== total ? ` of ${total}` : ""}
            </span>
          </h2>
          <span className="spacer" />
          {unread > 0 && <span className="pill s-PENDING">{unread} unread</span>}
          {viewer.role !== "SUPER_USER" && (
            <span className="tree-meta">yours only</span>
          )}
        </div>

        <CandidateFilters
          q={q}
          recruiter={recruiter}
          bou={bou}
          stage={stage}
          recruiters={recruiters}
          bous={bous}
          showRecruiter={isOwner}
        />

        {rows.length === 0 ? (
          <p style={{ marginTop: 16 }}>
            {term || recruiter || bou || stage
              ? "Nobody matches those filters."
              : "No candidates yet — upload a CV to start."}
          </p>
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
                  {isOwner && <th>Recruiter</th>}
                  <th>BOU</th>
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
                    {isOwner && <td className="muted">{c.recruiter?.name ?? "—"}</td>}
                    <td className="muted">{c.bou?.name ?? "—"}</td>
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
