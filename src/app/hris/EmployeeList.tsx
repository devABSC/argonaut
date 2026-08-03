import { prisma } from "@/lib/prisma";
import EmployeeSearch from "./EmployeeSearch";

const PAGE = 50;

/** All employees, searchable. The HRIS landing page. */
export default async function EmployeeList({ q = "", page = 1 }: { q?: string; page?: number }) {
  const term = q.trim();
  const where = term
    ? {
        OR: [
          { lastName: { contains: term, mode: "insensitive" as const } },
          { firstName: { contains: term, mode: "insensitive" as const } },
          { emailAdd: { contains: term, mode: "insensitive" as const } },
          { jobTitle: { contains: term, mode: "insensitive" as const } },
          { individ: { contains: term, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, all, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.count(),
    prisma.employee.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, individ: true, lastName: true, firstName: true, middleName: true,
        jobTitle: true, emailAdd: true, mobile: true, city: true, company: true,
      },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const from = total === 0 ? 0 : (page - 1) * PAGE + 1;

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Employees <span className="count">{total}{term ? ` of ${all}` : ""}</span></h2>
        <span className="spacer" />
        <EmployeeSearch q={term} />
      </div>

      {rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>
          {term ? `Nobody matches “${term}”.` : "No employees on file yet."}
        </p>
      ) : (
        <>
          <div className="tablewrap">
            <table className="utable stacked">
              <thead>
                <tr>
                  <th className="numcol">No.</th>
                  <th>Employee</th><th>ID</th><th>Job Title</th>
                  <th>Email</th><th>Mobile</th><th>City</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={e.id}>
                    <td className="numcol" data-label="No.">{from + i}</td>
                    <td data-label="Employee">
                      <b>{e.lastName}, {e.firstName}</b>
                      {e.middleName && <span className="muted"> {e.middleName}</span>}
                    </td>
                    <td className="muted" data-label="ID"><code>{e.individ}</code></td>
                    <td data-label="Job Title">{e.jobTitle ?? "—"}</td>
                    <td className="muted" data-label="Email">{e.emailAdd ?? "—"}</td>
                    <td className="muted nowrap" data-label="Mobile">{e.mobile ?? "—"}</td>
                    <td className="muted" data-label="City">{e.city ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="pager">
              <a
                className={page <= 1 ? "disabled" : undefined}
                href={`/hris/employees?page=${page - 1}${term ? `&q=${encodeURIComponent(term)}` : ""}`}
              >
                ← Previous
              </a>
              <span>Page {page} of {pages}</span>
              <a
                className={page >= pages ? "disabled" : undefined}
                href={`/hris/employees?page=${page + 1}${term ? `&q=${encodeURIComponent(term)}` : ""}`}
              >
                Next →
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
