import type { FormField } from "@prisma/client";
import { lookupValues } from "@/lib/lookups";

/** One live input on the request form, rendered from its field definition. */
export default async function RequestField({
  field,
  fixedValue,
}: {
  field: FormField;
  /** Already chosen in the picker — shown read-only rather than asked twice. */
  fixedValue?: string;
}) {
  const name = `f_${field.id}`;
  const req = field.required;

  if (fixedValue !== undefined) {
    return (
      <div className="pvf">
        <label>{field.label}</label>
        <input type="text" value={fixedValue} readOnly className="fixed" />
        <input type="hidden" name={name} value={fixedValue} />
      </div>
    );
  }

  const choices =
    field.kind === "LOOKUP" ? await lookupValues(field.optionSource) : field.options;

  return (
    <div className="pvf">
      <label>
        {field.label} {req && <span className="rq">*</span>}
      </label>

      {field.kind === "TEXTAREA" && <textarea name={name} rows={3} required={req} />}

      {(field.kind === "SELECT" || field.kind === "LOOKUP") && (
        <select name={name} required={req} defaultValue="">
          <option value="">— choose —</option>
          {choices.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {field.kind === "CHECKBOX" && (
        <label className="pvcheck"><input type="checkbox" name={name} /> Yes</label>
      )}

      {field.kind === "FILE" && (
        <input type="file" name={name} className="filein" />
      )}

      {field.kind === "DATE" && <input type="date" name={name} required={req} />}
      {field.kind === "CURRENCY" && (
        <input type="number" step="0.01" min="0" name={name} placeholder="0.00" required={req} />
      )}
      {field.kind === "NUMBER" && <input type="number" name={name} required={req} />}
      {field.kind === "TEXT" && <input type="text" name={name} required={req} />}

      {field.helpText && <span className="pvhelp">{field.helpText}</span>}
      {(field.kind === "SELECT" || field.kind === "LOOKUP") && choices.length === 0 && (
        <span className="pvhelp">No choices configured for this field yet.</span>
      )}
    </div>
  );
}
