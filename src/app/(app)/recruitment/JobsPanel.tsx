import { prisma } from "@/lib/prisma";
import { IconPlus, IconTrash, IconDownload } from "@/app/icons";
import CellSelect from "../settings/CellSelect";
import { addJobReq, setJobReqOpen, deleteJobReq } from "@/app/actions/jobreqs";

const kb = (n: number | null) => (n == null ? "" : `${Math.round(n / 1024)} KB`);
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The roles being recruited for. The list sits above the form that adds to it,
 * so what already exists is read before anything is typed.
 */
export default async function JobsPanel() {
  const [jobs, bous] = await Promise.all([
    prisma.jobReq.findMany({
      orderBy: [{ isOpen: "desc" }, { createdAt: "desc" }],
      // Never the file itself: the list shows its name, and the route serves
      // the bytes when someone asks for them.
      select: {
        id: true, title: true, isOpen: true, createdAt: true, createdByName: true,
        fileName: true, fileSize: true,
        bou: { select: { name: true } },
      },
    }),
    prisma.bou.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const open = jobs.filter((j) => j.isOpen).length;

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Jobs <span className="count">{jobs.length}</span></h2>
          <span className="spacer" />
          <span className="tree-meta">{open} open</span>
        </div>

        {jobs.length === 0 ? (
          <p style={{ marginTop: 14 }}>No jobs yet — add the first one below.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead><tr>
                <th className="numcol">No.</th><th>Job Title</th><th>BOU</th>
                <th>Job Description</th><th>Status</th><th>Opened</th>
                <th>Added by</th><th />
              </tr></thead>
              <tbody>
                {jobs.map((j, i) => (
                  <tr key={j.id}>
                    <td className="numcol" data-label="No.">{i + 1}</td>
                    <td data-label="Job Title"><b>{j.title}</b></td>
                    <td className="muted" data-label="BOU">{j.bou?.name ?? "—"}</td>
                    <td data-label="Job Description">
                      {j.fileName ? (
                        <a className="viewtoggle" href={`/api/job-req/${j.id}`} download title={j.fileName}>
                          <IconDownload /> {j.fileName}
                          {j.fileSize ? <span className="tree-meta"> {kb(j.fileSize)}</span> : null}
                        </a>
                      ) : (
                        <span className="muted">none filed</span>
                      )}
                    </td>
                    <td data-label="Status">
                      <form action={setJobReqOpen}>
                        <input type="hidden" name="jobId" value={j.id} />
                        <CellSelect
                          name="state"
                          defaultValue={j.isOpen ? "Open" : "Closed"}
                          options={[{ value: "Open", label: "Open" }, { value: "Closed", label: "Closed" }]}
                        />
                      </form>
                    </td>
                    <td className="muted nowrap" data-label="Opened">{day(j.createdAt)}</td>
                    <td className="muted" data-label="Added by">{j.createdByName ?? "—"}</td>
                    <td className="rowacts">
                      <form action={deleteJobReq.bind(null, j.id)}>
                        <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h2>Add a job</h2>
        <p>The description can be attached now or filed later.</p>

        <form action={addJobReq} className="addrow jobrow">
          <input name="title" required placeholder="Job title" autoComplete="off" aria-label="Job title" />
          <select name="bouId" required defaultValue="" aria-label="BOU">
            <option value="" disabled>{bous.length ? "BOU" : "No BOUs yet"}</option>
            {bous.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="file" name="file" aria-label="Job description file"
            accept=".pdf,.doc,.docx,.txt,application/pdf" />
          <button className="save icon" type="submit" title="Add job" aria-label="Add job"><IconPlus /></button>
        </form>
      </div>
    </>
  );
}
