import { prisma } from "@/lib/prisma";
import { IconPlus, IconTrash, IconDownload } from "../icons";
import { addBirForm, deleteBirForm } from "../actions/birforms";

const kb = (n: number | null) => (n == null ? "" : `${Math.round(n / 1024)} KB`);

/**
 * The BIR forms the company files, each with its blank kept alongside it.
 *
 * The file lives in the database rather than the repo — these are the
 * business's own documents, not part of the source.
 */
export default async function BirFormsPanel() {
  const rows = await prisma.birForm.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>BIR Forms <span className="count">{rows.length}</span></h2>
      </div>

      <form action={addBirForm} className="addrow birrow">
        <input name="code" required placeholder="Form no., e.g. 2307" autoComplete="off" aria-label="Form number" />
        <input name="description" required placeholder="What the form is for" autoComplete="off" aria-label="Description" />
        <input type="file" name="file" aria-label="Blank form file"
          accept=".xlsx,.xls,.pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        <button className="save icon" type="submit" title="Add form" aria-label="Add form"><IconPlus /></button>
      </form>

      {rows.length === 0 ? (
        <p style={{ marginTop: 14 }}>No forms listed yet — add the first one above.</p>
      ) : (
        <div className="tablewrap">
          <table className="utable stacked">
            <thead><tr>
              <th className="numcol">No.</th><th>Form</th><th>Description</th>
              <th>File</th><th>Uploaded by</th><th />
            </tr></thead>
            <tbody>
              {rows.map((f, i) => (
                <tr key={f.id}>
                  <td className="numcol" data-label="No.">{i + 1}</td>
                  <td data-label="Form"><b className="ticket">{f.code}</b></td>
                  <td data-label="Description">{f.description}</td>
                  <td data-label="File">
                    {f.fileData ? (
                      <a className="viewtoggle" href={`/api/bir-form/${f.id}`} download
                        title={`Download ${f.fileName ?? f.code}`}>
                        <IconDownload /> {f.fileName ?? "Download"}
                        {f.fileSize ? <span className="tree-meta"> {kb(f.fileSize)}</span> : null}
                      </a>
                    ) : (
                      <span className="muted">no file yet</span>
                    )}
                  </td>
                  <td className="muted" data-label="Uploaded by">{f.uploadedByName ?? "—"}</td>
                  <td className="rowacts">
                    <form action={deleteBirForm.bind(null, f.id)}>
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
