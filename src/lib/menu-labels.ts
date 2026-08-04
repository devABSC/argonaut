import { cache } from "react";
import { prisma } from "./prisma";
import type { NavSection } from "./nav";
import { moduleNodeKey, tabNodeKey } from "./access-policy";

/**
 * Applies renamed menu labels over the nav declared in code.
 *
 * The nav structure — what exists, what it links to, who may see it — stays in
 * code. Only the words change here, so a spelling fix never risks the routes.
 */
/** The renames, read once per request however many callers want them. */
const labelRows = cache(async () => prisma.menuLabel.findMany().catch(() => []));

export async function withLabels(nav: NavSection[]): Promise<NavSection[]> {
  const rows = await labelRows();
  if (rows.length === 0) return nav;

  const by = new Map(rows.map((r) => [r.nodeKey, r]));

  return nav.map((s) => {
    const mod = by.get(moduleNodeKey(s.key));
    return {
      ...s,
      label: mod?.label ?? s.label,
      tabs: s.tabs.map((t) => {
        const o = by.get(tabNodeKey(s.key, t.slug));
        return o ? { ...t, label: o.label, title: o.title ?? t.title } : t;
      }),
      topTabs: s.topTabs?.map((t) => {
        const o = by.get(tabNodeKey(s.key, t.slug));
        return o ? { ...t, label: o.label, title: o.title ?? t.title } : t;
      }),
    };
  });
}
