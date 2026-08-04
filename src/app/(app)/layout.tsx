import { redirect } from "next/navigation";
import { getCurrentUser, needsPasswordChange } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/rbac";
import { effectiveAccess, navFor, grantsFromJson } from "@/lib/access";
import { withLabels } from "@/lib/menu-labels";
import AppShell from "@/app/AppShell";

/**
 * The chrome around every signed-in page.
 *
 * Here rather than inside each page so the router keeps it mounted: moving
 * between pages fetches only the new content, and the rail is never rebuilt,
 * re-sent or remounted. Every page still checks its own permission — this
 * decides what the menu shows, not what may be opened.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (needsPasswordChange(user)) redirect("/change-password");

  // Resolved at sign-in and carried on the session; worked out again only when
  // it is missing.
  const grants = grantsFromJson(user.access) ?? (await effectiveAccess(user));
  const nav = await withLabels(navFor(grants));

  return (
    <AppShell user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }} nav={nav}>
      {children}
    </AppShell>
  );
}
