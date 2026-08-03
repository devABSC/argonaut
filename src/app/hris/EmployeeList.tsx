import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EmployeeFilters from "./EmployeeFilters";
import AddEmployee from "./AddEmployee";

const PAGE = 50;

/** All employees, searchable. The HRIS landing page. */
export default async function EmployeeList({
  q = "", bou = "", dept = "", company = "", page = 1, viewer, added, addedName,
}: {
  q?: string;
  added?: string;
  addedName?: string;
  bou?: string;
  dept?: string;
  company?: string;
  page?: number;
  viewer: { role: string; company: string | null };
}) {
  const term = q.trim();

  // Only the owner works across companies. Everyone else is pinned to their
  // own, so hiding the control is backed by the query rather than decorating
  // a list that still contains everybody.
  const isOwner = viewer.role === "SUPER_USER";
  const scopedCompany = isOwner ? company : (viewer.company ?? "");
  const lockedOut = !isOwner && !viewer.company;
  // Only active staff. status is the source system's own flag: 0 active,
  // 1 and above are leavers and disabled accounts.
  const where = {
    status: 0,
    ...(term
      ? {
          OR: [
            { lastName: { contains: term, mode: "insensitive" as const } },
            { firstName: { contains: term, mode: "insensitive" as const } },
            { emailAdd: { contains: term, mode: "insensitive" as const } },
            { jobTitle: { contains: term, mode: "insensitive" as const } },
            { bou: { name: { contains: term, mode: "insensitive" as const } } },
            { individ: { contains: term, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(bou ? { bou: { name: bou } } : {}),
    ...(dept ? { subBou: dept } : {}),
    ...(scopedCompany ? { company: scopedCompany } : {}),
  };

  const [total, all, rows, bouRows, companyRows, deptRows, cityRows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.count(),
    prisma.employee.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, rowid: true, individ: true, lastName: true, firstName: true, middleName: true,
        jobTitle: true, emailAdd: true, mobile: true, city: true, company: true,
        subBou: true,
        bou: { select: { name: true } },
      },
    }),
    prisma.bou.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { code: true, name: true },
    }),
    prisma.employee.findMany({
      where: { AND: [{ NOT: { subBou: null } }, { NOT: { subBou: "" } }] },
      distinct: ["subBou"], select: { subBou: true }, orderBy: { subBou: "asc" },
    }),
    prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true, province: true, region: true, zipCode: true },
    }),
  ]);

  const bouOptions = bouRows;                       // for the add form
  const bous = bouRows.map((b) => b.name);          // for the filter dropdown
  const companies = companyRows.map((c) => c.code);
  const companyOptions = companyRows;  // code + display name, first is the default
  const depts = deptRows.map((d) => d.subBou!).filter(Boolean);
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (term) p.set("q", term);
    if (bou) p.set("bou", bou);
    if (dept) p.set("dept", dept);
    if (isOwner && company) p.set("company", company);
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
        <EmployeeFilters
          q={term}
          bou={bou}
          dept={dept}
          company={company}
          bous={bous}
          depts={depts}
          companies={isOwner ? companies : []}
          showCompany={isOwner}
        />
      </div>

      {added && (
        <div className="banner">
          Employee <b>{addedName || added}</b> added — ID <b>{added}</b>.
        </div>
      )}

      <AddEmployee bous={bouOptions} companies={companyOptions} cities={cityRows} />

      {!isOwner && viewer.company && (
        <p className="pvhelp" style={{ marginTop: 10 }}>
          Showing {viewer.company} only.
        </p>
      )}

      {lockedOut ? (
        <p style={{ marginTop: 16 }}>
          Your account has no company assigned, so there is nothing to show. Ask
          an administrator to set one under Settings → Users.
        </p>
      ) : rows.length === 0 ? (
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
                  {isOwner && <th className="rownum">Row ID</th>}
                  <th>Employee</th><th>ID</th><th>Job Title</th>
                  <th>BOU</th><th>Department</th>
                  <th>Email</th><th>Mobile</th><th>City</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={e.id}>
                    <td className="numcol" data-label="No.">{from + i}</td>
                    {isOwner && (
                      <td className="rownum" data-label="Row ID">{e.rowid}</td>
                    )}
                    <td data-label="Employee">
                      <b>{e.lastName}, {e.firstName}</b>
                      {e.middleName && <span className="muted"> {e.middleName}</span>}
                    </td>
                    <td className="muted" data-label="ID">
                      <Link className="ticket" href={`/hris/employee/${e.id}/personal-info`}>{e.individ}</Link>
                    </td>
                    <td data-label="Job Title">{e.jobTitle ?? "—"}</td>
                    <td className="muted" data-label="BOU">{e.bou?.name ?? "—"}</td>
                    <td className="muted" data-label="Department">{e.subBou ?? "—"}</td>
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
