/** Tabs inside one candidate's record. */
export const CAND_VIEWS = [
  { slug: "personal-info", label: "Personal Info" },
  { slug: "cv", label: "CV" },
  { slug: "work-experience", label: "Work Experience" },
  { slug: "skills", label: "Skills" },
  { slug: "char-ref", label: "Char Ref" },
  { slug: "ai-data", label: "Other AI Data" },
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
