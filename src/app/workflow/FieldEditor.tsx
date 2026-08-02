import type { FormField } from "@prisma/client";
import { addField, removeField } from "../actions/forms";

export const KINDS = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Long text" },
  { value: "NUMBER", label: "Number" },
  { value: "CURRENCY", label: "Amount" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Dropdown" },
  { value: "CHECKBOX", label: "Checkbox" },
];

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

/** Field table + add-field row for one form. Used by both Service Forms tabs. */
export default function FieldEditor({
  formTypeId,
  fields,
  emptyText = "No fields yet.",
}: {
  formTypeId: string;
  fields: FormField[];
  emptyText?: string;
}) {
  return (
    <>
      {fields.length === 0 ? (
        <p style={{ marginTop: 14 }}>{emptyText}</p>
      ) : (
        <div className="tablewrap">
          <table className="utable">
            <thead>
              <tr><th>Label</th><th>Key</th><th>Type</th><th>Required</th><th>Choices</th><th /></tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id}>
                  <td><b>{f.label}</b></td>
                  <td className="muted"><code>{f.key}</code></td>
                  <td className="muted">{KIND_LABEL[f.kind] ?? f.kind}</td>
                  <td>
                    {f.required
                      ? <span className="pill s-ACTIVE">required</span>
                      : <span className="muted">optional</span>}
                  </td>
                  <td className="muted">{f.options.length ? f.options.join(", ") : "—"}</td>
                  <td>
                    <form action={removeField.bind(null, f.id)}>
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
        <input type="hidden" name="formTypeId" value={formTypeId} />
        <input name="label" placeholder="Field label — e.g. Amount requested" required />
        <select name="kind" defaultValue="TEXT">
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <input name="options" placeholder="Dropdown choices, comma separated" />
        <label className="req"><input type="checkbox" name="required" /> Required</label>
        <button type="submit">Add field</button>
      </form>
    </>
  );
}
