"use client";

/** Plain GET form — the term lives in the URL so results are shareable. */
export default function EmployeeSearch({ q }: { q: string }) {
  return (
    <form className="empsearch" action="/hris/employees" method="get">
      <input name="q" defaultValue={q} placeholder="Search name, ID, job title, email" />
      <button type="submit">Search</button>
      {q && <a className="clear" href="/hris/employees">Clear</a>}
    </form>
  );
}
