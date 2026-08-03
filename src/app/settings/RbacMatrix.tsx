"use client";

import { useMemo, useState } from "react";
import { IconSave } from "../icons";

export type MatrixNode = { key: string; label: string; moduleKey: string; isModule: boolean };
export type MatrixGroup = { moduleKey: string; moduleLabel: string; nodes: MatrixNode[] };

const ROLE_LABEL: Record<string, string> = {
  SUPER_USER: "Super User",
  ADMINISTRATOR: "Administrator",
  HR_SUPERVISOR: "HR Supervisor",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Employee",
};

/**
 * Roles across the top, modules and their submenus down the side. Ticking a
 * module opens its submenus; unticking it shuts the whole branch, so it is not
 * possible to leave a role a menu entry that leads nowhere.
 */
export default function RbacMatrix({
  groups,
  roles,
  initial,
}: {
  groups: MatrixGroup[];
  roles: string[];
  /** "ROLE|nodeKey" -> allowed */
  initial: Record<string, boolean>;
}) {
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [dirty, setDirty] = useState(false);

  const at = (role: string, key: string) => state[`${role}|${key}`] ?? false;

  function set(next: Record<string, boolean>) {
    setState(next);
    setDirty(true);
  }

  function toggle(role: string, node: MatrixNode, group: MatrixGroup) {
    const next = { ...state };
    const key = `${role}|${node.key}`;
    const value = !at(role, node.key);
    next[key] = value;

    if (node.isModule) {
      // Opening a module opens its pages; closing it closes them all.
      for (const n of group.nodes) if (!n.isModule) next[`${role}|${n.key}`] = value;
    } else if (value) {
      // Granting a page implies the module that contains it.
      next[`${role}|${group.moduleKey}`] = true;
    } else {
      const anyLeft = group.nodes.some((n) => !n.isModule && next[`${role}|${n.key}`]);
      if (!anyLeft) next[`${role}|${group.moduleKey}`] = false;
    }
    set(next);
  }

  function setColumn(role: string, value: boolean) {
    const next = { ...state };
    for (const g of groups) for (const n of g.nodes) next[`${role}|${n.key}`] = value;
    set(next);
  }

  // What each role would actually see in the sidebar, given the current ticks.
  const preview = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const role of roles) {
      out[role] = groups
        .filter((g) => at(role, g.moduleKey) && g.nodes.some((n) => !n.isModule && at(role, n.key)))
        .map((g) => g.moduleLabel);
    }
    return out;
  }, [state, groups, roles]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="tablewrap">
        <table className="utable matrix">
          <thead>
            <tr>
              <th>Module / Page</th>
              {roles.map((r) => (
                <th key={r} className="rolecol">
                  <span>{ROLE_LABEL[r] ?? r}</span>
                  <span className="bulk">
                    <button type="button" onClick={() => setColumn(r, true)} title={`Grant everything to ${ROLE_LABEL[r]}`}>all</button>
                    <button type="button" onClick={() => setColumn(r, false)} title={`Revoke everything from ${ROLE_LABEL[r]}`}>none</button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) =>
              g.nodes.map((n) => (
                <tr key={n.key} className={n.isModule ? "modrow" : undefined}>
                  <td className={n.isModule ? "modname" : "subname"}>{n.label}</td>
                  {roles.map((r) => (
                    <td key={r} className="cell">
                      <label className="tick">
                        <input
                          type="checkbox"
                          name={`m|${r}|${n.key}`}
                          checked={at(r, n.key)}
                          onChange={() => toggle(r, n, g)}
                        />
                        <span aria-hidden="true" />
                      </label>
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <div className="previewbar">
        {roles.map((r) => (
          <div className="prevcard" key={r}>
            <span className="prevrole">{ROLE_LABEL[r] ?? r}</span>
            <span className="prevmenus">
              {preview[r].length ? preview[r].join(" · ") : "no menus at all"}
            </span>
          </div>
        ))}
      </div>

      <button className="btn-primary" type="submit">
        <IconSave /> {dirty ? "Save access matrix" : "Saved"}
      </button>
    </>
  );
}
