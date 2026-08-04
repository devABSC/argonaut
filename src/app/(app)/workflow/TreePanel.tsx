import { prisma } from "@/lib/prisma";

export default async function TreePanel() {
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

  const subs = categories.reduce((n, c) => n + c.subcategories.length, 0);

  return (
    <div className="panel">
      <h2>
        Service type tree
        <span className="count">{categories.length} types · {subs} subtypes</span>
      </h2>
      <p>Structure of the request catalogue, as the Service Desk dropdowns will present it.</p>

      {categories.length === 0 ? (
        <p style={{ marginTop: 18 }}>Nothing to show — add a service type on the Service Type tab.</p>
      ) : (
        <ul className="tree">
          {categories.map((c) => (
            <li key={c.id} className="tree-cat">
              <div className="tree-row">
                <span className="tree-ico">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 7.5A1.5 1.5 0 014.5 6h4l2 2.5h7A1.5 1.5 0 0119 10v7a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 013 17z" />
                  </svg>
                </span>
                <b>{c.name}</b>
                {!c.isActive && <span className="pill s-SUSPENDED">inactive</span>}
              </div>

              {c.subcategories.length === 0 ? (
                <ul className="tree-sub">
                  <li className="tree-empty">no subtypes yet</li>
                </ul>
              ) : (
                <ul className="tree-sub">
                  {c.subcategories.map((s) => (
                    <li key={s.id}>
                      <div className="tree-row">
                        <span className="tree-ico leaf">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M6 3.5h8L18.5 8v12.5h-13z" /><path d="M13.5 3.6V8H18" />
                          </svg>
                        </span>
                        <span className="tree-name">{s.name}</span>
                        <span className="tree-meta">
                          {s.formType._count.fields} field{s.formType._count.fields === 1 ? "" : "s"}
                        </span>
                        {s._count.steps === 0
                          ? <span className="pill s-PENDING">no route</span>
                          : <span className="pill s-ACTIVE">{s._count.steps} step{s._count.steps === 1 ? "" : "s"}</span>}
                        {s._count.requests > 0 && <span className="tree-meta">{s._count.requests} requests</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
