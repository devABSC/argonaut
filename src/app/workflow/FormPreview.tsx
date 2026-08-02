import type { FormField } from "@prisma/client";

/** Read-only render of a form exactly as a requester would see it. */
export default function FormPreview({ fields }: { fields: FormField[] }) {
  return (
    <>
      <p>Preview only — nothing here can be submitted.</p>

      <div className="pv">
        <div className="pvf">
          <label>Subject <span className="rq">*</span></label>
          <input disabled placeholder="Short summary of the request" />
        </div>
        <div className="pvf">
          <label>Description</label>
          <textarea disabled rows={3} placeholder="Any detail the approver needs" />
        </div>

        {fields.map((f) => (
          <div className="pvf" key={f.id}>
            <label>
              {f.label} {f.required && <span className="rq">*</span>}
            </label>

            {f.kind === "TEXTAREA" && <textarea disabled rows={3} />}
            {f.kind === "SELECT" && (
              <select disabled>
                <option>{f.options[0] ?? "— choose —"}</option>
              </select>
            )}
            {f.kind === "FILE" && (
              <div className="pvfile">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 16V4.5M12 4.5L7.5 9M12 4.5L16.5 9" /><path d="M4 16.5v2A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5v-2" />
                </svg>
                Choose file
              </div>
            )}
            {f.kind === "CHECKBOX" && (
              <label className="pvcheck"><input type="checkbox" disabled /> Yes</label>
            )}
            {f.kind === "DATE" && <input disabled type="text" placeholder="dd/mm/yyyy" />}
            {f.kind === "CURRENCY" && <input disabled type="text" placeholder="0.00" />}
            {f.kind === "NUMBER" && <input disabled type="text" placeholder="0" />}
            {f.kind === "TEXT" && <input disabled type="text" />}

            {f.helpText && <span className="pvhelp">{f.helpText}</span>}
          </div>
        ))}

        {fields.length === 0 && (
          <p className="pvempty">No fields added yet — only Subject and Description would appear.</p>
        )}
      </div>
    </>
  );
}
