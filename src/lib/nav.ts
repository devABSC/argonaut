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
  /**
   * Slug of the tab this one sits under. Nested one level in the rail, so a
   * page that belongs to another page reads that way instead of appearing
   * beside it.
   */
  parent?: string;
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
    // First in the list, so the owner lands here. Owner-only for now — it is
    // the front page of the product, not a personal dashboard.
    key: "home",
    label: "Home",
    tabs: [{ slug: "overview", label: "Overview" }],
    roles: ["SUPER_USER"],
  },
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
    tabs: [
      { slug: "employees", label: "Employees" },
      { slug: "hc2contract", label: "HC 2 Contract", title: "Headcount to Contract" },
    ],
    // Sublinks in the left pane rather than a strip, so HRIS reads the same
    // way Finance and Workflow do.
    children: "submenu",
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
      { slug: "payable", label: "Payable" },
      { slug: "receivable", label: "Receivable" },
      { slug: "config", label: "Config" },
      // Reachable, but reached through their parent rather than listed beside it.
      { slug: "coa", label: "COA", title: "Chart of Accounts", parent: "config" },
      { slug: "ageing", label: "Ageing", parent: "receivable" },
      { slug: "bir-forms", label: "Forms", parent: "bir" },
      { slug: "bir-2307", label: "2307", title: "Certificate of Creditable Tax Withheld at Source", parent: "bir" },
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
    // Its own module, not a page inside Finance — payroll is run by different
    // people, on its own cycle.
    key: "payroll",
    label: "Payroll",
    tabs: [
      { slug: "runs", label: "Payroll Runs" },
      { slug: "register", label: "Register" },
    ],
    children: "submenu",
    roles: ["SUPER_USER", "ADMINISTRATOR"],
  },
  {
    // Ported from benta: stock on hand, and the two ways it moves.
    key: "inventory",
    label: "Inventory",
    tabs: [
      { slug: "item-master", label: "Item Master" },
      { slug: "stock", label: "Stock on Hand" },
      { slug: "receiving", label: "Receiving" },
      { slug: "issuance", label: "Issuance" },
      { slug: "asset", label: "Asset" },
    ],
    children: "submenu",
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
    // The statutory agencies, each with its own filings and remittances.
    key: "admin",
    label: "ADMIN",
    tabs: [
      { slug: "sss", label: "SSS", title: "Social Security System" },
      { slug: "pagibig", label: "Pagibig", title: "Home Development Mutual Fund" },
      { slug: "philhealth", label: "Philhealth", title: "Philippine Health Insurance Corporation" },
    ],
    children: "submenu",
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
    // Sublinks in the left pane rather than one long tab strip — Settings has
    // grown past what a strip reads well at.
    children: "submenu",
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

/** Receivable's own strip — what is owed, and how long it has been owed. */
export const FINANCE_RECEIVABLE_TABS: NavTab[] = [
  { slug: "ageing", label: "Ageing" },
];

/** BIR's own strip. */
export const FINANCE_BIR_TABS: NavTab[] = [
  { slug: "bir-forms", label: "Forms" },
  { slug: "bir-2307", label: "2307", title: "Certificate of Creditable Tax Withheld at Source" },
];
