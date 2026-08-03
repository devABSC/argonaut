import { redirect, notFound } from "next/navigation";
import { getCurrentUser, needsPasswordChange } from "./auth";
import { findSection } from "./nav";
import { effectiveAccess, canOpenModule, canOpenTab, navFor } from "./access";
import { withLabels } from "./menu-labels";

/**
 * The gate every page goes through: signed in, allowed this module, allowed
 * this page. Returns the user plus the nav trimmed to what they may open, so
 * a page cannot accidentally render a menu wider than its own permissions.
 *
 * A denied page is a 404, not a 403 — no hint that it exists.
 */
export async function requireAccess(sectionKey: string, tabSlug?: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Checked here rather than in the UI, so it cannot be walked around by
  // typing a URL.
  if (needsPasswordChange(user)) redirect("/change-password");

  const grants = await effectiveAccess(user);
  if (!canOpenModule(grants, sectionKey)) notFound();

  const section = findSection(sectionKey);
  if (!section) notFound();

  const tab = tabSlug ? section.tabs.find((t) => t.slug === tabSlug) : section.tabs[0];
  if (!tab) notFound();
  if (!canOpenTab(grants, sectionKey, tab.slug)) notFound();

  // The nav is renamed at the edge, so every page shows the same words without
  // each one having to remember to ask.
  const nav = await withLabels(navFor(grants));
  const named = nav.find((n) => n.key === sectionKey) ?? section;
  const namedTab = named.tabs.find((t) => t.slug === tab.slug) ?? tab;

  return { user, grants, section: named, tab: namedTab, nav };
}

/** First page the user is actually allowed to see, for the root redirect. */
export async function landingPath(user: { id: string; role: import("./roles").RoleKey }) {
  const nav = navFor(await effectiveAccess(user));
  if (nav.length === 0) return null;
  return `/${nav[0].key}/${nav[0].tabs[0].slug}`;
}
