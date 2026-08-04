import { prisma } from "@/lib/prisma";
import { createSupplier, saveSupplier, deleteSupplier } from "@/app/actions/suppliers";
import { IconSave, IconTrash, IconPlus } from "@/app/icons";

/** Companies we buy from. The other side of Clients. */
export default async function SuppliersPanel() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { owner: { select: { name: true } } },
  });
  const active = suppliers.filter((s) => s.isActive).length;

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Suppliers <span className="count">{active} active of {suppliers.length}</span></h2>
        </div>
        <p>
          Companies we buy from — kept apart from Clients, which is who we sell
          to. Untick Active to retire one without losing its history.
        </p>

        {suppliers.length === 0 ? (
          <p style={{ marginTop: 16 }}>No suppliers on the register yet.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead>
                <tr>
                  <th className="numcol">No.</th>
                  <th>Supplier</th><th>Category</th><th>Supplies</th>
                  <th>Contact</th><th>Email</th><th>Phone</th>
                  <th>City</th><th>Terms</th><th>Active</th><th />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s, i) => (
                  <tr key={s.id} className={s.isActive ? undefined : "retired"}>
                    <td className="numcol" data-label="No.">{i + 1}</td>
                    <td data-label="Supplier"><b>{s.name}</b></td>
                    <td className="muted" data-label="Category">{s.category ?? "—"}</td>
                    <td className="muted" data-label="Supplies">{s.supplies ?? "—"}</td>
                    <td className="muted" data-label="Contact">{s.contactName ?? "—"}</td>
                    <td className="muted" data-label="Email">{s.contactEmail ?? "—"}</td>
                    <td className="muted nowrap" data-label="Phone">{s.phone ?? "—"}</td>
                    <td className="muted" data-label="City">{s.city ?? "—"}</td>
                    <td className="muted" data-label="Terms">{s.paymentTerms ?? "—"}</td>
                    <td data-label="Active">
                      <span className={`pill ${s.isActive ? "s-ACTIVE" : "s-SUSPENDED"}`}>
                        {s.isActive ? "Active" : "Retired"}
                      </span>
                    </td>
                    <td className="rowacts">
                      <form action={deleteSupplier.bind(null, s.id)}>
                        <button className="reject icon" type="submit" title="Delete" aria-label="Delete">
                          <IconTrash />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Add a supplier</h2>
        <form action={createSupplier} className="statgrid">
          <label className="statfield"><span>Supplier name</span>
            <input name="name" required autoComplete="off" /></label>
          <label className="statfield"><span>Category</span>
            <input name="category" autoComplete="off" placeholder="e.g. IT hardware" /></label>
          <label className="statfield"><span>Payment terms</span>
            <input name="paymentTerms" autoComplete="off" placeholder="e.g. 30 days" /></label>

          <label className="statfield full"><span>What they supply</span>
            <textarea name="supplies" rows={2} /></label>

          <label className="statfield"><span>Contact person</span>
            <input name="contactName" autoComplete="off" /></label>
          <label className="statfield"><span>Contact email</span>
            <input name="contactEmail" type="email" autoComplete="off" /></label>
          <label className="statfield"><span>Phone</span>
            <input name="phone" autoComplete="off" /></label>

          <label className="statfield"><span>Website</span>
            <input name="website" autoComplete="off" placeholder="https://" /></label>
          <label className="statfield"><span>TIN</span>
            <input name="tin" autoComplete="off" /></label>
          <label className="statfield"><span>City</span>
            <input name="city" autoComplete="off" /></label>

          <label className="statfield full"><span>Address</span>
            <input name="address" autoComplete="off" /></label>
          <label className="statfield full"><span>Notes</span>
            <textarea name="notes" rows={2} /></label>

          <div className="statacts">
            <button className="btn-primary" type="submit"><IconPlus /> Add supplier</button>
          </div>
        </form>
      </div>
    </>
  );
}
