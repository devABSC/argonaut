import { prisma } from "@/lib/prisma";
import {
  ROLE_LABEL,
  canApproveRegistrations,
  canManageUser,
  canManageUsers,
  canAssignRole,
  type Actor,
} from "@/lib/rbac";
import { approveRegistration, rejectRegistration, updateUserFromForm, deleteUser } from "../actions/users";
import { requirePasswordChange } from "../actions/changepw";
import { IconCheck, IconX, IconEdit, IconTrash } from "../icons";
import CellSelect from "./CellSelect";

/** Manila time — the server runs UTC. */
const fmtWhen = (d: Date) =>
  d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

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
      id: true, name: true, email: true, status: true,
      role: { select: { key: true } },
      managerId: true, company: true, createdAt: true, updatedAt: true,
      manager: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });

  const pending = users.filter((u) => u.status === "PENDING");
  const canApprove = canApproveRegistrations(me);
  const canEdit = canManageUsers(me);
  // Row numbering is internal bookkeeping — the owner's view only.
  const isOwner = me.role === "SUPER_USER";
  // Assignable roles come from the table so custom ones appear, then are
  // filtered by what this actor is permitted to grant.
  const roleRows = await prisma.role.findMany({
    where: { isActive: true },
    orderBy: [{ rank: "desc" }, { label: "asc" }],
    select: { key: true, label: true },
  });
  const roleLabel = (k: string) => roleRows.find((r) => r.key === k)?.label ?? ROLE_LABEL[k as keyof typeof ROLE_LABEL] ?? k;
  const roleChoices = roleRows.map((r) => r.key).filter((k) => canAssignRole(me, k as never));
  // Anyone at supervisor level or above can be a reporting line.
  const managers = users.filter(
    (u) => u.status === "ACTIVE" && u.role.key !== "EMPLOYEE",
  );

  // Company codes come from the HRIS records, plus anything already assigned.
  const employeeCompanies = await prisma.employee.findMany({
    where: { company: { not: null } },
    distinct: ["company"],
    select: { company: true },
    orderBy: { company: "asc" },
  });
  const companies = [
    ...new Set([
      ...employeeCompanies.map((c) => c.company!),
      ...users.map((u) => u.company).filter((c): c is string => !!c),
    ]),
  ].sort();

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
                      <button className="approve icon" type="submit" title="Approve" aria-label="Approve"><IconCheck /></button>
                    </form>
                    <form action={rejectRegistration.bind(null, p.id)}>
                      <button className="reject icon" type="submit" title="Reject" aria-label="Reject"><IconX /></button>
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
            ? "Company, role and reporting line save the moment you change them. You cannot modify accounts at or above your own level."
            : "You have read-only access to this list."}
        </p>

        <div className="tablewrap">
          <table className="utable">
            <thead>
              <tr>
                {isOwner && <th className="rownum">#</th>}<th>Name</th><th>Email</th><th>Company</th><th>Role</th><th>Reports to</th><th>Status</th>
                <th>Last updated</th><th>Updated by</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const uKey = u.role.key as keyof typeof ROLE_LABEL;
                const editable = canEdit && canManageUser(me, { id: u.id, role: uKey });
                return (
                  <tr key={u.id}>
                    {isOwner && <td className="rownum">{i + 1}</td>}
                    <td>
                      <b>{u.name}</b>
                      {u.id === me.id && <span className="you">you</span>}
                    </td>
                    <td className="muted">{u.email}</td>

{/* One field per cell, each in its own form, so the columns
                        stay aligned with their headings. Linking inputs to a
                        form by id drops their values under server actions. */}
                    <td>
                      {editable ? (
                        <form action={updateUserFromForm}>
                          <input type="hidden" name="userId" value={u.id} />
                          <CellSelect
                            name="company"
                            defaultValue={u.company ?? ""}
                            placeholder="— none —"
                            options={companies.map((c) => ({ value: c, label: c }))}
                          />
                        </form>
                      ) : (
                        <span className="muted">{u.company ?? "—"}</span>
                      )}
                    </td>

                    <td>
                      {editable ? (
                        <form action={updateUserFromForm}>
                          <input type="hidden" name="userId" value={u.id} />
                          <CellSelect
                            name="role"
                            defaultValue={uKey}
                            options={(roleChoices.includes(uKey) ? roleChoices : [uKey, ...roleChoices])
                              .map((r) => ({ value: r, label: roleLabel(r) }))}
                          />
                        </form>
                      ) : (
                        <span className={`pill r-${uKey}`}>{roleLabel(uKey)}</span>
                      )}
                    </td>

                    <td>
                      {editable ? (
                        <form action={updateUserFromForm}>
                          <input type="hidden" name="userId" value={u.id} />
                          <CellSelect
                            name="managerId"
                            defaultValue={u.managerId ?? ""}
                            placeholder="— nobody —"
                            options={managers.filter((m) => m.id !== u.id)
                              .map((m) => ({ value: m.id, label: m.name }))}
                          />
                        </form>
                      ) : (
                        <span className="muted">{u.manager?.name ?? "—"}</span>
                      )}
                    </td>

                    <td><span className={`pill s-${u.status}`}>{STATUS_LABEL[u.status]}</span></td>

                    <td className="muted nowrap">{fmtWhen(u.updatedAt)}</td>
                    <td className="muted">{u.updatedBy?.name ?? "—"}</td>
                    {canEdit && (
                      <td className="rowacts">
                        {editable && (
                          <form action={requirePasswordChange.bind(null, u.id)}>
                            <button
                              className="reject icon" type="submit"
                              title="Require a password change at next sign-in"
                              aria-label="Require password change"
                            ><IconEdit /></button>
                          </form>
                        )}
                        {/* Hard delete is the owner's alone, and never on
                            themselves. Accounts with service-desk history are
                            refused server-side. */}
                        {isOwner && u.id !== me.id && (
                          <form action={deleteUser.bind(null, u.id)}>
                            <button
                              className="reject icon" type="submit"
                              title={`Delete ${u.name} permanently`}
                              aria-label="Delete account"
                            ><IconTrash /></button>
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
