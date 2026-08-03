import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/guard";
import { AGENCIES, AGENCY_SLUG, isAgency, type Agency } from "@/lib/agencies";

/**
 * The remittance roster for one agency, as a workbook.
 *
 * Argonaut cannot post to any of the three, so what it can do is hand over the
 * member list already keyed on the right identifier, with the amount columns
 * left for whoever knows the compensation. Only employees who actually have
 * that agency's number are included — a blank number on a remittance file is a
 * rejected row.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ agency: string }> }) {
  const { agency } = await ctx.params;
  const key = agency.toUpperCase();
  if (!isAgency(key)) return new Response("Not found", { status: 404 });

  const profile = AGENCIES[key as Agency];
  await requireAccess("admin", AGENCY_SLUG[key as Agency]);

  const period = req.nextUrl.searchParams.get("period") ?? "";
  const link = await prisma.agencyLink.findUnique({ where: { agency: key } });

  const staff = await prisma.employee.findMany({
    where: { status: 0, [profile.idField]: { not: null } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      individ: true, lastName: true, firstName: true, middleName: true,
      sssId: true, philId: true, pagibigId: true, tinId: true,
      bou: { select: { name: true } },
    },
  });

  const xlsx = await import("xlsx");
  const rows = staff.map((e) => ({
    "Employee No.": e.individ,
    "Last Name": e.lastName,
    "First Name": e.firstName,
    "Middle Name": e.middleName ?? "",
    [profile.idLabel]: (e[profile.idField] as string | null) ?? "",
    TIN: e.tinId ?? "",
    BOU: e.bou?.name ?? "",
    // Left blank on purpose: argonaut holds no monthly compensation yet, and a
    // guessed figure on a statutory file is worse than an empty column.
    "Monthly Compensation": "",
    "Employee Share": "",
    "Employer Share": "",
    Total: "",
  }));

  const head = [
    [`${profile.full} — remittance roster`],
    [`Employer: ${link?.registeredName ?? ""}`, `Employer No.: ${link?.employerNumber ?? ""}`],
    [`Period: ${period || "(not given)"}`, `Members: ${rows.length}`],
    ["Prepared by argonaut. Check against the agency's current template before filing."],
    [],
  ];

  const ws = xlsx.utils.aoa_to_sheet(head);
  xlsx.utils.sheet_add_json(ws, rows, { origin: -1 });
  ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
                 { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, profile.name.slice(0, 28));
  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${profile.name.replace(/\W+/g, "-")}-roster${period ? `-${period}` : ""}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
