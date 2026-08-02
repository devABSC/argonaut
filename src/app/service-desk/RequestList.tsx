type Row = {
  id: string;
  reference: string;
  subject: string;
  status: string;
  createdAt: Date;
  currentSequence: number;
  requester?: { name: string };
  subcategory: { name: string; category: { name: string } };
  approvals: { sequence: number; decision: string; approver: { name: string } }[];
};

const STATUS_PILL: Record<string, string> = {
  DRAFT: "s-PENDING",
  SUBMITTED: "s-PENDING",
  IN_REVIEW: "s-PENDING",
  APPROVED: "s-ACTIVE",
  REJECTED: "s-REJECTED",
  CANCELLED: "s-SUSPENDED",
};

export default function RequestList({
  title,
  rows,
  emptyText,
  showRequester = false,
}: {
  title: string;
  rows: Row[];
  emptyText: string;
  showRequester?: boolean;
}) {
  return (
    <div className="panel">
      <h2>{title} <span className="count">{rows.length}</span></h2>

      {rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>{emptyText}</p>
      ) : (
        <div className="tablewrap">
          <table className="utable">
            <thead>
              <tr>
                <th>Ticket ID</th>
                {showRequester && <th>Requester</th>}
                <th>Subject</th><th>Service</th><th>Status</th><th>With</th><th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const waiting = r.approvals.find((a) => a.decision === "PENDING");
                return (
                  <tr key={r.id}>
                    <td><code className="ticket">{r.reference}</code></td>
                    {showRequester && <td className="muted">{r.requester?.name ?? "—"}</td>}
                    <td><b>{r.subject}</b></td>
                    <td className="muted">{r.subcategory.category.name} › {r.subcategory.name}</td>
                    <td><span className={`pill ${STATUS_PILL[r.status] ?? "s-PENDING"}`}>{r.status}</span></td>
                    <td className="muted">{waiting ? waiting.approver.name : "—"}</td>
                    <td className="muted">{r.createdAt.toISOString().slice(0, 10)}</td>
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
