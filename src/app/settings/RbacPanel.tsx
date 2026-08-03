import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessTree, allNodes, defaultAllows, effectiveAccess } from "@/lib/access";
import { ROLE_LABEL } from "@/lib/rbac";
import { saveRoleMatrix, saveUserOverrides, clearUserOverrides, resetToDefaults } from "../actions/rbac";
import { IconTrash } from "../icons";
import RbacMatrix, { type MatrixGroup } from "./RbacMatrix";
import UserPicker from "./UserPicker";

const ROLES: Role[] = ["SUPER_USER", "ADMINISTRATOR", "HR_SUPERVISOR", "SUPERVISOR", "EMPLOYEE"];

export default async function RbacPanel({ userId }: { userId?: string }) {
  const tree = accessTree();
  const nodes = allNodes();

  const roleGrants = await prisma.menuGrant.findMany({ where: { role: { not: null } } });
  const byRole = new Map(roleGrants.map((g) => [`${g.role}|${g.nodeKey}`, g.allowed]));

  const initial: Record<string, boolean> = {};
  for (const role of ROLES) {
    for (const n of nodes) {
      initial[`${role}|${n.key}`] =
        byRole.get(`${role}|${n.key}`) ?? defaultAllows(role, n.key);
    }
  }

  const groups: MatrixGroup[] = tree.map((g) => ({
    moduleKey: g.section.key,
    moduleLabel: g.section.label,
    nodes: g.nodes.map((n) => ({
      key: n.key,
      label: n.tabSlug ? n.label : `${n.label} (module)`,
      moduleKey: g.section.key,
      isModule: !n.tabSlug,
    })),
  }));

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  const target = userId ? users.find((u) => u.id === userId) : undefined;
  const targetAccess = target ? await effectiveAccess(target) : null;
  const overrideCount = target
    ? await prisma.menuGrant.count({ where: { userId: target.id } })
    : 0;

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Access by role</h2>
          <span className="spacer" />
          <form action={resetToDefaults}>
            <button className="reject icon" type="submit" title="Reset to defaults" aria-label="Reset to defaults">
              <IconTrash />
            </button>
          </form>
        </div>
        <p>
          Tick what each role may open. A module opens or closes its pages with
          it. Only differences from the built-in defaults are stored, and the
          menu is enforced on the server — hiding an entry is never the only
          thing stopping someone reaching a page.
        </p>

        <form action={saveRoleMatrix}>
          <RbacMatrix groups={groups} roles={ROLES} initial={initial} />
        </form>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Access for one person</h2>
        <p>
          Overrides for a single user, on top of whatever their role already
          allows. Use this for exceptions rather than bending a whole role.
        </p>
        <UserPicker
          users={users.map((u) => ({ id: u.id, label: `${u.name} — ${u.email} (${ROLE_LABEL[u.role]})` }))}
          selected={target?.id ?? ""}
        />

        {target && targetAccess && (
          <form action={saveUserOverrides.bind(null, target.id)} style={{ marginTop: 18 }}>
            <div className="cat-head">
              <h2 style={{ fontSize: "1.02rem" }}>{target.name}</h2>
              <span className={`pill r-${target.role}`}>{ROLE_LABEL[target.role]}</span>
              {overrideCount > 0
                ? <span className="pill s-PENDING">{overrideCount} override{overrideCount === 1 ? "" : "s"}</span>
                : <span className="tree-meta">following role access</span>}
            </div>

            <div className="grantgrid">
              {tree.map((g) => (
                <div className="grantcard" key={g.section.key}>
                  <b>{g.section.label}</b>
                  {g.nodes.map((n) => (
                    <label className="tickrow" key={n.key}>
                      <input type="checkbox" name={`u|${n.key}`} defaultChecked={targetAccess.get(n.key) === true} />
                      <span>{n.tabSlug ? n.label : "— whole module —"}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <div className="rowacts" style={{ marginTop: 16 }}>
              <button className="btn-primary" type="submit">Save overrides for {target.name}</button>
              <button
                className="reject icon" type="submit" title="Clear overrides" aria-label="Clear overrides"
                formAction={clearUserOverrides.bind(null, target.id)}
              >
                <IconTrash />
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
