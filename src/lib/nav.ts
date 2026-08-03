// Argonaut — main navigation. The single place the nav structure is declared;
// AppShell renders it and the route pages validate against it.
import type { RoleKey } from "./roles.ts";

export type NavTab = {
  slug: string;
  label: string;
  /** Reachable route, but not listed in the left-pane submenu. */
  hideInSubmenu?: boolean;
  /** Spelt-out name, shown on hover where the label is an abbreviation. */
  title?: string;
};
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
  roles?: RoleKey[];
};

export const NAV: NavSection[] = [
  {
    // First in the list, so it is where everyone lands. Open to every signed-in
    // user — it is their own space, not a granted module.
    key: "my-space",
    label: "My Space",
    tabs: [
      { slug: "overview", label: "Overview" },
      { slug: "personal-info", label: "Personal Info" },
      { slug: "statutory", label: "Statutory" },
      { slug: "change-password", label: "Change Pw" },
      { slug: "notifications", label: "Notifications" },
    ],
  },
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
    // Not open to everyone — HR data is granted, not assumed.
    key: "hris",
    label: "HRIS",
    roles: ["SUPER_USER", "ADMINISTRATOR", "HR_SUPERVISOR"],
    // Personal Info, Contract, Report To, Statutory, Medical, NTE-CAR, VLSL and
    // 201 Logs are per-employee views — they live inside a person's record at
    // /hris/employee/{id}/{view}, not in this strip.
    tabs: [{ slug: "employees", label: "Employees" }],
  },
  {
    key: "finance",
    label: "Finance",
    // Sublinks in the left pane, plus a strip of tabs that belongs to
    // Expenses / Cash Adv / Bills only. Expenses is first so clicking Finance
    // lands on the strip rather than on a page that has none.
    tabs: [
      { slug: "expenses", label: "Expenses", hideInSubmenu: true },
      { slug: "cash-advance", label: "Cash Adv", hideInSubmenu: true },
      { slug: "bills", label: "Bills", hideInSubmenu: true },
      { slug: "soa", label: "SOA", title: "Statement of Account", hideInSubmenu: true },
      { slug: "bir", label: "BIR" },
      { slug: "payroll", label: "Payroll" },
      { slug: "payable", label: "Payable" },
      { slug: "receivable", label: "Receivable" },
      { slug: "config", label: "Config" },
      // Reachable, but reached through Config rather than listed beside it.
      { slug: "coa", label: "COA", title: "Chart of Accounts", hideInSubmenu: true },
    ],
    children: "submenu",
    topTabs: [
      { slug: "expenses", label: "Expenses" },
      { slug: "cash-advance", label: "Cash Adv" },
      { slug: "bills", label: "Bills" },
      { slug: "soa", label: "SOA", title: "Statement of Account" },
    ],
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
    key: "crm",
    label: "CRM",
    tabs: [
      { slug: "pipeline", label: "Pipeline" },
      { slug: "clients", label: "Clients" },
      { slug: "suppliers", label: "Suppliers" },
      { slug: "contacts", label: "Contacts" },
    ],
    roles: ["SUPER_USER", "ADMINISTRATOR", "SUPERVISOR"],
  },
  {
    key: "marketing",
    label: "Marketing",
    tabs: [
      { slug: "send", label: "Send Email" },
      { slug: "templates", label: "Templates" },
      { slug: "diagnostics", label: "Diagnostics" },
    ],
    roles: ["SUPER_USER", "ADMINISTRATOR"],
  },
  {
    key: "reports-analytics",
    label: "Reports-Analytics",
    tabs: [
      { slug: "overview", label: "Overview" },
      { slug: "service-desk", label: "Service Desk" },
      { slug: "logs", label: "Log History" },
    ],
    roles: ["SUPER_USER", "ADMINISTRATOR", "HR_SUPERVISOR"],
  },
  {
    key: "recruitment",
    label: "RECRUITMENT",
    tabs: [{ slug: "candidates", label: "Candidates" }],
    roles: ["SUPER_USER", "ADMINISTRATOR", "HR_SUPERVISOR"],
  },
  {
    key: "edoc",
    label: "eDOC",
    tabs: [{ slug: "documents", label: "Documents" }],
    roles: ["SUPER_USER", "ADMINISTRATOR"],
  },
  {
    key: "project",
    label: "PROJECT",
    tabs: [{ slug: "projects", label: "Projects" }],
    roles: ["SUPER_USER", "ADMINISTRATOR"],
  },
  {
    key: "car",
    label: "CAR",
    tabs: [{ slug: "reports", label: "Reports" }],
    roles: ["SUPER_USER", "ADMINISTRATOR"],
  },
  {
    key: "settings",
    label: "Settings",
    tabs: [
      { slug: "users", label: "Users" },
      { slug: "company", label: "Company" },
      { slug: "bou", label: "BOU" },
      { slug: "email", label: "Email" },
      { slug: "roles", label: "Roles" },
      { slug: "rbac", label: "RBAC" },
      { slug: "cron-jobs", label: "Cron Jobs" },
    ],
    // HR Supervisor is included because registration approvals live here.
    roles: ["SUPER_USER", "ADMINISTRATOR", "HR_SUPERVISOR"],
  },
];

export function visibleNav(role: RoleKey): NavSection[] {
  return NAV.filter((s) => !s.roles || s.roles.includes(role));
}

export function sectionHref(s: NavSection): string {
  return `/${s.key}/${s.tabs[0].slug}`;
}

export function findSection(key: string): NavSection | undefined {
  return NAV.find((s) => s.key === key);
}

/** Whether `role` may open this section at all. */
export function canViewSection(role: RoleKey, key: string): boolean {
  const s = findSection(key);
  return !!s && (!s.roles || s.roles.includes(role));
}

/** The tab strip shown when a Finance sublink is open. Config has its own. */
export const FINANCE_CONFIG_TABS: NavTab[] = [
  { slug: "coa", label: "COA", title: "Chart of Accounts" },
];
