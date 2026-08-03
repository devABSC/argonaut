import { prisma } from "@/lib/prisma";
import { saveCandidate, reparseCV, addExperience, deleteExperience } from "../actions/candidates";
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
    const span = (a: number | null, b: number | null) =>
      a || b ? `${a ?? "?"} – ${b ?? "present"}` : "—";

    return (
      <div className="panel">
        <div className="cat-head">
          <h2>Work Experience <span className="count">{rows.length}</span></h2>
          <span className="spacer" />
          <span className="tree-meta">most recent first</span>
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
                  <th className="numcol">No.</th><th>Years</th><th>Company</th><th>Position</th>
                  <th>City</th><th>Country</th><th>Duties and responsibilities</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="numcol" data-label="No.">{i + 1}</td>
                    <td className="muted nowrap" data-label="Years">{span(r.yearFrom, r.yearTo)}</td>
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
