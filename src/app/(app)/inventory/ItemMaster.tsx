import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { IconPlus, IconTrash, IconEdit, IconX, IconSave, IconUpload, IconDownload } from "@/app/icons";
import {
  addInvItem, editInvItem, deleteInvItem,
  addItemCategory, deleteItemCategory, importInvItems,
} from "@/app/actions/inventory";

const money = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Item Master — the registry every item is defined in, ported from benta.
 *
 * Stock figures are read-only here: they are the sum of what Receiving and
 * Issuance recorded, and master data must never be a second way to change them.
 */
export default async function ItemMaster({
  q = "", cat = "", type = "", status = "", edit = "", isOwner,
}: {
  q?: string; cat?: string; type?: string; status?: string; edit?: string; isOwner: boolean;
}) {
  const term = q.trim();
  const where: Prisma.InvItemWhereInput = {
    ...(term
      ? {
          OR: [
            { sku: { contains: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } },
            { brand: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(cat ? { categoryId: cat } : {}),
    ...(type === "GOODS" || type === "SERVICE" ? { type } : {}),
    ...(status === "inactive" ? { isActive: false } : status === "active" ? { isActive: true } : {}),
  };

  const [items, categories, suppliers, total] = await Promise.all([
    prisma.invItem.findMany({
      where,
      orderBy: [{ sku: "asc" }],
      include: {
        category: { select: { name: true, parent: { select: { name: true } } } },
        supplier: { select: { name: true } },
        _count: { select: { movements: true } },
      },
    }),
    prisma.itemCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { parent: { select: { name: true } }, _count: { select: { items: true, children: true } } },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.invItem.count(),
  ]);

  const editing = items.find((i) => i.id === edit) ?? null;
  const parents = categories.filter((c) => !c.parentId);
  const qs = new URLSearchParams({ q: term, cat, type, status });
  for (const [k, v] of [...qs.entries()]) if (!v) qs.delete(k);
  const base = qs.toString() ? `/inventory/item-master?${qs}` : "/inventory/item-master";

  const path = (c: (typeof categories)[number]) =>
    c.parent ? `${c.parent.name} › ${c.name}` : c.name;

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Item Master <span className="count">{items.length}</span></h2>
          {items.length !== total && <span className="tree-meta">of {total}</span>}
          <span className="spacer" />
          <a className="viewtoggle" href="/api/item-master/export" download
            title="Every item as a workbook"><IconDownload /> Export</a>
          <form action={importInvItems} className="soaimport">
            <label className="ghost icon" title="Import items from a spreadsheet">
              <IconUpload />
              <input type="file" name="sheet" accept=".xlsx,.xls,.csv" aria-label="Spreadsheet to import" />
            </label>
            <button className="save icon" type="submit" title="Import the chosen sheet"
              aria-label="Import the chosen sheet"><IconSave /></button>
          </form>
        </div>

        <form className="empsearch" action="/inventory/item-master" method="get">
          <input name="q" defaultValue={term} placeholder="Search code, name, brand" />
          <select name="cat" defaultValue={cat} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{path(c)}</option>)}
          </select>
          <select name="type" defaultValue={type} aria-label="Type">
            <option value="">Goods and services</option>
            <option value="GOODS">Goods</option>
            <option value="SERVICE">Service</option>
          </select>
          <select name="status" defaultValue={status} aria-label="Status">
            <option value="">Active and hidden</option>
            <option value="active">Active</option>
            <option value="inactive">Hidden</option>
          </select>
          <button type="submit">Search</button>
          {(term || cat || type || status) && <a className="clear" href="/inventory/item-master">Clear</a>}
        </form>

        {/* Add, or correct the one being edited — the same fields either way. */}
        <form action={editing ? editInvItem.bind(null, editing.id) : addInvItem} className="coaform"
          key={editing?.id ?? "new"}>
          <label className="statfield">
            <span>Item Code</span>
            <input name="sku" required autoComplete="off" defaultValue={editing?.sku ?? ""} placeholder="e.g. OFF-A4-80" />
          </label>
          <label className="statfield">
            <span>Item Name</span>
            <input name="name" required autoComplete="off" defaultValue={editing?.name ?? ""} />
          </label>
          <label className="statfield">
            <span>Brand</span>
            <input name="brand" autoComplete="off" defaultValue={editing?.brand ?? ""} />
          </label>
          <label className="statfield">
            <span>Category</span>
            <select name="categoryId" defaultValue={editing?.categoryId ?? ""}>
              <option value="">— none —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{path(c)}</option>)}
            </select>
          </label>
          <label className="statfield">
            <span>Type</span>
            <select name="type" defaultValue={editing?.type ?? "GOODS"}>
              <option value="GOODS">Goods</option>
              <option value="SERVICE">Service</option>
            </select>
          </label>
          <label className="statfield">
            <span>Unit</span>
            <input name="unit" autoComplete="off" defaultValue={editing?.unit ?? "pc"} placeholder="pc" />
          </label>
          <label className="statfield">
            <span>Supplier</span>
            <select name="supplierId" defaultValue={editing?.supplierId ?? ""}>
              <option value="">— none —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="statfield">
            <span>Low stock at</span>
            <input name="lowStockAt" type="number" min="0" step="1" defaultValue={editing?.lowStockAt ?? 5} />
          </label>
          <label className="statfield">
            <span>Unit cost</span>
            <input name="unitCost" type="number" min="0" step="0.01"
              defaultValue={editing?.unitCost == null ? "" : String(editing.unitCost)} />
          </label>
          {editing && (
            <label className="statfield">
              <span>Status</span>
              <select name="isActive" defaultValue={editing.isActive ? "1" : "0"}>
                <option value="1">Active</option>
                <option value="0">Hidden</option>
              </select>
            </label>
          )}
          <label className="statfield full">
            <span>Description</span>
            <input name="description" autoComplete="off" defaultValue={editing?.description ?? ""} />
          </label>
          <div className="statacts">
            <button className="btn-primary" type="submit">
              <IconPlus /> {editing ? `Save ${editing.sku}` : "Add item"}
            </button>
            {editing && <a className="subtab" href={base}>Cancel</a>}
          </div>
        </form>

        {items.length === 0 ? (
          <p style={{ marginTop: 14 }}>
            {term || cat || type || status ? "Nothing matches that." : "No items yet — add the first one above."}
          </p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead><tr>
                <th className="numcol">No.</th><th>Code</th><th>Item</th><th>Category</th>
                <th>Type</th><th>Supplier</th><th className="amt">On hand</th>
                <th className="amt">Unit cost</th><th>Status</th><th />
              </tr></thead>
              <tbody>
                {items.map((i, n) => (
                  <tr key={i.id} className={i.id === edit ? "iscurrent" : undefined}>
                    <td className="numcol" data-label="No.">{n + 1}</td>
                    <td data-label="Code"><b className="ticket">{i.sku}</b></td>
                    <td data-label="Item">
                      {i.name}
                      {i.brand && <span className="tree-meta"> · {i.brand}</span>}
                    </td>
                    <td className="muted" data-label="Category">
                      {i.category ? (i.category.parent ? `${i.category.parent.name} › ${i.category.name}` : i.category.name) : "—"}
                    </td>
                    <td className="muted" data-label="Type">{i.type === "SERVICE" ? "Service" : "Goods"}</td>
                    <td className="muted" data-label="Supplier">{i.supplier?.name ?? "—"}</td>
                    <td className={i.type === "SERVICE" ? "amt muted" : i.stock <= i.lowStockAt ? "amt owed" : "amt"}
                      data-label="On hand">
                      {i.type === "SERVICE" ? "—" : `${i.stock} ${i.unit}`}
                    </td>
                    <td className="amt muted" data-label="Unit cost">
                      {i.unitCost == null ? "—" : money(Number(i.unitCost))}
                    </td>
                    <td data-label="Status">
                      <span className={`pill ${i.isActive ? "s-ACTIVE" : "s-SUSPENDED"}`}>
                        {i.isActive ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td className="rowacts">
                      {i.id === edit ? (
                        <a className="ghost icon" href={base} title="Cancel" aria-label="Cancel"><IconX /></a>
                      ) : (
                        <a className="ghost icon" href={`${base}${base.includes("?") ? "&" : "?"}edit=${i.id}`}
                          title="Edit this item" aria-label="Edit this item"><IconEdit /></a>
                      )}
                      {/* Owner only, as in benta — a permanent delete of master
                          data is not something an admin should reach for. */}
                      {isOwner && (
                        <form action={deleteInvItem.bind(null, i.id)}>
                          <button className="reject icon" type="submit"
                            title={i._count.movements ? `${i._count.movements} movement(s) against it` : "Delete permanently"}
                            aria-label="Delete permanently"><IconTrash /></button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="cat-head">
          <h2>Categories <span className="count">{categories.length}</span></h2>
          <span className="spacer" />
          <span className="tree-meta">a subcategory is a category with a parent</span>
        </div>

        <form action={addItemCategory} className="billbar">
          <input name="name" required placeholder="Category name" autoComplete="off" aria-label="Category name" />
          <select name="parentId" defaultValue="" aria-label="Parent category">
            <option value="">— top level —</option>
            {parents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-primary" type="submit"><IconPlus /> Add category</button>
        </form>

        {categories.length === 0 ? (
          <p style={{ marginTop: 14 }}>None yet.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead><tr>
                <th className="numcol">No.</th><th>Category</th><th>Under</th>
                <th className="amt">Items</th><th />
              </tr></thead>
              <tbody>
                {categories.map((c, n) => (
                  <tr key={c.id}>
                    <td className="numcol" data-label="No.">{n + 1}</td>
                    <td data-label="Category">
                      {c.parentId && <span className="tree-meta">↳ </span>}{c.name}
                    </td>
                    <td className="muted" data-label="Under">{c.parent?.name ?? "—"}</td>
                    <td className="amt muted" data-label="Items">{c._count.items}</td>
                    <td className="rowacts">
                      <form action={deleteItemCategory.bind(null, c.id)}>
                        <button className="reject icon" type="submit"
                          title={c._count.items || c._count.children ? "In use" : "Delete"}
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
    </>
  );
}
