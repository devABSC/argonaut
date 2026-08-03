import { prisma } from "@/lib/prisma";
import { IconTrash } from "../icons";
import { addBir2307, deleteBir2307 } from "../actions/birforms";
import Bir2307Form from "./Bir2307Form";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Every 2307 raised, newest first. */
export default async function Bir2307Panel() {
  const [rows, suppliers] = await Promise.all([
    prisma.bir2307.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, tin: true, address: true },
    }),
  ]);

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>2307 <span className="count">{rows.length}</span></h2>
        <span className="spacer" />
        <span className="tree-meta">Certificate of Creditable Tax Withheld at Source</span>
      </div>

      <Bir2307Form suppliers={suppliers} action={addBir2307} />

      {rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>None raised yet — add the first one above.</p>
      ) : (
        <div className="tablewrap">
          <table className="utable stacked">
            <thead><tr>
              <th className="numcol">No.</th><th>Period</th><th>Supplier</th>
              <th>TIN</th><th>Registered Address</th><th>Encoded by</th><th />
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="numcol" data-label="No.">{i + 1}</td>
                  <td className="muted nowrap" data-label="Period">
                    {day(r.periodFrom)} → {day(r.periodTo)}
                  </td>
                  <td data-label="Supplier">{r.supplierName}</td>
                  <td className="muted nowrap" data-label="TIN">{r.supplierTin ?? "—"}</td>
                  <td className="muted clip" data-label="Registered Address" title={r.address ?? undefined}>
                    {r.address ?? "—"}
                  </td>
                  <td className="muted" data-label="Encoded by">{r.encodedByName}</td>
                  <td className="rowacts">
                    <form action={deleteBir2307.bind(null, r.id)}>
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
  );
}
