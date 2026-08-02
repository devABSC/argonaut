import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visibleNav } from "@/lib/nav";
import { ROLE_LABEL, canApproveRegistrations } from "@/lib/rbac";
import AppShell from "../../AppShell";
import { approveRegistration, rejectRegistration } from "../../actions/users";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canApproveRegistrations(user)) notFound();

  const pending = await prisma.user.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return (
    <AppShell
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      nav={visibleNav(user.role)}
      activeSection=""
      activeTab=""
    >
      <div className="panel">
        <h2>Pending registrations</h2>
        <p>
          Self-registered accounts stay locked out until approved here. Approving
          activates the account as an Employee.
        </p>

        {pending.length === 0 ? (
          <p style={{ marginTop: 18 }}>Nothing waiting for review.</p>
        ) : (
          <ul className="queue">
            {pending.map((p) => (
              <li key={p.id}>
                <div className="queue-who">
                  <b>{p.name}</b>
                  <span>{p.email}</span>
                </div>
                <div className="queue-act">
                  <form action={approveRegistration.bind(null, p.id)}>
                    <button className="approve" type="submit">Approve</button>
                  </form>
                  <form action={rejectRegistration.bind(null, p.id)}>
                    <button className="reject" type="submit">Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
