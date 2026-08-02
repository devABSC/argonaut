import { getStandardForm } from "@/lib/forms";
import FieldEditor from "./FieldEditor";

export default async function StandardPanel() {
  const form = await getStandardForm();

  return (
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
  );
}
