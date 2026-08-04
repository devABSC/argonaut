"use client";

/**
 * Search plus grouping filters. Everything lives in the query string, so a
 * filtered view can be shared or bookmarked.
 */
export default function EmployeeFilters({
  q, bou, dept, company, bous, depts, companies, showCompany,
}: {
  q: string;
  bou: string;
  dept: string;
  company: string;
  bous: string[];
  depts: string[];
  companies: { code: string; name: string }[];
  /** Owner-only, and locked to the default company until there is a second. */
  showCompany: boolean;
}) {
  return (
    <form className="empsearch" action="/hris/employees" method="get">
      <input name="q" defaultValue={q} placeholder="Search name, ID, job title, email" />

      <select name="bou" defaultValue={bou} aria-label="Search by BOU">
        <option value="">
          {bous.length ? "All BOUs" : "No BOU data"}
        </option>
        {bous.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>

      <select name="dept" defaultValue={dept} aria-label="Search by department">
        <option value="">{depts.length ? "All departments" : "No department data"}</option>
        {depts.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      {showCompany && (
        // Locked to the one company for now — shown so it is obvious which set
        // is on screen, disabled because there is nothing else to pick yet.
        <select
          name="company"
          defaultValue={company}
          aria-label="Company"
          title="Locked to ATOMIT for now"
          disabled
        >
          {companies.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      )}

      <button type="submit">Search</button>
      {(q || bou || dept || (showCompany && company)) && <a className="clear" href="/hris/employees">Clear</a>}
    </form>
  );
}
