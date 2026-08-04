import Link from "next/link";

/**
 * The per-employee views. These used to sit in the HRIS top strip, where they
 * were meaningless without a person selected — they belong to one employee's
 * record, so they live inside it.
 */
export const EMP_VIEWS = [
  { slug: "personal-info", label: "Personal Info" },
  { slug: "contract", label: "Contract" },
  { slug: "report-to", label: "Report To" },
  { slug: "statutory", label: "Statutory" },
  { slug: "medical", label: "Medical" },
  { slug: "nte-car", label: "NTE-CAR" },
  { slug: "vlsl", label: "VLSL" },
  { slug: "201-logs", label: "201 Logs" },
] as const;

export type EmpView = (typeof EMP_VIEWS)[number]["slug"];

export function isEmpView(slug: string): slug is EmpView {
  return EMP_VIEWS.some((v) => v.slug === slug);
}

export default function EmployeeTabs({ empId, active }: { empId: string; active: string }) {
  return (
    <div className="subtabs" role="tablist">
      {EMP_VIEWS.map((v) => (
        <Link
          key={v.slug}
          role="tab"
          aria-selected={v.slug === active}
          className={v.slug === active ? "subtab on" : "subtab"}
          href={`/hris/employee/${empId}/${v.slug}`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
