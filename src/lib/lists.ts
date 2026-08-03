/**
 * Choice lists for HRIS fields that hold one of a fixed set of values.
 *
 * The vocabulary is the source system's own, taken from the usercore extract,
 * so imported records and newly typed ones read the same. Where the old Add
 * Employee form offered something the source never used (Project-Based,
 * Consultant, Executive, On Leave), it is kept — those are real options that
 * simply have nobody in them yet.
 */

/** Contract type. "emp_stat" in the source — stat meaning status. */
export const EMP_STATUS = [
  "Regular",
  "Probationary",
  "Term-Based",
  "Project-Based",
  "Consultant",
] as const;

/** Rank. "emp_type" in the source. */
export const EMP_TYPE = [
  "Rank & File",
  "Supervisor",
  "Manager",
  "Executive",
] as const;

/**
 * Whether the person is still with the company. Kept apart from EMP_STATUS
 * because the source crammed both into one column: Resigned and Terminated
 * describe a separation, not a contract.
 */
export const EMPLOYMENT_STATUS = [
  "Active",
  "Inactive",
  "Resigned",
  "Terminated",
  "On Leave",
] as const;

export const GENDER = ["Male", "Female"] as const;

/** Source values that mean "no longer employed" rather than a contract type. */
export const SEPARATION = new Set(["Resigned", "Terminated"]);
