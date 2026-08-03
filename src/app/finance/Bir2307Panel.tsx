import { prisma } from "@/lib/prisma";
import { IconTrash, IconSave, IconDownload } from "../icons";
import { addBir2307, deleteBir2307, saveWithholdingAgent, saveSupplierInfo } from "../actions/birforms";
import SupplierInfoForm from "./SupplierInfoForm";
import Bir2307Form from "./Bir2307Form";
import { quarterLabel } from "@/lib/quarters";

const day = (d: Date) => d.toISOString().slice(0, 10);
const dayInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Every 2307 raised, newest first. */
export default async function Bir2307Panel({ isOwner }: { isOwner: boolean }) {
  const [company, rows, suppliers] = await Promise.all([
    prisma.company.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.bir2307.findMany({ orderBy: [{ year: "desc" }, { quarter: "asc" }, { supplierName: "asc" }] }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, tin: true, address: true,
        city: true, region: true, country: true, issuanceDate: true,
      },
    }),
  ]);

  // The picker hands dates to a date input, which wants yyyy-mm-dd.
  const supplierRows = suppliers.map((x) => ({
    ...x,
    issuanceDate: x.issuanceDate ? dayInput(x.issuanceDate) : null,
  }));
  // Newest year first; the list is read backwards from the current filing.
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);

  return (
    <>
      {/* Buyer beside supplier, the same seven lines in the same order — the
          shape the certificate itself uses. The buyer is entered once; the
          supplier box is the one used over and over. */}
      <div className="infoboxes">
        <div className="panel infobox">
          <div className="cat-head">
            <h2>Buyer Info</h2>
            <span className="spacer" />
            {!isOwner && <span className="tree-meta">Owner sets this</span>}
          </div>

          {isOwner && company ? (
            <form action={saveWithholdingAgent} className="infoform">
              <input type="hidden" name="companyId" value={company.id} />
              <label className="inforow">
                <span>Company Name</span>
                <input name="name" required defaultValue={company.name} autoComplete="off" />
              </label>
              <label className="inforow">
                <span>TIN No</span>
                <input name="tin" defaultValue={company.tin ?? ""} placeholder="000-000-000-000000" autoComplete="off" />
              </label>
              <label className="inforow">
                <span>Issuance Date</span>
                <input name="issuanceDate" type="date" defaultValue={dayInput(company.issuanceDate)} />
              </label>
              <label className="inforow">
                <span>Registered Add</span>
                <textarea name="address" rows={2} defaultValue={company.address ?? ""} autoComplete="off" />
              </label>
              <label className="inforow">
                <span>City</span>
                <input name="city" defaultValue={company.city ?? ""} autoComplete="off" />
              </label>
              <label className="inforow">
                <span>Region</span>
                <input name="region" defaultValue={company.region ?? ""} autoComplete="off" />
              </label>
              <label className="inforow">
                <span>Country</span>
                <input name="country" defaultValue={company.country ?? "PHILIPPINES"} autoComplete="off" />
              </label>
              {/* Kept off the certificate block, but the record still carries it. */}
              <input type="hidden" name="zipCode" value={company.zipCode ?? ""} />
              <div className="infoact">
                <button className="btn-primary wide" type="submit"><IconSave /> SAVE BUYER</button>
              </div>
            </form>
          ) : (
            <dl className="infolist">
              <div><dt>Company Name</dt><dd>{company?.name ?? "—"}</dd></div>
              <div><dt>TIN No</dt><dd>{company?.tin ?? "—"}</dd></div>
              <div><dt>Issuance Date</dt><dd>{company?.issuanceDate ? day(company.issuanceDate) : "—"}</dd></div>
              <div><dt>Registered Add</dt><dd>{company?.address ?? "—"}</dd></div>
              <div><dt>City</dt><dd>{company?.city ?? "—"}</dd></div>
              <div><dt>Region</dt><dd>{company?.region ?? "—"}</dd></div>
              <div><dt>Country</dt><dd>{company?.country ?? "—"}</dd></div>
            </dl>
          )}
        </div>

        <div className="panel infobox">
          <div className="cat-head">
            <h2>Supplier Info</h2>
            <span className="spacer" />
            <span className="tree-meta">{suppliers.length} on the register</span>
          </div>
          <SupplierInfoForm suppliers={supplierRows} action={saveSupplierInfo} />
        </div>
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
