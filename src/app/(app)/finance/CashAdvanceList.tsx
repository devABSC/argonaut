import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { IconDownload } from "@/app/icons";

const STATUS_PILL: Record<string, string> = {
  DRAFT: "s-PENDING",
  SUBMITTED: "s-PENDING",
  IN_REVIEW: "s-PENDING",
  APPROVED: "s-ACTIVE",
  REJECTED: "s-REJECTED",
  CANCELLED: "s-SUSPENDED",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

/** Manila time — the server runs UTC. */
const fmtDate = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

const peso = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Amounts arrive as form text, so anything unparseable is left out of the total. */
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

/**
 * Every cash advance raised through Service Desk. Finance reads it here; the
 * request itself still lives on its ticket, so the status shown is the ticket's
 * own — this view never becomes a second source of truth.
 */
export default async function CashAdvanceList() {
  const rows = await prisma.serviceRequest.findMany({
    where: { subcategory: { name: { contains: "Cash Advance", mode: "insensitive" } } },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, reference: true, subject: true, status: true,
      details: true, submittedAt: true, createdAt: true,
      requester: { select: { name: true } },
    },
  });

  const open = rows.filter((r) => ["SUBMITTED", "IN_REVIEW", "DRAFT"].includes(r.status));
  const approved = rows.filter((r) => r.status === "APPROVED");
  const total = (set: typeof rows) =>
    set.reduce((sum, r) => sum + (amountOf(r.details) ?? 0), 0);

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Cash Advance <span className="count">{rows.length}</span></h2>
        <span className="spacer" />
        <span className="tree-meta">
          ₱{peso.format(total(approved))} approved · ₱{peso.format(total(open))} awaiting
        </span>
        <a
          className="save icon"
          href="/api/finance/cash-advance"
          title="Download as CSV"
          aria-label="Download as CSV"
        >
          <IconDownload />
        </a>
      </div>
      <p>
        Every cash advance raised through Service Desk. Status is the ticket&rsquo;s
        own — approve or reject on the ticket itself, not here.
      </p>

      {rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>No cash advance has been requested yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="utable stacked">
            <thead>
              <tr>
                <th className="numcol">No.</th>
                <th>Date requested</th>
                <th>Requested by</th>
                <th>Purpose</th>
                <th className="amtcol">Amount</th>
                <th>Status</th>
                <th>Ticket</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const amt = amountOf(r.details);
                const purpose = textOf(r.details, "purpose") ?? r.subject;
                return (
                  <tr key={r.id}>
                    <td className="numcol" data-label="No.">{i + 1}</td>
                    <td className="muted nowrap" data-label="Date requested">{fmtDate(r.submittedAt ?? r.createdAt)}</td>
                    <td data-label="Requested by"><b>{r.requester.name}</b></td>
                    <td data-label="Purpose">{purpose}</td>
                    <td className="amtcol" data-label="Amount">{amt == null ? "—" : `₱${peso.format(amt)}`}</td>
                    <td data-label="Status">
                      <span className={`pill ${STATUS_PILL[r.status] ?? "s-PENDING"}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td data-label="Ticket">
                      <Link className="ticket" href={`/service-desk/ticket/${encodeURIComponent(r.reference)}`}>
                        {r.reference}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
