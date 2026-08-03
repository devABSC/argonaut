import type { RoleKey } from "./roles";

/**
 * A recruiter sees only the candidates they uploaded.
 *
 * CVs carry contact details, employment history and, once PreJO Docs are
 * filed, government IDs — so the default is that a recruiter's pipeline is
 * their own. The owner sees everything, because someone has to be able to.
 *
 * Applied as a query filter rather than a check in the render: a list that
 * fetches everything and hides some rows leaks the moment a filter is
 * forgotten, and the counts give it away even when it does not.
 */
export function candidateScope(viewer: { id: string; role: RoleKey }) {
  return viewer.role === "SUPER_USER" ? {} : { recruiterId: viewer.id };
}

/** Whether this viewer may open one candidate. */
export function canSeeCandidate(
  viewer: { id: string; role: RoleKey },
  candidate: { recruiterId: string | null },
): boolean {
  return viewer.role === "SUPER_USER" || candidate.recruiterId === viewer.id;
}
