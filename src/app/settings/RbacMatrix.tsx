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
 * Roles across the top, modules down the side as a collapsible tree. Modules
 * stay visible and their pages fold away, so the list keeps its shape as more
 * modules are added. Ticking a module opens its pages; unticking shuts the
 * branch, so a role can never be left a menu entry that leads nowhere.
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
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const at = (role: string, key: string) => state[`${role}|${key}`] ?? false;
  const isOpen = (k: string) => open[k] ?? false;

  function toggle(role: string, node: MatrixNode, group: MatrixGroup) {
    const next = { ...state };
    const value = !at(role, node.key);
    next[`${role}|${node.key}`] = value;

    if (node.isModule) {
      for (const n of group.nodes) if (!n.isModule) next[`${role}|${n.key}`] = value;
    } else if (value) {
      next[`${role}|${group.moduleKey}`] = true;
    } else if (!group.nodes.some((n) => !n.isModule && next[`${role}|${n.key}`])) {
      next[`${role}|${group.moduleKey}`] = false;
    }
    setState(next);
  }

  function setColumn(role: string, value: boolean) {
    const next = { ...state };
    for (const g of groups) for (const n of g.nodes) next[`${role}|${n.key}`] = value;
    setState(next);
  }

  const allOpen = groups.every((g) => isOpen(g.moduleKey));
  const setAll = (v: boolean) =>
    setOpen(Object.fromEntries(groups.map((g) => [g.moduleKey, v])));

  /** How many pages each role can reach in a module — shown on the collapsed row. */
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const g of groups) {
      for (const r of roles) {
        out[`${r}|${g.moduleKey}`] = g.nodes.filter((n) => !n.isModule && at(r, n.key)).length;
      }
    }
    return out;
  }, [state, groups, roles]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const role of roles) {
      out[role] = groups
        .filter((g) => at(role, g.moduleKey) && counts[`${role}|${g.moduleKey}`] > 0)
        .map((g) => g.moduleLabel);
    }
    return out;
  }, [counts, groups, roles]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="treebar">
        <button type="button" onClick={() => setAll(!allOpen)}>
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
        <span className="treehint">
          {groups.length} modules · click a module to show its pages
        </span>
      </div>

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
            {groups.map((g) => {
              const expanded = isOpen(g.moduleKey);
              const mod = g.nodes.find((n) => n.isModule)!;
              const pages = g.nodes.filter((n) => !n.isModule);

              return [
                <tr key={g.moduleKey} className="modrow">
                  <td className="modname">
                    <button
                      type="button"
                      className={`twist ${expanded ? "open" : ""}`}
                      onClick={() => setOpen({ ...open, [g.moduleKey]: !expanded })}
                      aria-expanded={expanded}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                      {g.moduleLabel}
                      <span className="pagecount">{pages.length}</span>
                    </button>
                  </td>
                  {roles.map((r) => (
                    <td key={r} className="cell">
                      <label className="tick">
                        <input
                          type="checkbox"
                          name={`m|${r}|${mod.key}`}
                          checked={at(r, mod.key)}
                          onChange={() => toggle(r, mod, g)}
                        />
                        <span aria-hidden="true" />
                      </label>
                      {!expanded && (
                        <span className="minicount">
                          {counts[`${r}|${g.moduleKey}`]}/{pages.length}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>,

                // Pages stay mounted when collapsed so their values still post.
                ...pages.map((n) => (
                  <tr key={n.key} className={expanded ? "pagerow" : "pagerow hidden"}>
                    <td className="subname">{n.label}</td>
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
              ];
            })}
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

      <button className="btn-primary" type="submit"><IconSave /> Save access matrix</button>
    </>
  );
}
