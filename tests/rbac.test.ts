import assert from "node:assert/strict";
import {
  canManageUsers, canManageUser, canAssignRole, assignableRoles,
  canApproveRegistrations, canViewAllProjects, projectScope, outranks,
} from "../src/lib/rbac.ts";
import { visibleNav, canViewSection } from "../src/lib/nav.ts";

const A = (role: any, id = "me") => ({ id, role });
const T = (role: any, id = "them") => ({ id, role });

let n = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); n++; };

/* --- who can reach user management --- */
ok("super manages users", canManageUsers(A("SUPER_USER")));
ok("admin manages users", canManageUsers(A("ADMINISTRATOR")));
ok("hr does NOT manage users", !canManageUsers(A("HR_SUPERVISOR")));
ok("supervisor does NOT manage users", !canManageUsers(A("SUPERVISOR")));
ok("employee does NOT manage users", !canManageUsers(A("EMPLOYEE")));

/* --- privilege escalation guards --- */
ok("admin cannot act on another admin", !canManageUser(A("ADMINISTRATOR"), T("ADMINISTRATOR")));
ok("admin cannot act on super user", !canManageUser(A("ADMINISTRATOR"), T("SUPER_USER")));
ok("admin CAN act on hr supervisor", canManageUser(A("ADMINISTRATOR"), T("HR_SUPERVISOR")));
ok("admin CAN act on employee", canManageUser(A("ADMINISTRATOR"), T("EMPLOYEE")));
ok("super can act on admin", canManageUser(A("SUPER_USER"), T("ADMINISTRATOR")));

ok("admin cannot mint a super user", !canAssignRole(A("ADMINISTRATOR"), "SUPER_USER"));
ok("admin cannot mint an admin", !canAssignRole(A("ADMINISTRATOR"), "ADMINISTRATOR"));
ok("admin can assign hr supervisor", canAssignRole(A("ADMINISTRATOR"), "HR_SUPERVISOR"));
ok("super can mint a super user", canAssignRole(A("SUPER_USER"), "SUPER_USER"));
ok("employee can assign nothing", assignableRoles(A("EMPLOYEE")).length === 0);
ok("admin assignable excludes admin+super",
  JSON.stringify(assignableRoles(A("ADMINISTRATOR"))) === JSON.stringify(["HR_SUPERVISOR","SUPERVISOR","EMPLOYEE"]));

/* --- registration approval: HR Supervisor and Super User only --- */
ok("super approves", canApproveRegistrations(A("SUPER_USER")));
ok("hr supervisor approves", canApproveRegistrations(A("HR_SUPERVISOR")));
ok("plain supervisor does NOT approve", !canApproveRegistrations(A("SUPERVISOR")));
ok("admin does NOT approve registrations", !canApproveRegistrations(A("ADMINISTRATOR")));
ok("employee does NOT approve", !canApproveRegistrations(A("EMPLOYEE")));

/* --- data scoping --- */
ok("super sees all", canViewAllProjects(A("SUPER_USER")));
ok("admin sees all", canViewAllProjects(A("ADMINISTRATOR")));
ok("supervisor does not see all", !canViewAllProjects(A("SUPERVISOR")));

assert.deepEqual(projectScope(A("ADMINISTRATOR")), {}, "admin scope unrestricted");
assert.deepEqual(projectScope(A("EMPLOYEE", "u1")), { userId: "u1" }, "employee scoped to self");
assert.deepEqual(
  projectScope(A("SUPERVISOR", "s1")),
  { OR: [{ userId: "s1" }, { user: { managerId: "s1" } }] },
  "supervisor scoped to self + direct reports",
);
n += 3;

ok("hr_supervisor does not see everything", !canViewAllProjects(A("HR_SUPERVISOR")));
assert.deepEqual(
  projectScope(A("HR_SUPERVISOR", "h1")),
  { OR: [{ userId: "h1" }, { user: { managerId: "h1" } }] },
  "hr supervisor scoped to self + direct reports, like a supervisor",
);
n++;
ok("rank: super outranks admin", outranks(A("SUPER_USER"), T("ADMINISTRATOR")));
ok("rank: employee does not outrank supervisor", !outranks(A("EMPLOYEE"), T("SUPERVISOR")));

/* --- navigation visibility --- */
const keys = (role: any) => visibleNav(role).map((s) => s.key);

assert.deepEqual(keys("EMPLOYEE"), ["service-desk"], "employee sees only service desk — HRIS is not for everyone");
assert.deepEqual(keys("SUPERVISOR"), ["service-desk", "crm"], "supervisor gets CRM but not HRIS");
assert.deepEqual(
  keys("HR_SUPERVISOR"),
  ["service-desk", "hris", "reports-analytics", "settings"],
  "hr supervisor gets HRIS and settings, but not finance/workflow",
);
assert.deepEqual(
  keys("ADMINISTRATOR"),
  ["service-desk", "hris", "finance", "workflow", "crm", "marketing", "reports-analytics", "settings"],
  "administrator sees finance + workflow config + settings",
);
assert.deepEqual(
  keys("SUPER_USER"),
  ["service-desk", "hris", "finance", "workflow", "crm", "marketing", "reports-analytics", "settings"],
  "super user sees everything",
);
n += 5;

ok("employee cannot open settings", !canViewSection("EMPLOYEE", "settings"));
ok("plain supervisor cannot open settings", !canViewSection("SUPERVISOR", "settings"));
ok("hr supervisor can open settings", canViewSection("HR_SUPERVISOR", "settings"));

ok("employee cannot open workflow config", !canViewSection("EMPLOYEE", "workflow"));
ok("employee cannot open HRIS", !canViewSection("EMPLOYEE", "hris"));
ok("employee cannot open finance", !canViewSection("EMPLOYEE", "finance"));
ok("hr supervisor cannot open workflow config", !canViewSection("HR_SUPERVISOR", "workflow"));
ok("admin can open workflow config", canViewSection("ADMINISTRATOR", "workflow"));
ok("everyone can open service desk", canViewSection("EMPLOYEE", "service-desk"));
ok("unknown section is denied", !canViewSection("SUPER_USER", "nope"));

console.log(`\n  ✓ ${n} RBAC + nav assertions passed\n`);
