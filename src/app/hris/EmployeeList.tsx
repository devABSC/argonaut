import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EmployeeFilters from "./EmployeeFilters";

const PAGE = 50;

/** All employees, searchable. The HRIS landing page. */
export default async function EmployeeList({
  q = "", bou = "", company = "", page = 1,
}: { q?: string; bou?: string; company?: string; page?: number }) {
  const term = q.trim();
  const where = {
    ...(term
      ? {
          OR: [
            { lastName: { contains: term, mode: "insensitive" as const } },
            { firstName: { contains: term, mode: "insensitive" as const } },
            { emailAdd: { contains: term, mode: "insensitive" as const } },
            { jobTitle: { contains: term, mode: "insensitive" as const } },
            { individ: { contains: term, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(bou ? { bouID: bou } : {}),
    ...(company ? { company } : {}),
  };

  const [total, all, rows, bouRows, companyRows] = await Promise.all([
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
    prisma.employee.findMany({
      where: { AND: [{ NOT: { bouID: null } }, { NOT: { bouID: "" } }] },
      distinct: ["bouID"], select: { bouID: true }, orderBy: { bouID: "asc" },
    }),
    prisma.employee.findMany({
      where: { NOT: { company: null } },
      distinct: ["company"], select: { company: true }, orderBy: { company: "asc" },
    }),
  ]);

  const bous = bouRows.map((b) => b.bouID!).filter(Boolean);
  const companies = companyRows.map((c) => c.company!).filter(Boolean);
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (term) p.set("q", term);
    if (bou) p.set("bou", bou);
    if (company) p.set("company", company);
    for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
    return p.toString();
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const from = total === 0 ? 0 : (page - 1) * PAGE + 1;

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Employees <span className="count">{total}{total !== all ? ` of ${all}` : ""}</span></h2>
        <span className="spacer" />
        <EmployeeFilters q={term} bou={bou} company={company} bous={bous} companies={companies} />
      </div>

      {rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>
          {term || bou || company ? "Nobody matches those filters." : "No employees on file yet."}
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
                    <td className="muted" data-label="ID">
                      <Link className="ticket" href={`/hris/personal-info?emp=${e.id}`}>{e.individ}</Link>
                    </td>
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
                href={`/hris/employees?${qs({ page: page - 1 })}`}
              >
                ← Previous
              </a>
              <span>Page {page} of {pages}</span>
              <a
                className={page >= pages ? "disabled" : undefined}
                href={`/hris/employees?${qs({ page: page + 1 })}`}
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
