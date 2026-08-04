import { prisma } from "@/lib/prisma";
import { getStandardForm } from "@/lib/forms";
import { createRequest } from "@/app/actions/requests";
import RequestPicker from "./RequestPicker";
import RequestField from "./RequestField";
import SubmitButton from "@/app/SubmitButton";

export default async function NewRequestPanel({
  subId,
  requesterName,
}: {
  subId?: string;
  requesterName: string;
}) {
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
          steps: {
            orderBy: { sequence: "asc" },
            include: { approvers: { include: { user: { select: { name: true } } } } },
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
              {sub.steps.length === 0
                ? "no route — auto-approved"
                : sub.steps
                    .map((st) =>
                      st.actor === "REQUESTOR"
                        ? `${st.name} (requestor)`
                        : `${st.name} (${st.approvers.map((a) => a.user.name).join(", ") || "unassigned"})`,
                    )
                    .join(" → ")}
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
                  f.key === "requestor"
                    ? requesterName
                    : f.optionSource === "SERVICE_TYPE"
                      ? sub.category.name
                      : f.optionSource === "SERVICE_SUBTYPE"
                        ? sub.name
                        : undefined
                }
              />
            ))}

            {sub.formType.fields.length > 0 && (
              <>
                <p className="secdiv">{sub.name} Details</p>
                {sub.formType.fields.map((f) => <RequestField key={f.id} field={f} />)}
              </>
            )}
          </div>

          <SubmitButton />
        </form>
      )}
    </>
  );
}
