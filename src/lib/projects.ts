/** Where a project stands. */
export const PROJECT_STATUS = ["Planning", "Active", "On Hold", "Closed", "Cancelled"] as const;

/** What a member holds on a project. */
export const HOLDERS = ["Lead", "Member", "Reviewer", "Sponsor"] as const;

export const PROJECT_PILL: Record<string, string> = {
  Planning: "s-PENDING",
  Active: "s-ACTIVE",
  "On Hold": "s-PENDING",
  Closed: "s-SUSPENDED",
  Cancelled: "s-REJECTED",
};

/** Every view inside one project's record. Used to validate the URL. */
export const PROJECT_VIEWS = [
  { slug: "project-info", label: "Details" },
  { slug: "milestone", label: "Milestone" },
  { slug: "roadblocks", label: "Roadblocks" },
  { slug: "risks", label: "Risks" },
] as const;

/**
 * The record's own tabs. Milestones, roadblocks and risks are not siblings of
 * Project Info — they are what the project info consists of — so they sit a
 * level down rather than beside it.
 */
export const PROJECT_SECTIONS = [
  { slug: "project-info", label: "Project Info", views: PROJECT_VIEWS },
] as const;

export type ProjectView = (typeof PROJECT_VIEWS)[number]["slug"];

export function isProjectView(slug: string): slug is ProjectView {
  return PROJECT_VIEWS.some((v) => v.slug === slug);
}

/// A task is either still being worked on or it is not. Kept simpler than
/// its milestone on purpose.
export const TASK_STATUS = ["Open", "Closed"] as const;

export const MILESTONE_STATUS = ["Pending", "In Progress", "Done", "Missed"] as const;
export const ROADBLOCK_STATUS = ["Open", "Escalated", "Resolved"] as const;
export const RISK_STATUS = ["Open", "Mitigated", "Accepted", "Closed"] as const;
export const SEVERITY = ["Low", "Medium", "High", "Critical"] as const;
export const LIKELIHOOD = ["Low", "Medium", "High"] as const;

export const SUB_PILL: Record<string, string> = {
  Pending: "s-PENDING", "In Progress": "s-PENDING", Done: "s-ACTIVE", Missed: "s-REJECTED",
  Open: "s-PENDING", Escalated: "s-REJECTED", Resolved: "s-ACTIVE",
  Mitigated: "s-ACTIVE", Accepted: "s-PENDING", Closed: "s-SUSPENDED",
};
