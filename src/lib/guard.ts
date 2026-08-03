import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "./auth";
import { findSection } from "./nav";
import { effectiveAccess, canOpenModule, canOpenTab, navFor } from "./access";

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

  const grants = await effectiveAccess(user);
  if (!canOpenModule(grants, sectionKey)) notFound();

  const section = findSection(sectionKey);
  if (!section) notFound();

  const tab = tabSlug ? section.tabs.find((t) => t.slug === tabSlug) : section.tabs[0];
  if (!tab) notFound();
  if (!canOpenTab(grants, sectionKey, tab.slug)) notFound();

  return { user, grants, section, tab, nav: navFor(grants) };
}

/** First page the user is actually allowed to see, for the root redirect. */
export async function landingPath(user: { id: string; role: import("@prisma/client").Role }) {
  const nav = navFor(await effectiveAccess(user));
  if (nav.length === 0) return null;
  return `/${nav[0].key}/${nav[0].tabs[0].slug}`;
}
