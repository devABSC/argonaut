import { prisma } from "@/lib/prisma";
import { createCategory, createSubcategory, deleteCategory, deleteSubcategory } from "@/app/actions/catalog";
import { IconPlus, IconTrash } from "@/app/icons";

export default async function CatalogPanel() {
  const categories = await prisma.requestCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      subcategories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          formType: { select: { name: true, _count: { select: { fields: true } } } },
          _count: { select: { steps: true, requests: true } },
        },
      },
    },
  });

  return (
    <>
      <div className="panel">
        <h2>Service types</h2>
        <p>
          A service type groups related requests. Each subtype under it gets its
          own form and its own approver chain.
        </p>
        <form action={createCategory} className="inline-form">
          <input name="name" placeholder="New service type — e.g. Finance" required />
          <button type="submit" className="icon" title="Add service type" aria-label="Add service type"><IconPlus /></button>
        </form>
      </div>

      {categories.length === 0 ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <p>No service types yet. Add one above to get started.</p>
        </div>
      ) : (
        categories.map((c) => (
          <div className="panel cat" key={c.id} style={{ marginTop: 18 }}>
            <div className="cat-head">
              <h2>{c.name}</h2>
              <span className="count">{c.subcategories.length} subtype{c.subcategories.length === 1 ? "" : "s"}</span>
              <span className="spacer" />
              {c.subcategories.length === 0 && (
                <form action={deleteCategory.bind(null, c.id)}>
                  <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                </form>
              )}
            </div>

            {c.subcategories.length > 0 && (
              <div className="tablewrap">
                <table className="utable">
                  <thead>
                    <tr><th>Subtype</th><th>Form</th><th>Fields</th><th>Steps</th><th>Requests</th><th /></tr>
                  </thead>
                  <tbody>
                    {c.subcategories.map((s) => (
                      <tr key={s.id}>
                        <td><b>{s.name}</b></td>
                        <td className="muted">{s.formType.name}</td>
                        <td className="muted">{s.formType._count.fields}</td>
                        <td>
                          {s._count.steps === 0
                            ? <span className="pill s-PENDING">no route</span>
                            : <span className="pill s-ACTIVE">{s._count.steps}</span>}
                        </td>
                        <td className="muted">{s._count.requests}</td>
                        <td>
                          {s._count.requests === 0 && (
                            <form action={deleteSubcategory.bind(null, s.id)}>
                              <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form action={createSubcategory} className="inline-form">
              <input type="hidden" name="categoryId" value={c.id} />
              <input name="name" placeholder={`New subtype under ${c.name} — e.g. Cash Advance`} required />
              <button type="submit" className="icon" title="Add subtype" aria-label="Add subtype"><IconPlus /></button>
            </form>
          </div>
        ))
      )}
    </>
  );
}
