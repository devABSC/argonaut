import { prisma } from "@/lib/prisma";
import { saveRole, createRole, deleteRole } from "../actions/roles";
import { IconSave, IconTrash, IconPlus } from "../icons";

/**
 * Manages what the owner can safely change about a role. The Role enum itself
 * is the security primitive and lives in the schema, so a role holding users —
 * or any built-in role — is retired rather than removed.
 */
export default async function RolesPanel() {
  const profiles = await prisma.role.findMany({ orderBy: { rank: "desc" } });

  const counts = await prisma.user.groupBy({ by: ["roleId"], _count: true });
  const byId = new Map(counts.map((c) => [c.roleId, c._count]));
  const holders = new Map(profiles.map((r) => [r.key, byId.get(r.id) ?? 0]));

  return (
    <div className="panel">
      <h2>Roles <span className="count">{profiles.length}</span></h2>
      <p>
        Rename a role, describe it, set where it ranks, or stop it being
        assigned. A role that still has users cannot be removed — reassign them
        first. Built-in roles are retired rather than deleted, because the
        permission checks are built on them.
      </p>

      <div className="fields">
        <div className="frow rrow rhead">
          <span>Key</span><span>Name</span><span>Description</span>
          <span>Rank</span><span>Users</span><span>Assignable</span><span />
        </div>

        {profiles.map((r) => {
          const used = holders.get(r.key) ?? 0;
          return (
            <form className="frow rrow" action={saveRole} key={r.key}>
              <input type="hidden" name="key" value={r.key} />
              <code className="rkey">{r.key}</code>
              <input name="label" defaultValue={r.label} required />
              <input name="description" defaultValue={r.description ?? ""} placeholder="What this role is for" />
              <input name="rank" type="number" min="0" defaultValue={r.rank} />
              <span className={used > 0 ? "pill s-ACTIVE" : "tree-meta"}>
                {used > 0 ? `${used} user${used === 1 ? "" : "s"}` : "none"}
              </span>
              <label className="req">
                <input type="checkbox" name="isActive" defaultChecked={r.isActive} />
                Assignable
              </label>
              <span className="rowacts">
                <button className="save icon" type="submit" title="Save" aria-label="Save"><IconSave /></button>
                <button
                  className="reject icon"
                  type="submit"
                  title={used > 0 ? `Cannot remove — ${used} user${used === 1 ? "" : "s"} hold this role` : "Retire this role"}
                  aria-label="Retire role"
                  disabled={used > 0}
                  formAction={deleteRole.bind(null, r.key)}
                ><IconTrash /></button>
              </span>
            </form>
          );
        })}

        <form className="frow rrow fadd" action={createRole}>
          <span className="rkey">auto</span>
          <input name="label" placeholder="New role name" required />
          <input name="description" placeholder="What this role is for" />
          <input name="rank" type="number" min="0" defaultValue={1} />
          <span /><span />
          <span className="rowacts">
            <button className="save icon" type="submit" title="Add role" aria-label="Add role"><IconPlus /></button>
          </span>
        </form>
      </div>
    </div>
  );
}
