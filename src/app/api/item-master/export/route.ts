export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/guard";

/** The whole register as a workbook — the same columns the import reads. */
export async function GET() {
  await requireAccess("inventory", "item-master");

  const items = await prisma.invItem.findMany({
    orderBy: { sku: "asc" },
    include: {
      category: { select: { name: true, parent: { select: { name: true } } } },
      supplier: { select: { name: true } },
    },
  });

  const xlsx = await import("xlsx");
  const rows = items.map((i) => ({
    SKU: i.sku,
    "Item Name": i.name,
    Brand: i.brand ?? "",
    Category: i.category ? (i.category.parent ? `${i.category.parent.name} > ${i.category.name}` : i.category.name) : "",
    Type: i.type,
    Unit: i.unit,
    Supplier: i.supplier?.name ?? "",
    "On Hand": i.type === "SERVICE" ? "" : i.stock,
    "Low Stock At": i.lowStockAt,
    "Unit Cost": i.unitCost == null ? "" : Number(i.unitCost),
    Status: i.isActive ? "Active" : "Hidden",
    Description: i.description ?? "",
  }));

  const ws = xlsx.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 16 }, { wch: 34 }, { wch: 16 }, { wch: 26 }, { wch: 9 },
                 { wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
                 { wch: 9 }, { wch: 40 }];
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Item Master");
  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="item-master.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
