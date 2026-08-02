import type { FormField } from "@prisma/client";
import { addField, removeField, updateField, moveField } from "../actions/forms";
import { IconSave, IconTrash, IconPlus, IconUp, IconDown } from "../icons";
import { LOOKUPS } from "@/lib/lookups";

/** Display types offered when adding a field. */
export const KINDS = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Text Area" },
  { value: "SELECT", label: "List" },
  { value: "FILE", label: "File Upload" },
  { value: "LOOKUP", label: "Lookup" },
  { value: "NUMBER", label: "Number" },
  { value: "CURRENCY", label: "Amount" },
  { value: "DATE", label: "Date" },
  { value: "CHECKBOX", label: "Checkbox" },
];

/**
 * Field list + add row for one form. Each existing field is its own <form> with
 * every input nested inside it — associating inputs by `form=` id is unreliable
 * with server actions, which silently drops the values on submit.
 */
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
    <div className="fields">
      <div className="frow fhead">
        <span /><span>Label</span><span>Display Type</span><span>Choices</span><span>Required</span><span />
      </div>

      {fields.length === 0 ? (
        <p className="pvempty" style={{ padding: "12px 2px" }}>{emptyText}</p>
      ) : (
        fields.map((f, i) => (
          <form className="frow" action={updateField} key={f.id}>
            <input type="hidden" name="fieldId" value={f.id} />

            <span className="fmove">
              <button
                className="nudge" type="submit" title="Move up" aria-label="Move up"
                disabled={i === 0}
                formAction={moveField.bind(null, f.id, "up")}
              >
                <IconUp />
              </button>
              <button
                className="nudge" type="submit" title="Move down" aria-label="Move down"
                disabled={i === fields.length - 1}
                formAction={moveField.bind(null, f.id, "down")}
              >
                <IconDown />
              </button>
            </span>

            <span className="fcell">
              <input name="label" defaultValue={f.label} required />
              <code className="fkey">{f.key}</code>
            </span>

            <select name="kind" defaultValue={f.kind}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>

            <span className="fcell">
              <input
                name="options"
                defaultValue={f.options.join(", ")}
                placeholder="List choices — Cash, Cheque"
              />
              <select name="optionSource" defaultValue={f.optionSource ?? ""}>
                <option value="">Table source — none</option>
                {LOOKUPS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </span>

            <label className="req">
              <input type="checkbox" name="required" defaultChecked={f.required} />
              Required
            </label>

            <span className="rowacts">
              <button className="save icon" type="submit" title="Save" aria-label="Save"><IconSave /></button>
              <button className="reject icon" type="submit" title="Remove" aria-label="Remove" formAction={removeField.bind(null, f.id)}><IconTrash /></button>
            </span>
          </form>
        ))
      )}

      <form action={addField} className="frow fadd">
        <span className="fmove" />
        <input type="hidden" name="formTypeId" value={formTypeId} />
        <input name="label" placeholder="New field label — e.g. Amount requested" required />
        <select name="kind" defaultValue="TEXT">
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <span className="fcell">
          <input name="options" placeholder="List choices — Cash, Cheque" />
          <select name="optionSource" defaultValue="">
            <option value="">Table source — none</option>
            {LOOKUPS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </span>
        <label className="req"><input type="checkbox" name="required" /> Required</label>
        <button className="save icon" type="submit" title="Add field" aria-label="Add field"><IconPlus /></button>
      </form>
    </div>
  );
}
