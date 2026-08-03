import { prisma } from "@/lib/prisma";
import {
  saveCandidate, reparseCV, addExperience, deleteExperience,
  addReference, markReferenceContacted, deleteReference, saveAiNotes,
} from "../actions/candidates";
import { IconSave, IconPlus, IconTrash } from "../icons";

const fmtWhen = (d: Date | null) =>
  d
    ? d.toLocaleString("en-GB", {
        timeZone: "Asia/Manila",
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
      })
    : "—";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value && value.trim() ? value : "—"}</dd>
    </div>
  );
}

const FIELDS = [
  { name: "firstName", label: "First name" },
  { name: "lastName", label: "Last name" },
  { name: "email", label: "Email" },
  { name: "mobile", label: "Mobile" },
  { name: "position", label: "Position applied for" },
  { name: "location", label: "Location" },
  { name: "currentEmployer", label: "Current employer" },
  { name: "education", label: "Education" },
  { name: "source", label: "Source" },
] as const;

export default async function CandidatePanel({
  candidateId,
  view,
}: {
  candidateId: string;
  view: string;
}) {
  const c = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { recruiter: { select: { name: true } }, bou: { select: { name: true } } },
  });
  if (!c) return <div className="panel"><p>That candidate no longer exists.</p></div>;

  if (view === "cv") {
    return (
      <div className="panel">
        <div className="cat-head">
          <h2>CV</h2>
          <span className="spacer" />
          <span className="tree-meta">
            {c.parsedAt ? `Read ${fmtWhen(c.parsedAt)}` : "Not read yet"}
          </span>
        </div>

        {c.cvFileName ? (
          <>
            <dl className="tmeta wide">
              <Field label="File" value={c.cvFileName} />
              <Field label="Type" value={c.cvMime} />
              <Field label="Size" value={c.cvSize ? `${(c.cvSize / 1024).toFixed(0)} KB` : null} />
              <Field label="Uploaded by" value={c.recruiter?.name ?? null} />
            </dl>
            <div className="rowacts" style={{ marginTop: 16 }}>
              <a className="btn-primary" href={`/api/candidate-cv/${c.id}`} target="_blank" rel="noreferrer">
                Open CV
              </a>
              <form action={reparseCV.bind(null, c.id)}>
                <button className="btn-primary" type="submit">Read again</button>
              </form>
            </div>
          </>
        ) : (
          <p>No CV on file for this candidate.</p>
        )}
      </div>
    );
  }

  if (view === "work-experience") {
    const rows = await prisma.workExperience.findMany({
      where: { candidateId },
      orderBy: [{ yearFrom: "desc" }, { createdAt: "desc" }],
    });
    const thisYear = new Date().getFullYear();
    const span = (a: number | null, b: number | null) =>
      a || b ? `${a ?? "?"} – ${b ?? "present"}` : "—";

    /** Years in one post. An open post runs to today. */
    const yearsIn = (a: number | null, b: number | null) => {
      if (!a) return null;
      const end = b ?? thisYear;
      return Math.max(0, end - a);
    };

    // Summed across posts, so overlapping dates would double-count — the CV's
    // own stated figure is shown beside it rather than replaced by this.
    const totalYears = rows.reduce((n, r) => n + (yearsIn(r.yearFrom, r.yearTo) ?? 0), 0);

    return (
      <div className="panel">
        <div className="cat-head">
          <h2>Work Experience <span className="count">{rows.length}</span></h2>
          <span className="spacer" />
          {rows.length > 0 && (
            <span className="tree-meta">
              {totalYears} yr{totalYears === 1 ? "" : "s"} across {rows.length} post
              {rows.length === 1 ? "" : "s"}
              {c.yearsExperience != null && c.yearsExperience !== totalYears &&
                ` · CV states ${c.yearsExperience}`}
            </span>
          )}
        </div>

        <form action={addExperience} className="addrow wxrow">
          <input type="hidden" name="candidateId" value={c.id} />
          <input name="yearFrom" type="number" min={1950} max={2100} placeholder="From" title="Year from" />
          <input name="yearTo" type="number" min={1950} max={2100} placeholder="To" title="Year to — blank if current" />
          <input name="companyName" required placeholder="Company" autoComplete="off" />
          <input name="position" placeholder="Position" autoComplete="off" />
          <input name="city" placeholder="City" autoComplete="off" />
          <input name="country" placeholder="Country" autoComplete="off" defaultValue="Philippines" />
          <input name="duties" placeholder="Duties and responsibilities" autoComplete="off" />
          <button className="save icon" type="submit" title="Add post" aria-label="Add post">
            <IconPlus />
          </button>
        </form>

        {rows.length === 0 ? (
          <p style={{ marginTop: 14 }}>
            Nothing on file. Add posts above, or read the CV again to pull them out.
          </p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead>
                <tr>
                  <th className="numcol">No.</th><th>Years</th><th className="numcol">Tot Yrs Exp</th>
                  <th>Company</th><th>Position</th>
                  <th>City</th><th>Country</th><th>Duties and responsibilities</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="numcol" data-label="No.">{i + 1}</td>
                    <td className="muted nowrap" data-label="Years">{span(r.yearFrom, r.yearTo)}</td>
                    <td className="numcol" data-label="Tot Yrs Exp">{yearsIn(r.yearFrom, r.yearTo) ?? "—"}</td>
                    <td data-label="Company"><b>{r.companyName}</b></td>
                    <td data-label="Position">{r.position ?? "—"}</td>
                    <td className="muted" data-label="City">{r.city ?? "—"}</td>
                    <td className="muted" data-label="Country">{r.country ?? "—"}</td>
                    <td className="muted" data-label="Duties">{r.duties ?? "—"}</td>
                    <td className="rowacts">
                      <form action={deleteExperience.bind(null, r.id)}>
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
    );
  }

  if (view === "char-ref") {
    const refs = await prisma.characterReference.findMany({
      where: { candidateId },
      orderBy: [{ contactedAt: "asc" }, { createdAt: "asc" }],
    });
    const checked = refs.filter((r) => r.contactedAt).length;

    return (
      <div className="panel">
        <div className="cat-head">
          <h2>Character References <span className="count">{refs.length}</span></h2>
          <span className="spacer" />
          {refs.length > 0 && <span className="tree-meta">{checked} of {refs.length} checked</span>}
        </div>

        <form action={addReference} className="addrow crrow">
          <input type="hidden" name="candidateId" value={c.id} />
          <input name="name" required placeholder="Name" autoComplete="off" />
          <input name="relationship" placeholder="Relationship" autoComplete="off" />
          <input name="company" placeholder="Company" autoComplete="off" />
          <input name="position" placeholder="Position" autoComplete="off" />
          <input name="contactNo" placeholder="Contact no." autoComplete="off" />
          <input name="email" type="email" placeholder="Email" autoComplete="off" />
          <button className="save icon" type="submit" title="Add reference" aria-label="Add reference">
            <IconPlus />
          </button>
        </form>

        {refs.length === 0 ? (
          <p style={{ marginTop: 14 }}>No references on file.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead>
                <tr>
                  <th className="numcol">No.</th><th>Name</th><th>Relationship</th><th>Company</th>
                  <th>Position</th><th>Contact</th><th>Email</th><th>Checked</th>
                  <th>Remarks</th><th />
                </tr>
              </thead>
              <tbody>
                {refs.map((r, i) => (
                  <tr key={r.id}>
                    <td className="numcol" data-label="No.">{i + 1}</td>
                    <td data-label="Name"><b>{r.name}</b></td>
                    <td className="muted" data-label="Relationship">{r.relationship ?? "—"}</td>
                    <td className="muted" data-label="Company">{r.company ?? "—"}</td>
                    <td className="muted" data-label="Position">{r.position ?? "—"}</td>
                    <td className="muted nowrap" data-label="Contact">{r.contactNo ?? "—"}</td>
                    <td className="muted" data-label="Email">{r.email ?? "—"}</td>
                    <td data-label="Checked">
                      <span className={`pill ${r.contactedAt ? "s-ACTIVE" : "s-PENDING"}`}>
                        {r.contactedAt ? fmtWhen(r.contactedAt).slice(0, 11) : "not yet"}
                      </span>
                    </td>
                    <td data-label="Remarks">
                      {/* Saving remarks is what marks the reference as checked —
                          a recruiter records the call, not a tick box. */}
                      <form action={markReferenceContacted} className="inline-form">
                        <input type="hidden" name="referenceId" value={r.id} />
                        <input name="remarks" defaultValue={r.remarks ?? ""} placeholder="What did they say?" />
                        <button className="save icon" type="submit" title="Save remarks" aria-label="Save remarks">
                          <IconSave />
                        </button>
                      </form>
                    </td>
                    <td className="rowacts">
                      <form action={deleteReference.bind(null, r.id)}>
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
    );
  }

  if (view === "ai-data") {
    const d = (c.aiData ?? {}) as Record<string, unknown>;
    const list = (k: string) => (Array.isArray(d[k]) ? (d[k] as string[]) : []);

    const findings: [string, string[]][] = [
      ["Achievements", list("achievements")],
      ["Certifications", list("certifications")],
      ["Awards", list("awards")],
      ["Languages", list("languages")],
      ["Links on the CV", list("publicSites")],
    ];
    const flags: [string, string[]][] = [
      ["Employment gaps", list("employmentGaps")],
      ["Short tenures", list("shortTenures")],
      ["Document inconsistencies", list("documentConcerns")],
    ];
    const anyFlags = flags.some(([, v]) => v.length);

    return (
      <div className="panel">
        <div className="cat-head">
          <h2>Other AI Data</h2>
          <span className="spacer" />
          <span className="tree-meta">
            {c.parsedAt ? `read ${fmtWhen(c.parsedAt)}` : "CV not read yet"}
          </span>
        </div>
        <p>
          What the reader found in the document beyond the plain fields. All of
          it comes off the CV the candidate submitted — nothing here is looked
          up elsewhere.
        </p>

        {!c.parsedAt ? (
          <p style={{ marginTop: 14 }}>Read the CV first — the CV tab has a Read again button.</p>
        ) : (
          <>
            {findings.map(([label, values]) => (
              <div key={label}>
                <p className="secdiv">{label} <span className="count">{values.length}</span></p>
                {values.length ? (
                  <ul className="findings">{values.map((v) => <li key={v}>{v}</li>)}</ul>
                ) : (
                  <p className="tree-meta">Nothing stated.</p>
                )}
              </div>
            ))}

            {d.compensationNoted != null && String(d.compensationNoted).trim() !== "" && (
              <>
                <p className="secdiv">Compensation stated on the document</p>
                <p>{String(d.compensationNoted)}</p>
              </>
            )}

            <p className="secdiv">Your notes on these findings</p>
            <form action={saveAiNotes}>
              <input type="hidden" name="candidateId" value={c.id} />
              <label className="statfield">
                <span>Notes</span>
                <textarea
                  name="aiNotes"
                  rows={4}
                  defaultValue={c.aiNotes ?? ""}
                  placeholder="What you made of the above — answers given at interview, things confirmed or ruled out."
                />
              </label>
              <div className="statacts">
                <button className="btn-primary" type="submit"><IconSave /> Save notes</button>
              </div>
            </form>

            <p className="secdiv">Worth checking at interview</p>
            {anyFlags ? (
              <>
                <p className="tree-meta">
                  Observations about the dates and internal consistency of this
                  document — questions to ask, not conclusions about the person.
                </p>
                {flags.map(([label, values]) =>
                  values.length ? (
                    <div key={label}>
                      <p className="secdiv">{label}</p>
                      <ul className="findings flag">{values.map((v) => <li key={v}>{v}</li>)}</ul>
                    </div>
                  ) : null,
                )}
              </>
            ) : (
              <p className="tree-meta">Nothing stood out in the dates or internal consistency.</p>
            )}
          </>
        )}
      </div>
    );
  }

  if (view === "skills") {
    return (
      <div className="panel">
        <div className="cat-head">
          <h2>Skills <span className="count">{c.skills.length}</span></h2>
        </div>
        {c.skills.length ? (
          <div className="skillrow">
            {c.skills.map((s) => <span className="skill" key={s}>{s}</span>)}
          </div>
        ) : (
          <p>
            Nothing on file — the CV listed no skills, or has not been read yet.
          </p>
        )}
      </div>
    );
  }

  if (view === "experience") {
    return (
      <div className="panel">
        <h2>Experience</h2>
        <dl className="tmeta wide">
          <Field label="Years of experience" value={c.yearsExperience?.toString() ?? null} />
          <Field label="Current employer" value={c.currentEmployer} />
          <Field label="Education" value={c.education} />
        </dl>

        <p className="secdiv">Summary</p>
        <p>{c.summary ?? "Nothing on file — the CV had no summary, or has not been read."}</p>

        <p className="secdiv">Skills <span className="count">{c.skills.length}</span></p>
        {c.skills.length ? (
          <div className="skillrow">
            {c.skills.map((s) => <span className="skill" key={s}>{s}</span>)}
          </div>
        ) : (
          <p>No skills listed on the CV.</p>
        )}
      </div>
    );
  }

  if (view === "notes") {
    return (
      <div className="panel">
        <h2>Notes</h2>
        <form action={saveCandidate}>
          <input type="hidden" name="candidateId" value={c.id} />
          <label className="statfield">
            <span>Recruiter notes</span>
            <textarea name="notes" rows={10} defaultValue={c.notes ?? ""} />
          </label>
          <div className="statacts">
            <button className="btn-primary" type="submit"><IconSave /> Save notes</button>
          </div>
        </form>
      </div>
    );
  }

  // Personal Info
  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Personal Info</h2>
        <span className="count">
          {c.parsedAt ? "read from the CV" : "entered by hand"}
        </span>
      </div>
      <p>
        Read off the CV and editable — the parser gets most of it right, but a
        badly laid-out CV will need correcting.
      </p>

      <form action={saveCandidate} className="statgrid">
        <input type="hidden" name="candidateId" value={c.id} />
        {FIELDS.map((f) => (
          <label className="statfield" key={f.name}>
            <span>{f.label}</span>
            <input
              name={f.name}
              defaultValue={(c[f.name] as string | null) ?? ""}
              autoComplete="off"
            />
          </label>
        ))}
        <div className="statacts">
          <button className="btn-primary" type="submit"><IconSave /> Save candidate</button>
        </div>
      </form>

      <p className="secdiv">Record</p>
      <dl className="tmeta wide">
        <Field label="Candidate ID" value={c.id.slice(-8).toUpperCase()} />
        <Field label="Applied" value={fmtWhen(c.appliedAt)} />
        <Field label="CV read" value={fmtWhen(c.parsedAt)} />
        <Field label="Recruiter" value={c.recruiter?.name ?? null} />
        <Field label="BOU" value={c.bou?.name ?? null} />
      </dl>
    </div>
  );
}
