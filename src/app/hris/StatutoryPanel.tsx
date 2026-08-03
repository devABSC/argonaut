import { prisma } from "@/lib/prisma";
import { saveStatutory } from "../actions/employees";
import { IconSave } from "../icons";

const FIELDS = [
  { name: "compId", label: "Company ID", hint: "260226-083911" },
  { name: "tinId", label: "TIN ID", hint: "359-737-010" },
  { name: "sssId", label: "SSS ID", hint: "34-7490059-7" },
  { name: "philId", label: "Philhealth ID", hint: "03-026276722-8" },
  { name: "pagibigId", label: "Pagibig", hint: "1212-2323-1697" },
  { name: "hmoId", label: "HMO ID", hint: "" },
] as const;

/** Government and benefit identifiers for one employee. */
export default async function StatutoryPanel({ empId }: { empId: string }) {
  const e = await prisma.employee.findUnique({
    where: { id: empId },
    select: {
      id: true, compId: true, tinId: true, sssId: true,
      philId: true, pagibigId: true, hmoId: true,
    },
  });
  if (!e) return <div className="panel"><h2>Statutory</h2><p>That employee record no longer exists.</p></div>;

  const onFile = FIELDS.filter((f) => e[f.name]).length;

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Statutory</h2>
        <span className="count">{onFile} of {FIELDS.length} on file</span>
      </div>
      <p>
        Government and benefit identifiers. Blank means nothing was on record —
        the import only carried what the source system held.
      </p>

      <form action={saveStatutory} className="statgrid">
        <input type="hidden" name="empId" value={e.id} />
        {FIELDS.map((f) => (
          <label key={f.name} className="statfield">
            <span>{f.label}</span>
            <input
              name={f.name}
              defaultValue={e[f.name] ?? ""}
              placeholder={f.hint || "—"}
              autoComplete="off"
            />
          </label>
        ))}
        <div className="statacts">
          <button className="btn-primary" type="submit"><IconSave /> Save statutory</button>
        </div>
      </form>
    </div>
  );
}
