// Pure access policy: no database, so it can be unit-tested directly.
import type { Role } from "@prisma/client";
import { NAV, type NavSection } from "./nav.ts";

/**
 * A node in the access tree: a module ("hris") or one of its submenus
 * ("hris:contract"). These keys are what MenuGrant rows point at.
 */
export type AccessNode = {
  key: string;
  label: string;
  moduleKey: string;
  tabSlug?: string;
};

export function moduleNodeKey(sectionKey: string) {
  return sectionKey;
}
export function tabNodeKey(sectionKey: string, tabSlug: string) {
  return `${sectionKey}:${tabSlug}`;
}

/** Every grantable node, modules first with their submenus beneath. */
export function accessTree(): { section: NavSection; nodes: AccessNode[] }[] {
  return NAV.map((s) => ({
    section: s,
    nodes: [
      { key: moduleNodeKey(s.key), label: s.label, moduleKey: s.key },
      ...s.tabs.map((t) => ({
        key: tabNodeKey(s.key, t.slug),
        label: t.label,
        moduleKey: s.key,
        tabSlug: t.slug,
      })),
    ],
  }));
}

export function allNodes(): AccessNode[] {
  return accessTree().flatMap((g) => g.nodes);
}

/** What the code grants a role when nobody has configured anything. */
export function defaultAllows(role: Role, nodeKey: string): boolean {
  const [sectionKey] = nodeKey.split(":");
  const section = NAV.find((s) => s.key === sectionKey);
  if (!section) return false;
  return !section.roles || section.roles.includes(role);
}

export type Grants = Map<string, boolean>;

/** Can this user open the module at all? */
export function canOpenModule(grants: Grants, sectionKey: string): boolean {
  return grants.get(moduleNodeKey(sectionKey)) === true;
}

/** Can this user open one specific submenu? The module must be open too. */
export function canOpenTab(grants: Grants, sectionKey: string, tabSlug: string): boolean {
  return canOpenModule(grants, sectionKey) && grants.get(tabNodeKey(sectionKey, tabSlug)) === true;
}

/**
 * The nav to render: modules the user may open, each trimmed to the submenus
 * they may open. A module whose submenus are all denied is dropped, so nobody
 * is shown a door that leads nowhere.
 */
export function navFor(grants: Grants): NavSection[] {
  return NAV.filter((s) => canOpenModule(grants, s.key))
    .map((s) => ({ ...s, tabs: s.tabs.filter((t) => canOpenTab(grants, s.key, t.slug)) }))
    .filter((s) => s.tabs.length > 0);
}
