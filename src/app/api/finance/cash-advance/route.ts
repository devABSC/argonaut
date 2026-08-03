import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/guard";

/** Manila time — the server runs UTC. */
const fmtDate = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

const money = (n: number | null) => (n == null ? "" : n.toFixed(2));

/** Quotes every field — purposes and remarks routinely contain commas. */
const cell = (v: string | number | null) =>
  `"${String(v ?? "").replace(/"/g, '""')}"`;

function amountOf(details: unknown): number | null {
  const raw = (details as Record<string, unknown> | null)?.amount;
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const textOf = (details: unknown, key: string) => {
  const v = (details as Record<string, unknown> | null)?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** The Cash Advance list as a spreadsheet. Gated like the page it comes from. */
export async function GET() {
  await requireAccess("finance", "cash-advance");

  const rows = await prisma.serviceRequest.findMany({
    where: { subcategory: { name: { contains: "Cash Advance", mode: "insensitive" } } },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: {
      reference: true, subject: true, status: true, details: true,
      submittedAt: true, createdAt: true,
      requester: { select: { name: true, email: true } },
    },
  });

  const header = ["No.", "Date requested", "Requested by", "Email", "Purpose", "Amount", "Status", "Ticket"];
  const lines = [header.map(cell).join(",")];

  let total = 0;
  rows.forEach((r, i) => {
    const amt = amountOf(r.details);
    if (amt != null) total += amt;
    lines.push([
      i + 1,
      fmtDate(r.submittedAt ?? r.createdAt),
      r.requester.name,
      r.requester.email,
      textOf(r.details, "purpose") ?? r.subject,
      money(amt),
      r.status,
      r.reference,
    ].map(cell).join(","));
  });
  lines.push(["", "", "", "", "TOTAL", money(total), "", ""].map(cell).join(","));

  const stamp = fmtDate(new Date()).replace(/[^\d]/g, "").slice(0, 12);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      // BOM so Excel opens it as UTF-8 rather than mangling the peso sign.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cash-advance-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
