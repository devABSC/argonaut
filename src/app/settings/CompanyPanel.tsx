import { prisma } from "@/lib/prisma";
import { createCompany, updateCompany, deleteCompany, uploadCompanyLogo, clearCompanyLogo } from "../actions/company";
import { IconSave, IconTrash, IconPlus } from "../icons";

/** Registers the companies the business operates as. */
export default async function CompanyPanel() {
  const [companies, employeeCodes] = await Promise.all([
    prisma.company.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.employee.groupBy({ by: ["company"], _count: true }),
  ]);

  const known = new Set(companies.map((c) => c.code));
  const unregistered = employeeCodes
    .filter((e) => e.company && !known.has(e.company))
    .map((e) => ({ code: e.company!, count: e._count }));

  return (
    <>
      <div className="panel">
        <h2>Companies <span className="count">{companies.length}</span></h2>
        <p>
          Register each company you operate as. The code is what employee and
          user records point at, so it must match the HRIS data.
        </p>

        <div className="fields">
          <div className="frow crow chead">
            <span>Code</span><span>Company name</span><span>TIN</span>
            <span>Address</span><span>POC email</span><span />
          </div>

          {companies.length === 0 ? (
            <p className="pvempty" style={{ padding: "12px 2px" }}>
              None registered yet — add the first one below.
            </p>
          ) : (
            companies.map((c) => (
              <form className="frow crow" action={updateCompany} key={c.id}>
                <input type="hidden" name="companyId" value={c.id} />
                <input name="code" defaultValue={c.code} required />
                <input name="name" defaultValue={c.name} required />
                <input name="tin" defaultValue={c.tin ?? ""} placeholder="000-000-000-000" />
                <input name="address" defaultValue={c.address ?? ""} placeholder="Registered address" />
                <input name="pocEmail" type="email" defaultValue={c.pocEmail ?? ""} placeholder="poc@company.com" />
                <span className="rowacts">
                  <button className="save icon" type="submit" title="Save" aria-label="Save"><IconSave /></button>
                  <button
                    className="reject icon" type="submit" title="Delete" aria-label="Delete"
                    formAction={deleteCompany.bind(null, c.id)}
                  ><IconTrash /></button>
                </span>
              </form>
            ))
          )}

          {/* The brand mark that heads every statement. Its own form — a file
              input cannot ride along with the row above it. */}
          {companies.map((c) => (
            <form className="logorow" action={uploadCompanyLogo.bind(null, c.id)} key={`logo-${c.id}`}>
              <span className="tree-meta">{c.name} logo</span>
              {c.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="logopreview" src={c.logo} alt={`${c.name} logo`} />
              ) : (
                <span className="muted">none set</span>
              )}
              <input type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" />
              <button className="save icon" type="submit" title="Upload logo" aria-label="Upload logo"><IconSave /></button>
              {c.logo && (
                <button className="reject icon" type="submit" title="Remove logo" aria-label="Remove logo"
                  formAction={clearCompanyLogo.bind(null, c.id)}><IconTrash /></button>
              )}
            </form>
          ))}

          <form className="frow crow fadd" action={createCompany}>
            <input name="code" placeholder="ATO01-165846" required />
            <input name="name" placeholder="Company name" required />
            <input name="tin" placeholder="TIN" />
            <input name="address" placeholder="Address" />
            <input name="pocEmail" type="email" placeholder="POC email" />
            <span className="rowacts">
              <button className="save icon" type="submit" title="Add company" aria-label="Add company"><IconPlus /></button>
            </span>
          </form>
        </div>
      </div>

      {unregistered.length > 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Codes in the HRIS data with no company record</h2>
          <p>These appear on employee records but are not registered above.</p>
          <ul className="queue">
            {unregistered.map((u) => (
              <li key={u.code}>
                <div className="queue-who">
                  <b><code>{u.code}</code></b>
                  <span>{u.count} employee{u.count === 1 ? "" : "s"}</span>
                </div>
                <form action={createCompany}>
                  <input type="hidden" name="code" value={u.code} />
                  <input type="hidden" name="name" value={u.code} />
                  <button className="approve icon" type="submit" title="Register this code" aria-label="Register this code">
                    <IconPlus />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
