import { prisma } from "@/lib/prisma";
import { addField, removeField } from "../actions/forms";

const KINDS: { value: string; label: string }[] = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Long text" },
  { value: "NUMBER", label: "Number" },
  { value: "CURRENCY", label: "Amount" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Dropdown" },
  { value: "CHECKBOX", label: "Checkbox" },
];

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export default async function ServiceFormsPanel() {
  const forms = await prisma.formType.findMany({
    orderBy: { name: "asc" },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      subcategories: {
        select: { name: true, category: { select: { name: true } } },
      },
    },
  });

  if (forms.length === 0) {
    return (
      <div className="panel">
        <h2>Service forms</h2>
        <p>No forms yet — a form is created automatically with each subtype on the Service Type tab.</p>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <h2>Service forms <span className="count">{forms.length}</span></h2>
        <p>
          These fields are added to the standard request details for each subtype.
          Subject and description are always present and are not listed here.
        </p>
      </div>

      {forms.map((f) => {
        const used = f.subcategories[0];
        return (
          <div className="panel" key={f.id} style={{ marginTop: 18 }}>
            <div className="cat-head">
              <h2>{f.name}</h2>
              {used && (
                <span className="tree-meta">
                  {used.category.name} › {used.name}
                </span>
              )}
              <span className="spacer" />
              <span className="tree-meta">
                {f.fields.length} field{f.fields.length === 1 ? "" : "s"}
              </span>
            </div>

            {f.fields.length > 0 && (
              <div className="tablewrap">
                <table className="utable">
                  <thead>
                    <tr><th>Label</th><th>Key</th><th>Type</th><th>Required</th><th>Choices</th><th /></tr>
                  </thead>
                  <tbody>
                    {f.fields.map((fl) => (
                      <tr key={fl.id}>
                        <td><b>{fl.label}</b></td>
                        <td className="muted"><code>{fl.key}</code></td>
                        <td className="muted">{KIND_LABEL[fl.kind] ?? fl.kind}</td>
                        <td>{fl.required ? <span className="pill s-ACTIVE">required</span> : <span className="muted">optional</span>}</td>
                        <td className="muted">{fl.options.length ? fl.options.join(", ") : "—"}</td>
                        <td>
                          <form action={removeField.bind(null, fl.id)}>
                            <button className="reject" type="submit">Remove</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form action={addField} className="field-form">
              <input type="hidden" name="formTypeId" value={f.id} />
              <input name="label" placeholder="Field label — e.g. Amount requested" required />
              <select name="kind" defaultValue="TEXT">
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <input name="options" placeholder="Dropdown choices, comma separated" />
              <label className="req"><input type="checkbox" name="required" /> Required</label>
              <button type="submit">Add field</button>
            </form>
          </div>
        );
      })}
    </>
  );
}
