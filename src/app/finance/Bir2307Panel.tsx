import { prisma } from "@/lib/prisma";
import { IconTrash, IconSave, IconDownload } from "../icons";
import { addBir2307, deleteBir2307, saveWithholdingAgent } from "../actions/birforms";
import Bir2307Form from "./Bir2307Form";
import { quarterLabel } from "@/lib/quarters";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Every 2307 raised, newest first. */
export default async function Bir2307Panel({ isOwner }: { isOwner: boolean }) {
  const [company, rows, suppliers] = await Promise.all([
    prisma.company.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.bir2307.findMany({ orderBy: [{ year: "desc" }, { quarter: "asc" }, { supplierName: "asc" }] }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, tin: true, address: true },
    }),
  ]);

  const agent = [company?.address, company?.city, company?.zipCode].filter(Boolean).join(", ");
  // Newest year first; the list is read backwards from the current filing.
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);

  return (
    <>
      {/* Who is doing the withholding. The same on every certificate, so it is
          set once here rather than retyped per 2307 — and only by the owner,
          since it is the company's own registered detail. */}
      <div className="panel">
        <div className="cat-head">
          <h2>Withholding Agent / Payor</h2>
          <span className="spacer" />
          {!isOwner && <span className="tree-meta">Owner sets this</span>}
        </div>

        {isOwner && company ? (
          <form action={saveWithholdingAgent} className="coaform">
            <input type="hidden" name="companyId" value={company.id} />
            <label className="statfield">
              <span>Company Name</span>
              <input name="name" required defaultValue={company.name} autoComplete="off" />
            </label>
            <label className="statfield">
              <span>Company TIN</span>
              <input name="tin" defaultValue={company.tin ?? ""} placeholder="000-000-000-000" autoComplete="off" />
            </label>
            <label className="statfield">
              <span>City</span>
              <input name="city" defaultValue={company.city ?? ""} autoComplete="off" />
            </label>
            <label className="statfield">
              <span>Company Address</span>
              <input name="address" defaultValue={company.address ?? ""} autoComplete="off" />
            </label>
            <label className="statfield">
              <span>Zip Code</span>
              <input name="zipCode" defaultValue={company.zipCode ?? ""} autoComplete="off" />
            </label>
            <div className="statacts">
              <button className="btn-primary" type="submit"><IconSave /> Save</button>
            </div>
          </form>
        ) : (
          <dl className="tmeta wide" style={{ marginTop: 12 }}>
            <div><dt>Company Name</dt><dd>{company?.name ?? "—"}</dd></div>
            <div><dt>Company TIN</dt><dd>{company?.tin ?? "—"}</dd></div>
            <div><dt>Company Address</dt><dd>{agent || "—"}</dd></div>
          </dl>
        )}
      </div>

    <div className="panel" style={{ marginTop: 14 }}>
      <div className="cat-head">
        <h2>2307 <span className="count">{rows.length}</span></h2>
        <span className="spacer" />
        <span className="tree-meta">Certificate of Creditable Tax Withheld at Source</span>
      </div>

      <Bir2307Form suppliers={suppliers} action={addBir2307} />

      {rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>None raised yet — add the first one above.</p>
      ) : (
        // Grouped by year, because that is how a year's filing is assembled and
        // checked — four quarters, and it is obvious when one is missing.
        years.map((y) => {
          const inYear = rows.filter((r) => r.year === y);
          const have = new Set(inYear.map((r) => r.quarter));
          const missing = [1, 2, 3, 4].filter((q) => !have.has(q));

          return (
            <div key={y} className="yeargroup">
              <div className="cat-head">
                <h2>{y} <span className="count">{inYear.length}</span></h2>
                {missing.length > 0 && (
                  <span className="tree-meta">no entries for Q{missing.join(", Q")}</span>
                )}
                <span className="spacer" />
                <a className="viewtoggle" href={`/api/bir-2307/year/${y}`} download
                  title={`Every ${y} certificate in one workbook, a sheet per entry`}>
                  <IconDownload /> {y} workbook
                </a>
              </div>

              <div className="tablewrap">
                <table className="utable stacked">
                  <thead><tr>
                    <th className="numcol">No.</th><th>Quarter</th><th>Period</th>
                    <th>Payee</th><th>TIN</th><th>Registered Address</th>
                    <th>Encoded by</th><th />
                  </tr></thead>
                  <tbody>
                    {inYear.map((r, i) => (
                      <tr key={r.id}>
                        <td className="numcol" data-label="No.">{i + 1}</td>
                        <td data-label="Quarter">
                          <b className="ticket">Q{r.quarter}</b>
                          <span className="tree-meta"> {quarterLabel(r.quarter)}</span>
                        </td>
                        <td className="muted nowrap" data-label="Period">
                          {day(r.periodFrom)} → {day(r.periodTo)}
                        </td>
                        <td data-label="Payee">{r.supplierName}</td>
                        <td className="muted nowrap" data-label="TIN">{r.supplierTin ?? "—"}</td>
                        <td className="muted clip" data-label="Registered Address" title={r.address ?? undefined}>
                          {[r.address, r.zipCode].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="muted" data-label="Encoded by">{r.encodedByName}</td>
                        <td className="rowacts">
                          {/* The blank form, filled in with this certificate. */}
                          <a className="ghost icon" href={`/api/bir-2307/${r.id}`} download
                            title="Download this 2307, filled in" aria-label="Download this 2307"><IconDownload /></a>
                          <form action={deleteBir2307.bind(null, r.id)}>
                            <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
    </>
  );
}
