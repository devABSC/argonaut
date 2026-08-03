/** Where a task stands. */
export const TASK_STATUS = ["Open", "In Progress", "Blocked", "Done", "Cancelled"] as const;

export const TASK_PRIORITY = ["Low", "Normal", "High", "Urgent"] as const;

export const TASK_PILL: Record<string, string> = {
  Open: "s-PENDING",
  "In Progress": "s-PENDING",
  Blocked: "s-REJECTED",
  Done: "s-ACTIVE",
  Cancelled: "s-SUSPENDED",
};
