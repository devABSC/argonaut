// Argonaut — main navigation. The single place the nav structure is declared;
// AppShell renders it and the route pages validate against it.
import type { Role } from "@prisma/client";

export type NavTab = { slug: string; label: string; /** Reachable route, but not listed in the left-pane submenu. */ hideInSubmenu?: boolean };
export type NavSection = {
  key: string;
  label: string;
  tabs: NavTab[];
  /**
   * How the section's children are presented:
   * "tabs"    — a tab strip across the top of the page (HRIS, Service Desk)
   * "submenu" — sublinks nested under the section in the left pane (Workflow)
   */
  children?: "tabs" | "submenu";
  /**
   * Tabs shown across the top of the content area, independent of the left-pane
   * sublinks. Used by Workflow, which has both.
   */
  topTabs?: NavTab[];
  /** When set, only these roles see the section. Unset = every signed-in user. */
  roles?: Role[];
};

export const NAV: NavSection[] = [
  {
    key: "service-desk",
    label: "Service Desk",
    tabs: [
      { slug: "new-request", label: "New Request" },
      { slug: "my-requests", label: "My Requests" },
      { slug: "approvals", label: "For My Approval" },
    ],
  },
  {
    key: "hris",
    label: "HRIS",
    tabs: [
      { slug: "personal-info", label: "Personal Info" },
      { slug: "contract", label: "Contract" },
      { slug: "vlsl", label: "VLSL" },
      { slug: "report-to", label: "Report To" },
      { slug: "statutory", label: "Statutory" },
      { slug: "201-logs", label: "201 Logs" },
      { slug: "medical", label: "Medical" },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    tabs: [{ slug: "issue-cash-advance", label: "Issue Cash Advance" }],
    roles: ["SUPER_USER", "ADMINISTRATOR"],
  },
  {
    key: "workflow",
    label: "Workflow",
    tabs: [
      { slug: "service-type", label: "Service Type" },
      { slug: "service-forms", label: "Service Forms" },
      { slug: "tasks", label: "Tasks", hideInSubmenu: true },
      { slug: "routes", label: "Routes", hideInSubmenu: true },
    ],
    children: "submenu",
    topTabs: [
      { slug: "service-type", label: "Workflow" },
      { slug: "routes", label: "Routes" },
    ],
    roles: ["SUPER_USER", "ADMINISTRATOR"],
  },
  {
    key: "settings",
    label: "Settings",
    tabs: [{ slug: "users", label: "Users" }],
    // HR Supervisor is included because registration approvals live here.
    roles: ["SUPER_USER", "ADMINISTRATOR", "HR_SUPERVISOR"],
  },
];

export function visibleNav(role: Role): NavSection[] {
  return NAV.filter((s) => !s.roles || s.roles.includes(role));
}

export function sectionHref(s: NavSection): string {
  return `/${s.key}/${s.tabs[0].slug}`;
}

export function findSection(key: string): NavSection | undefined {
  return NAV.find((s) => s.key === key);
}

/** Whether `role` may open this section at all. */
export function canViewSection(role: Role, key: string): boolean {
  const s = findSection(key);
  return !!s && (!s.roles || s.roles.includes(role));
}
