"use client";

/**
 * Search plus grouping filters. Everything lives in the query string, so a
 * filtered view can be shared or bookmarked.
 */
export default function EmployeeFilters({
  q, bou, company, bous, companies,
}: {
  q: string;
  bou: string;
  company: string;
  bous: string[];
  companies: string[];
}) {
  return (
    <form className="empsearch" action="/hris/employees" method="get">
      <input name="q" defaultValue={q} placeholder="Search name, ID, job title, email" />

      <select name="bou" defaultValue={bou} aria-label="Filter by BOU">
        <option value="">
          {bous.length ? "All BOUs" : "No BOU data"}
        </option>
        {bous.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>

      <select name="company" defaultValue={company} aria-label="Filter by company">
        <option value="">All companies</option>
        {companies.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <button type="submit">Filter</button>
      {(q || bou || company) && <a className="clear" href="/hris/employees">Clear</a>}
    </form>
  );
}
