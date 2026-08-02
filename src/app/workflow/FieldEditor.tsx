import type { FormField } from "@prisma/client";
import { addField, removeField, updateField } from "../actions/forms";

/** Display types offered when adding a field. */
export const KINDS = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Text Area" },
  { value: "SELECT", label: "List" },
  { value: "FILE", label: "File Upload" },
  { value: "NUMBER", label: "Number" },
  { value: "CURRENCY", label: "Amount" },
  { value: "DATE", label: "Date" },
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
              <tr><th>Label</th><th>Key</th><th>Display Type</th><th>Required</th><th>Choices</th><th /></tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id}>
                  <td>
                    <form id={`ff-${f.id}`} action={updateField}>
                      <input type="hidden" name="fieldId" value={f.id} />
                    </form>
                    <input name="label" form={`ff-${f.id}`} defaultValue={f.label} required />
                  </td>
                  <td className="muted"><code>{f.key}</code></td>
                  <td>
                    <select name="kind" form={`ff-${f.id}`} defaultValue={f.kind}>
                      {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <label className="req">
                      <input type="checkbox" name="required" form={`ff-${f.id}`} defaultChecked={f.required} />
                      Required
                    </label>
                  </td>
                  <td>
                    <input
                      name="options"
                      form={`ff-${f.id}`}
                      defaultValue={f.options.join(", ")}
                      placeholder="—"
                    />
                  </td>
                  <td className="rowacts">
                    <button className="save" type="submit" form={`ff-${f.id}`}>Save</button>
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
        <span className="flabel">Display Type</span>
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
