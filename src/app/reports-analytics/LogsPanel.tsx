import { prisma } from "@/lib/prisma";

const PAGE = 60;

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

const TYPE_PILL: Record<string, string> = {
  create: "s-ACTIVE", update: "s-PENDING", approve: "s-ACTIVE",
  delete: "s-REJECTED", reject: "s-REJECTED",
};

/** Audit trail of notable transactions, newest first. */
export default async function LogsPanel({ q = "", page = 1 }: { q?: string; page?: number }) {
  const term = q.trim();
  const where = term
    ? {
        OR: [
          { description: { contains: term, mode: "insensitive" as const } },
          { module: { contains: term, mode: "insensitive" as const } },
          { createdByName: { contains: term, mode: "insensitive" as const } },
          { type: { contains: term, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.logHistory.count({ where }),
    prisma.logHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Log history <span className="count">{total}</span></h2>
        <span className="spacer" />
        <form className="empsearch" action="/reports-analytics/logs" method="get">
          <input name="q" defaultValue={term} placeholder="Search action, module or person" />
          <button type="submit">Search</button>
          {term && <a className="clear" href="/reports-analytics/logs">Clear</a>}
        </form>
      </div>

      {rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>
          {term ? "Nothing matches that." : "No transactions recorded yet."}
        </p>
      ) : (
        <>
          <div className="tablewrap">
            <table className="utable stacked">
              <thead>
                <tr><th>When</th><th>Type</th><th>Module</th><th>Description</th><th>By</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted nowrap" data-label="When">{fmt(r.createdAt)}</td>
                    <td data-label="Type">
                      <span className={`pill ${TYPE_PILL[r.type] ?? "s-SUSPENDED"}`}>{r.type}</span>
                    </td>
                    <td className="muted" data-label="Module">{r.module || "—"}</td>
                    <td data-label="Description">{r.description}</td>
                    <td className="muted" data-label="By">{r.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="pager">
              <a className={page <= 1 ? "disabled" : undefined}
                 href={`/reports-analytics/logs?page=${page - 1}${term ? `&q=${encodeURIComponent(term)}` : ""}`}>← Previous</a>
              <span>Page {page} of {pages}</span>
              <a className={page >= pages ? "disabled" : undefined}
                 href={`/reports-analytics/logs?page=${page + 1}${term ? `&q=${encodeURIComponent(term)}` : ""}`}>Next →</a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
