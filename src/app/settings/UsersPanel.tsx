import { prisma } from "@/lib/prisma";
import {
  ROLE_LABEL,
  canApproveRegistrations,
  canManageUser,
  canManageUsers,
  assignableRoles,
  type Actor,
} from "@/lib/rbac";
import { approveRegistration, rejectRegistration, updateUserFromForm } from "../actions/users";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PENDING: "Pending approval",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export default async function UsersPanel({ me }: { me: Actor }) {
  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, role: true, status: true,
      managerId: true, createdAt: true,
      manager: { select: { name: true } },
    },
  });

  const pending = users.filter((u) => u.status === "PENDING");
  const canApprove = canApproveRegistrations(me);
  const canEdit = canManageUsers(me);
  const roleChoices = assignableRoles(me);
  // Anyone at supervisor level or above can be a reporting line.
  const managers = users.filter(
    (u) => u.status === "ACTIVE" && u.role !== "EMPLOYEE",
  );

  return (
    <>
      {canApprove && (
        <div className="panel">
          <h2>Pending registrations</h2>
          <p>
            Self-registered accounts cannot sign in until approved. Approving
            activates the account as an Employee — set their role below afterwards.
          </p>

          {pending.length === 0 ? (
            <p style={{ marginTop: 16 }}>Nothing waiting for review.</p>
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
      )}

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>All users <span className="count">{users.length}</span></h2>
        <p>
          {canEdit
            ? "Change a role or reporting line, then Save that row. You cannot modify accounts at or above your own level."
            : "You have read-only access to this list."}
        </p>

        <div className="tablewrap">
          <table className="utable">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Reports to</th><th>Status</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const editable = canEdit && canManageUser(me, u);
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                      {u.id === me.id && <span className="you">you</span>}
                    </td>
                    <td className="muted">{u.email}</td>

                    {editable ? (
                      <>
                        <td>
                          <select name="role" form={`f-${u.id}`} defaultValue={u.role}>
                            {/* The current role is always listed, even if this
                                actor could not otherwise assign it. */}
                            {(roleChoices.includes(u.role) ? roleChoices : [u.role, ...roleChoices])
                              .map((r) => (
                                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                              ))}
                          </select>
                        </td>
                        <td>
                          <select name="managerId" form={`f-${u.id}`} defaultValue={u.managerId ?? ""}>
                            <option value="">— none —</option>
                            {managers.filter((m) => m.id !== u.id).map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><span className={`pill r-${u.role}`}>{ROLE_LABEL[u.role]}</span></td>
                        <td className="muted">{u.manager?.name ?? "—"}</td>
                      </>
                    )}

                    <td><span className={`pill s-${u.status}`}>{STATUS_LABEL[u.status]}</span></td>

                    {canEdit && (
                      <td>
                        {editable && (
                          <form id={`f-${u.id}`} action={updateUserFromForm}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button className="save" type="submit">Save</button>
                          </form>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
