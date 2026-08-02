import { prisma } from "@/lib/prisma";
import { STANDARD_SLUG } from "@/lib/forms";
import { createFormType, deleteFormType } from "../actions/forms";
import { IconPlus, IconTrash } from "../icons";
import FieldEditor from "./FieldEditor";

export default async function FormTypesPanel() {
  const forms = await prisma.formType.findMany({
    where: { slug: { not: STANDARD_SLUG } },
    orderBy: { name: "asc" },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      subcategories: { select: { name: true, category: { select: { name: true } } } },
    },
  });

  return (
    <>
      <div className="panel">
        <h2>Form types</h2>
        <p>
          Create a form, then give it its own fields. These are added to the
          standard fields, not instead of them.
        </p>
        <form action={createFormType} className="inline-form">
          <input name="name" placeholder="New form name — e.g. Cash Advance Request" required />
          <button type="submit" className="icon" title="Create form" aria-label="Create form"><IconPlus /></button>
        </form>
      </div>

      {forms.length === 0 ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <p>No form types yet. Create one above, or add a subtype on Service Type — that creates a form automatically.</p>
        </div>
      ) : (
        forms.map((f) => {
          const used = f.subcategories[0];
          return (
            <div className="panel" key={f.id} style={{ marginTop: 18 }}>
              <div className="cat-head">
                <h2>{f.name}</h2>
                {used
                  ? <span className="tree-meta">{used.category.name} › {used.name}</span>
                  : <span className="pill s-PENDING">not linked to a subtype</span>}
                <span className="spacer" />
                <span className="tree-meta">{f.fields.length} field{f.fields.length === 1 ? "" : "s"}</span>
                {f.subcategories.length === 0 && (
                  <form action={deleteFormType.bind(null, f.id)}>
                    <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                  </form>
                )}
              </div>
              <FieldEditor formTypeId={f.id} fields={f.fields} />
            </div>
          );
        })
      )}
    </>
  );
}
