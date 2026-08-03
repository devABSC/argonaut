/** Tabs inside one candidate's record. */
export const CAND_VIEWS = [
  { slug: "personal-info", label: "Personal Info" },
  { slug: "cv", label: "CV" },
  { slug: "work-experience", label: "Work Experience" },
  { slug: "skills", label: "Skills" },
  { slug: "char-ref", label: "Char Ref" },
  { slug: "prejo-docs", label: "PreJO Docs" },
  { slug: "ai-data", label: "Other AI Data" },
  { slug: "assessment", label: "Assessment" },
  { slug: "experience", label: "Summary" },
  { slug: "notes", label: "Notes" },
] as const;

export type CandView = (typeof CAND_VIEWS)[number]["slug"];

export function isCandView(slug: string): slug is CandView {
  return CAND_VIEWS.some((v) => v.slug === slug);
}

export const STAGES = [
  "Applied", "Screening", "Interview", "Offer", "Hired", "Rejected", "Withdrawn",
] as const;

export const STAGE_PILL: Record<string, string> = {
  Applied: "s-PENDING",
  Screening: "s-PENDING",
  Interview: "s-PENDING",
  Offer: "s-PENDING",
  Hired: "s-ACTIVE",
  Rejected: "s-REJECTED",
  Withdrawn: "s-SUSPENDED",
};

/** The pre-employment documents a candidate submits before a job offer. */
export const PREJO_DOCS = [
  "NBI Clearance",
  "Barangay Clearance",
  "Police Clearance",
  "Medical / Pre-employment Exam",
  "Certificate of Employment",
  "Diploma / TOR",
  "Birth Certificate (PSA)",
  "Marriage Certificate (PSA)",
  "SSS / Philhealth / Pag-IBIG",
  "TIN",
  "Other",
] as const;

export const PREJO_STATUS = ["Pending", "Submitted", "Verified", "Rejected", "Not Required"] as const;

export const PREJO_PILL: Record<string, string> = {
  Pending: "s-PENDING",
  Submitted: "s-PENDING",
  Verified: "s-ACTIVE",
  Rejected: "s-REJECTED",
  "Not Required": "s-SUSPENDED",
};

/** Where a "verify this" item stands. */
export const VERIFY_STATUS = ["Open", "Verified", "Discrepancy", "Cannot Verify", "Not Applicable"] as const;

export const VERIFY_PILL: Record<string, string> = {
  Open: "s-PENDING",
  Verified: "s-ACTIVE",
  Discrepancy: "s-REJECTED",
  "Cannot Verify": "s-SUSPENDED",
  "Not Applicable": "s-SUSPENDED",
};
