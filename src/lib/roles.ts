/**
 * Role keys are the stable currency the permission checks compare against.
 * Rows in the Role table carry the editable label, description and ranking;
 * these constants are the fallback and the compile-time vocabulary.
 */
export const ROLE_KEYS = [
  "SUPER_USER",
  "ADMINISTRATOR",
  "HR_SUPERVISOR",
  "SUPERVISOR",
  "EMPLOYEE",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export function isRoleKey(v: unknown): v is RoleKey {
  return typeof v === "string" && (ROLE_KEYS as readonly string[]).includes(v);
}

/** Higher outranks lower. Mirrors the seeded Role.rank values. */
export const RANK: Record<RoleKey, number> = {
  SUPER_USER: 5,
  ADMINISTRATOR: 4,
  HR_SUPERVISOR: 3,
  SUPERVISOR: 2,
  EMPLOYEE: 1,
};

/** Shown when the Role row has not been renamed. */
export const ROLE_LABEL: Record<RoleKey, string> = {
  SUPER_USER: "Super User",
  ADMINISTRATOR: "Administrator",
  HR_SUPERVISOR: "HR Supervisor",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Employee",
};
