import type { FormField } from "@prisma/client";
import { lookupLabel, lookupValues, serviceTypeTree } from "@/lib/lookups";
import CascadeLookup from "./CascadeLookup";

/** Read-only render of a form exactly as a requester would see it. */
export default async function FormPreview({ fields }: { fields: FormField[] }) {
  // Resolve each lookup source once so the preview shows real values.
  const sources: Record<string, string[]> = {};
  for (const f of fields) {
    if (f.kind === "LOOKUP") sources[f.id] = await lookupValues(f.optionSource);
  }

  const typeField = fields.find((f) => f.kind === "LOOKUP" && f.optionSource === "SERVICE_TYPE");
  const subtypeField = fields.find((f) => f.kind === "LOOKUP" && f.optionSource === "SERVICE_SUBTYPE");
  const cascade = Boolean(typeField && subtypeField);
  const tree = cascade ? await serviceTypeTree() : {};

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

        {fields.map((f) => {
          // Service Type + Service Subtype render as one linked pair, drawn at
          // the position of the type field; the subtype row is skipped.
          if (cascade && f.id === subtypeField!.id) return null;
          if (cascade && f.id === typeField!.id) {
            return (
              <CascadeLookup
                key={f.id}
                tree={tree}
                typeLabel={typeField!.label}
                subtypeLabel={subtypeField!.label}
                typeRequired={typeField!.required}
                subtypeRequired={subtypeField!.required}
              />
            );
          }

          return (
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
            {f.kind === "LOOKUP" && (
              <>
                <select disabled>
                  <option>{sources[f.id]?.[0] ?? "— no values in the source table —"}</option>
                </select>
                <span className="pvhelp">
                  from {lookupLabel(f.optionSource) ?? "an unset source"}
                  {sources[f.id] ? ` · ${sources[f.id].length} value(s)` : ""}
                </span>
              </>
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
          );
        })}

        {fields.length === 0 && (
          <p className="pvempty">No fields added yet — only Subject and Description would appear.</p>
        )}
      </div>
    </>
  );
}
