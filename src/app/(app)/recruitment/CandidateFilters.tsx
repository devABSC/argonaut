"use client";

/**
 * Search plus recruiter and BOU. Everything lives in the query string, so a
 * filtered view can be shared or bookmarked.
 *
 * The recruiter control only appears for the owner — everyone else sees their
 * own candidates and nobody else's, so filtering by recruiter would be a list
 * of one name.
 */
export default function CandidateFilters({
  q, recruiter, bou, stage, recruiters, bous, showRecruiter,
}: {
  q: string;
  recruiter: string;
  bou: string;
  stage: string;
  recruiters: { id: string; name: string; count: number }[];
  bous: { id: string; name: string; count: number }[];
  stage_?: never;
  showRecruiter: boolean;
}) {
  return (
    <form className="empsearch" action="/recruitment/candidates" method="get">
      <input name="q" defaultValue={q} placeholder="Search name, position, email, skill" />

      {showRecruiter && (
        <select name="recruiter" defaultValue={recruiter} aria-label="Search by recruiter">
          <option value="">All recruiters</option>
          {recruiters.map((r) => (
            <option key={r.id} value={r.id}>{r.name} ({r.count})</option>
          ))}
          <option value="none">— no recruiter —</option>
        </select>
      )}

      <select name="bou" defaultValue={bou} aria-label="Search by BOU">
        <option value="">All BOUs</option>
        {bous.map((b) => (
          <option key={b.id} value={b.id}>{b.name} ({b.count})</option>
        ))}
        <option value="none">— no BOU —</option>
      </select>

      <select name="stage" defaultValue={stage} aria-label="Search by stage">
        <option value="">All stages</option>
        {["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected", "Withdrawn"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <button type="submit">Search</button>
    </form>
  );
}
