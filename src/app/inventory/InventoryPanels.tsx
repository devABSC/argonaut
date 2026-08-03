import { prisma } from "@/lib/prisma";
import { IconPlus, IconTrash } from "../icons";
import { addInvItem, deleteInvItem, recordReceiving, recordIssuance } from "../actions/inventory";

const money = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const when = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

/**
 * Stock on hand, and the two ways it moves.
 *
 * The running total on an item and the movement that changed it are written
 * together, so the list and its history can never disagree.
 */
export default async function InventoryPanels({ view }: { view: string }) {
  const [items, movements, suppliers] = await Promise.all([
    prisma.invItem.findMany({
      where: { isActive: true },
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      include: { supplier: { select: { name: true } }, _count: { select: { movements: true } } },
    }),
    prisma.inventoryMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { item: { select: { sku: true, name: true, unit: true } } },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const onHand = items.reduce((t, i) => t + i.stock, 0);
  const value = items.reduce((t, i) => t + i.stock * Number(i.unitCost ?? 0), 0);
  const low = items.filter((i) => i.stock <= i.lowStockAt);

  if (view === "asset") {
    return (
      <div className="panel">
        <h2>Asset</h2>
        <p>
          Things the company owns rather than consumes — the ones worth tracking
          by tag and custodian. This page is wired up and role-gated, but has no
          fields yet: say what an asset record should hold (tag, description,
          custodian, acquisition date, cost, condition) and it can be built.
        </p>
      </div>
    );
  }

  if (view === "receiving" || view === "issuance") {
    const isIn = view === "receiving";
    const rows = movements.filter((m) => m.type === (isIn ? "RECEIVING" : "ISSUANCE"));

    return (
      <div className="panel">
        <div className="cat-head">
          <h2>{isIn ? "Receiving" : "Issuance"} <span className="count">{rows.length}</span></h2>
          <span className="spacer" />
          <span className="tree-meta">{isIn ? "Goods received in" : "Goods issued out"}</span>
        </div>

        <form action={isIn ? recordReceiving : recordIssuance} className="billbar">
          <select name="itemId" required defaultValue="" aria-label="Item">
            <option value="" disabled>{items.length ? "Item" : "Add an item on Stock first"}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sku} — {i.name} ({i.stock} {i.unit})
              </option>
            ))}
          </select>
          <input name="quantity" type="number" min="1" step="1" required placeholder="Qty" aria-label="Quantity" />
          <input name="reference" placeholder={isIn ? "PO / DR no." : "Requisition no."} aria-label="Reference" autoComplete="off" />
          {!isIn && <input name="assignedTo" placeholder="Issued to" aria-label="Issued to" autoComplete="off" />}
          <input name="note" placeholder="Note" aria-label="Note" autoComplete="off" />
          <button className="btn-primary" type="submit" disabled={!items.length}
            title={items.length ? undefined : "Add an item on the Stock page first"}>
            <IconPlus /> {isIn ? "Receive" : "Issue"}
          </button>
        </form>

        {rows.length === 0 ? (
          <p style={{ marginTop: 14 }}>Nothing recorded yet.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead><tr>
                <th className="numcol">No.</th><th>When</th><th>Item</th>
                <th className="amt">Qty</th><th>Reference</th>
                {!isIn && <th>Issued to</th>}
                <th>Note</th><th>By</th>
              </tr></thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.id}>
                    <td className="numcol" data-label="No.">{i + 1}</td>
                    <td className="muted nowrap" data-label="When">{when(m.createdAt)}</td>
                    <td data-label="Item"><b className="ticket">{m.item.sku}</b> {m.item.name}</td>
                    <td className="amt" data-label="Qty">{m.quantity} {m.item.unit}</td>
                    <td className="muted" data-label="Reference">{m.reference || "—"}</td>
                    {!isIn && <td data-label="Issued to">{m.assignedTo || "—"}</td>}
                    <td className="muted clip" data-label="Note" title={m.note || undefined}>{m.note || "—"}</td>
                    <td className="muted" data-label="By">{m.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Stock on hand <span className="count">{items.length}</span></h2>
          <span className="spacer" />
          <span className="tree-meta">{onHand.toLocaleString()} units</span>
          {value > 0 && <span className="tree-meta">₱ {money(value)}</span>}
          {low.length > 0 && <span className="pill s-REJECTED">{low.length} low</span>}
        </div>

        <form action={addInvItem} className="billbar">
          <input name="sku" required placeholder="Item code" autoComplete="off" aria-label="Item code" />
          <input name="name" required placeholder="Item name" autoComplete="off" aria-label="Item name" />
          <input name="unit" placeholder="Unit (pc)" autoComplete="off" aria-label="Unit" />
          <input name="lowStockAt" type="number" min="0" step="1" placeholder="Low at" aria-label="Low stock mark" />
          <input name="unitCost" type="number" min="0" step="0.01" placeholder="Unit cost" aria-label="Unit cost" />
          <select name="supplierId" defaultValue="" aria-label="Supplier">
            <option value="">— no supplier —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn-primary" type="submit"><IconPlus /> Add item</button>
        </form>

        {items.length === 0 ? (
          <p style={{ marginTop: 14 }}>Nothing in stock yet — add the first item above.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead><tr>
                <th className="numcol">No.</th><th>Code</th><th>Item</th><th>Supplier</th>
                <th className="amt">On hand</th><th className="amt">Low at</th>
                <th className="amt">Unit cost</th><th className="amt">Value</th><th />
              </tr></thead>
              <tbody>
                {items.map((i, n) => (
                  <tr key={i.id}>
                    <td className="numcol" data-label="No.">{n + 1}</td>
                    <td data-label="Code"><b className="ticket">{i.sku}</b></td>
                    <td data-label="Item">{i.name}</td>
                    <td className="muted" data-label="Supplier">{i.supplier?.name ?? "—"}</td>
                    <td className={i.stock <= i.lowStockAt ? "amt owed" : "amt"} data-label="On hand">
                      {i.stock} {i.unit}
                    </td>
                    <td className="amt muted" data-label="Low at">{i.lowStockAt}</td>
                    <td className="amt muted" data-label="Unit cost">
                      {i.unitCost == null ? "—" : money(Number(i.unitCost))}
                    </td>
                    <td className="amt" data-label="Value">
                      {i.unitCost == null ? "—" : money(i.stock * Number(i.unitCost))}
                    </td>
                    <td className="rowacts">
                      {/* Movements are the record of what happened, so an item
                          that has any cannot be taken away. */}
                      <form action={deleteInvItem.bind(null, i.id)}>
                        <button className="reject icon" type="submit"
                          title={i._count.movements ? `${i._count.movements} movement(s) against it` : "Delete"}
                          aria-label="Delete"><IconTrash /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {movements.length > 0 && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="cat-head">
            <h2>Recent movements <span className="count">{movements.length}</span></h2>
          </div>
          <div className="tablewrap">
            <table className="utable stacked">
              <thead><tr>
                <th>When</th><th>Type</th><th>Item</th><th className="amt">Qty</th>
                <th>Reference</th><th>By</th>
              </tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="muted nowrap" data-label="When">{when(m.createdAt)}</td>
                    <td data-label="Type">
                      <span className={`pill ${m.type === "RECEIVING" ? "s-ACTIVE" : "s-PENDING"}`}>
                        {m.type === "RECEIVING" ? "In" : "Out"}
                      </span>
                    </td>
                    <td data-label="Item"><b className="ticket">{m.item.sku}</b> {m.item.name}</td>
                    <td className="amt" data-label="Qty">{m.quantity} {m.item.unit}</td>
                    <td className="muted" data-label="Reference">{m.reference || "—"}</td>
                    <td className="muted" data-label="By">{m.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
