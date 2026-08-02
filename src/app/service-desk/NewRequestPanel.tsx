import { prisma } from "@/lib/prisma";
import { getStandardForm } from "@/lib/forms";
import { createRequest } from "../actions/requests";
import RequestPicker from "./RequestPicker";
import RequestField from "./RequestField";

export default async function NewRequestPanel({ subId }: { subId?: string }) {
  const categories = await prisma.requestCategory.findMany({
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

  const sub = subId
    ? await prisma.requestSubcategory.findUnique({
        where: { id: subId },
        include: {
          category: { select: { id: true, name: true } },
          formType: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
          approvers: {
            orderBy: { sequence: "asc" },
            include: { approver: { select: { name: true } } },
          },
        },
      })
    : null;

  const standard = sub ? await getStandardForm() : null;

  return (
    <>
      <div className="panel">
        <h2>New request</h2>
        <p>Choose the service type and subtype — the subtype loads its form.</p>
        <RequestPicker
          categories={categories}
          selectedCategoryId={sub?.category.id ?? ""}
          selectedSubcategoryId={sub?.id ?? ""}
        />
      </div>

      {sub && standard && (
        <form action={createRequest} className="panel reqform" style={{ marginTop: 18 }}>
          <input type="hidden" name="subcategoryId" value={sub.id} />

          <div className="cat-head">
            <h2>{sub.category.name} › {sub.name}</h2>
            <span className="spacer" />
            <span className="tree-meta">
              {sub.approvers.length === 0
                ? "no approvers — auto-approved"
                : `approvers: ${sub.approvers.map((a) => a.approver.name).join(" → ")}`}
            </span>
          </div>

          <div className="pv">
            <div className="pvf">
              <label>Subject <span className="rq">*</span></label>
              <input type="text" name="subject" required placeholder="Short summary of the request" />
            </div>
            <div className="pvf">
              <label>Description</label>
              <textarea name="description" rows={3} placeholder="Any detail the approver needs" />
            </div>

            {standard.fields.map((f) => (
              <RequestField
                key={f.id}
                field={f}
                fixedValue={
                  f.optionSource === "SERVICE_TYPE"
                    ? sub.category.name
                    : f.optionSource === "SERVICE_SUBTYPE"
                      ? sub.name
                      : undefined
                }
              />
            ))}

            {sub.formType.fields.length > 0 && (
              <>
                <p className="secdiv">{sub.formType.name} — specific fields</p>
                {sub.formType.fields.map((f) => <RequestField key={f.id} field={f} />)}
              </>
            )}
          </div>

          <button className="btn-primary" type="submit">Submit Ticket</button>
        </form>
      )}
    </>
  );
}
