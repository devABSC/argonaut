import Link from "next/link";
import { getStandardForm } from "@/lib/forms";
import FieldEditor from "./FieldEditor";
import FormPreview from "./FormPreview";

export default async function StandardPanel({ preview }: { preview: boolean }) {
  const form = await getStandardForm();

  return (
    <>
      <div className="viewbar">
        <Link
          className="viewtoggle"
          href={preview ? "/workflow/service-forms" : "/workflow/service-forms?preview=1"}
        >
          {preview ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              Back to Fields
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                <circle cx="12" cy="12" r="2.7" />
              </svg>
              View Form
            </>
          )}
        </Link>
      </div>

      {preview ? (
        <FormPreview title="Standard form" fields={form.fields} />
      ) : (
        <div className="panel">
          <h2>Standard fields <span className="count">{form.fields.length}</span></h2>
          <p>
            Fields added here appear on every request form, whatever the service
            type. Subject and description are built in and are not listed.
          </p>
          <FieldEditor
            formTypeId={form.id}
            fields={form.fields}
            emptyText="No standard fields yet — add the ones common to every request."
          />
        </div>
      )}
    </>
  );
}
