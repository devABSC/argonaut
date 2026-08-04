import { prisma } from "@/lib/prisma";
import { SLOW_MS } from "@/lib/query-log";
import CopyButton from "./CopyButton";

const secs = (ms: number) => (ms / 1000).toFixed(2);

/**
 * The ten slowest database calls recorded, worst first.
 *
 * Only calls over the threshold are kept, so an empty table means nothing has
 * been slow — which is the answer, not a missing feature.
 */
export default async function SqlPanel() {
  const rows = await prisma.queryStat.findMany({
    orderBy: { ms: "desc" },
    take: 10,
  });

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Slowest queries <span className="count">{rows.length}</span></h2>
        <span className="spacer" />
        <span className="tree-meta">anything over {(SLOW_MS / 1000).toFixed(2)}s is recorded</span>
      </div>

      {rows.length === 0 ? (
        <p style={{ marginTop: 14 }}>
          Nothing has taken longer than {(SLOW_MS / 1000).toFixed(2)}s. The list fills itself as
          pages are used.
        </p>
      ) : (
        <div className="tablewrap">
          <table className="utable stacked">
            <thead><tr>
              <th className="numcol">No.</th><th>Module</th><th>Page</th>
              <th>Query</th><th className="amt">Seconds</th><th />
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="numcol" data-label="No.">{i + 1}</td>
                  <td data-label="Module">{r.module}</td>
                  <td data-label="Page">
                    <a className="ticket" href={r.url}>{r.url}</a>
                  </td>
                  <td data-label="Query"><code className="sqlcell">{r.sql}</code></td>
                  <td className={r.ms >= 1000 ? "amt owed" : "amt"} data-label="Seconds">
                    {secs(r.ms)}
                  </td>
                  <td className="rowacts"><CopyButton text={r.sql} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
