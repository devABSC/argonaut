import type { FormField } from "@prisma/client";
import { addField, removeField, updateField, moveField } from "../actions/forms";
import { IconSave, IconTrash, IconPlus, IconUp, IconDown } from "../icons";
import FieldTypeCells from "./FieldTypeCells";

export { KINDS } from "./kinds";

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
        <span /><span>Label</span><span>Display Type</span><span>Choices / Source</span><span>Required</span><span />
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

            <FieldTypeCells
              kind={f.kind}
              options={f.options.join(", ")}
              optionSource={f.optionSource ?? ""}
            />

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
        <FieldTypeCells kind="TEXT" />
        <label className="req"><input type="checkbox" name="required" /> Required</label>
        <button className="save icon" type="submit" title="Add field" aria-label="Add field"><IconPlus /></button>
      </form>
    </div>
  );
}
