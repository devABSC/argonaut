import { prisma } from "@/lib/prisma";
import FieldEditor from "./FieldEditor";
import SubtypePicker from "./SubtypePicker";

/**
 * A subtype and its form are the same thing, so this is driven by a subtype
 * dropdown rather than a separate list of forms to name and create.
 */
export default async function FormTypesPanel({ subId }: { subId?: string }) {
  const cats = await prisma.requestCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      subcategories: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      },
    },
  });

  // "Finance BIR 2316" — one entry per subtype, since a subtype is a form.
  const options = cats.flatMap((c) =>
    c.subcategories.map((s) => ({ id: s.id, label: `${c.name} ${s.name}` })),
  );

  const sub = subId
    ? await prisma.requestSubcategory.findUnique({
        where: { id: subId },
        include: {
          category: { select: { id: true, name: true } },
          formType: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
        },
      })
    : null;

  return (
    <>
      <div className="panel">
        <h2>Form by subtype</h2>
        <p>
          Each subtype is its own form. Pick one to edit the fields it adds on
          top of the standard fields.
        </p>
        <SubtypePicker
          options={options}
          selected={sub?.id ?? ""}
          basePath="/workflow/service-forms?t=types"
          param="form"
        />
      </div>

      {options.length === 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <p>No subtypes yet — add one on the Service Type tab.</p>
        </div>
      )}

      {sub && (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="cat-head">
            <h2>{sub.category.name} › {sub.name}</h2>
            <span className="spacer" />
            <span className="tree-meta">
              {sub.formType.fields.length} field{sub.formType.fields.length === 1 ? "" : "s"}
            </span>
          </div>
          <FieldEditor
            formTypeId={sub.formTypeId}
            fields={sub.formType.fields}
            emptyText="No fields specific to this subtype yet — it will show only the standard fields."
          />
        </div>
      )}
    </>
  );
}
