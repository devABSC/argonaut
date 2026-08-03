import assert from "node:assert/strict";
import { defaultAllows, allNodes, accessTree, canOpenModule, canOpenTab, navFor } from "../src/lib/access-policy.ts";

let n = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); n++; };

/* --- the standing rule: Service Desk for all, HRIS is not --- */
for (const role of ["SUPER_USER","ADMINISTRATOR","HR_SUPERVISOR","SUPERVISOR","EMPLOYEE"] as const) {
  ok(`${role} may open Service Desk`, defaultAllows(role, "service-desk"));
}
ok("employee may NOT open HRIS", !defaultAllows("EMPLOYEE", "hris"));
ok("supervisor may NOT open HRIS", !defaultAllows("SUPERVISOR", "hris"));
ok("hr supervisor MAY open HRIS", defaultAllows("HR_SUPERVISOR", "hris"));
ok("employee may NOT open Workflow", !defaultAllows("EMPLOYEE", "workflow"));
ok("employee may NOT open Settings", !defaultAllows("EMPLOYEE", "settings"));
ok("unknown node denied", !defaultAllows("SUPER_USER", "does-not-exist"));
ok("employee may NOT open Reports-Analytics", !defaultAllows("EMPLOYEE", "reports-analytics"));
ok("employee may NOT open Marketing", !defaultAllows("EMPLOYEE", "marketing"));
ok("supervisor may NOT open Marketing", !defaultAllows("SUPERVISOR", "marketing"));
ok("admin MAY open Marketing", defaultAllows("ADMINISTRATOR", "marketing"));
ok("admin MAY open Reports-Analytics", defaultAllows("ADMINISTRATOR", "reports-analytics"));
ok("reports module is in the tree", allNodes().some((x) => x.key === "reports-analytics:overview"));

/* --- submenu keys inherit their module's default --- */
ok("submenu key resolves via its module", defaultAllows("EMPLOYEE", "service-desk:new-request"));
ok("hris submenu denied to employee", !defaultAllows("EMPLOYEE", "hris:contract"));

/* --- node tree covers modules and submenus --- */
const keys = allNodes().map((x) => x.key);
ok("tree has module nodes", keys.includes("hris") && keys.includes("workflow"));
ok("tree has submenu nodes", keys.includes("hris:contract") && keys.includes("settings:rbac"));
ok("no duplicate node keys", new Set(keys).size === keys.length);
ok("every submenu belongs to a listed module",
  accessTree().every((g) => g.nodes.every((x) => x.moduleKey === g.section.key)));

/* --- a page needs BOTH its module and itself --- */
const grants = new Map<string, boolean>([
  ["hris", false], ["hris:contract", true],
  ["service-desk", true], ["service-desk:new-request", true], ["service-desk:my-requests", false],
]);
ok("closed module blocks its page even when the page is ticked",
  !canOpenTab(grants, "hris", "contract"));
ok("open module + open page passes", canOpenTab(grants, "service-desk", "new-request"));
ok("open module + closed page fails", !canOpenTab(grants, "service-desk", "my-requests"));
ok("module check alone", canOpenModule(grants, "service-desk") && !canOpenModule(grants, "hris"));

/* --- navFor drops modules with nothing left inside --- */
const nav = navFor(grants);
ok("only service-desk survives", nav.length === 1 && nav[0].key === "service-desk");
ok("its tab list is trimmed to the granted page",
  nav[0].tabs.length === 1 && nav[0].tabs[0].slug === "new-request");

const empty = navFor(new Map([["hris", true]]));
ok("module with no granted pages is dropped", empty.length === 0);

console.log(`\n  ✓ ${n} access-control assertions passed\n`);
