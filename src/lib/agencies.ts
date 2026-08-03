/**
 * What each statutory agency actually offers an employer's software, as of the
 * research done in August 2026.
 *
 * The short version: none of the three publish a third-party API. Every one of
 * them is a portal you log into and a file you upload. So the integration
 * argonaut can honestly offer is *file preparation* — build the remittance file
 * from the employee register, and hand it to the person who uploads it.
 *
 * Written down here rather than in a page so the finding, the recommendation
 * and the sources travel together and can be corrected in one place.
 */
export type Agency = "SSS" | "PAGIBIG" | "PHILHEALTH";

export type AgencyProfile = {
  key: Agency;
  name: string;
  full: string;
  /** What the agency gives employers today. */
  channel: string;
  /** The honest answer on APIs. */
  api: string;
  /** What argonaut should build against it. */
  recommendation: string[];
  /** Fields an employer needs before any of it works. */
  connection: { label: string; note: string }[];
  /** The forms or files involved. */
  artefacts: string[];
  sources: { label: string; url: string }[];
  /** Which employee identifier this agency's file is keyed on. */
  idField: "sssId" | "pagibigId" | "philId";
  idLabel: string;
};

export const AGENCIES: Record<Agency, AgencyProfile> = {
  PHILHEALTH: {
    key: "PHILHEALTH",
    name: "PhilHealth",
    full: "Philippine Health Insurance Corporation",
    channel:
      "EPRS — the Electronic Premium Remittance System. A web application employers log into with credentials issued through their PhilHealth Employer Engagement Representative (PEERS). Its use is mandatory for premium payment and for preparing and submitting the remittance report.",
    api:
      "No public API. PhilHealth's own employer documentation names only the EPRS web application and the participating banks' e-payment services as channels; it does not describe a web service, REST endpoint or developer programme for third-party software. Nothing in argonaut should claim to post to PhilHealth directly.",
    recommendation: [
      "Prepare, do not post. Build the RF-1 remittance report and the ER2 report of employees from the employee register, and let a person upload them to EPRS. That removes the retyping, which is where the errors are, without pretending to an integration that does not exist.",
      "Hold the employer identity here — PEN, registered name, EPRS username — so whoever files does not have to hunt for it.",
      "Track the deadline. PhilHealth sets it by the last digit of the PEN: ending 0–4 is the 11th to 15th of the following month, ending 5–9 the 16th to 20th. Argonaut can compute and show the date rather than leaving it to memory.",
      "Watch for an official API before building a scraper. Automating a login against a government portal risks the employer's account and breaks the moment the page changes.",
    ],
    connection: [
      { label: "PhilHealth Employer Number (PEN)", note: "Identifies the employer, and its last digit sets the remittance deadline." },
      { label: "Registered employer name", note: "Must match PhilHealth's record exactly, not the trading name." },
      { label: "EPRS portal URL", note: "Where the file is uploaded." },
      { label: "EPRS username", note: "Issued through your PEERS representative." },
      { label: "EPRS password", note: "Held masked. Stored so the filer is not hunting for it — never used to log in automatically." },
      { label: "Employee and employer share (%)", note: "Confirm against the current PhilHealth circular before the first run." },
    ],
    artefacts: ["RF-1 — Employer's Remittance Report", "ER2 — Report of Employee Members"],
    sources: [
      { label: "Payment and Reporting Procedures: Employer", url: "https://www.philhealth.gov.ph/partners/employers/pay_procedures.php" },
      { label: "EPRS user manual (PDF)", url: "https://www.philhealth.gov.ph/downloads/employer/EPRS_v2.1_UserManual.pdf" },
      { label: "Advisory 2017-0039 — mandatory use of EPRS", url: "https://www.philhealth.gov.ph/advisories/2017/adv2017-0039.pdf" },
    ],
    idField: "philId",
    idLabel: "PhilHealth No.",
  },

  SSS: {
    key: "SSS",
    name: "SSS",
    full: "Social Security System",
    channel:
      "My.SSS employer portal, fed by the R3 File Generator — a program SSS distributes that turns a contribution list into an R3 file the portal accepts. Employers upload the generated file rather than encoding each member.",
    api:
      "No public API. SSS distributes a desktop file generator and an upload portal; there is no documented web service for payroll software to post to. The integration point is the file, not an endpoint.",
    recommendation: [
      "Generate the R3 contribution list from payroll and hand over a file, not a printout. That is exactly what the R3 File Generator exists to consume, and it is the same shape argonaut already holds per employee.",
      "Key the file on the employee's SS number. Argonaut stores it, so the register is already the source; what is missing is the monthly compensation to compute the contribution from.",
      "Add basic pay to the employee record. Without it no statutory contribution can be computed here, and the file will always need a hand-filled amount column.",
      "Keep the rates in settings, not in code. SSS changes them by circular; a rate compiled into the app is a redeploy every time.",
    ],
    connection: [
      { label: "SSS Employer ID number", note: "The ER number SSS knows the company by." },
      { label: "Registered employer name", note: "As registered with SSS." },
      { label: "Branch code", note: "Where the company is registered, if it has one." },
      { label: "My.SSS portal URL", note: "Where the R3 file is uploaded." },
      { label: "My.SSS user ID", note: "The employer account." },
      { label: "My.SSS password", note: "Held masked, for the filer's convenience only." },
      { label: "Employee and employer share (%)", note: "From the current SSS contribution schedule." },
    ],
    artefacts: ["R3 — Contribution Collection List", "R5 — Employer Contributions Payment Return"],
    sources: [
      { label: "SSS — download forms and electronic applications", url: "https://www.sss.gov.ph/download-forms-and-electronic-applications/" },
      { label: "R3 File Generator user manual", url: "https://www.sss.gov.ph/sss/DownloadContent?fileName=R3FileGenUserManual.doc" },
      { label: "My.SSS employer portal", url: "https://employer.sss.gov.ph/employer/downloads.jsp" },
    ],
    idField: "sssId",
    idLabel: "SS No.",
  },

  PAGIBIG: {
    key: "PAGIBIG",
    name: "Pag-IBIG",
    full: "Home Development Mutual Fund",
    channel:
      "The MCRF — Membership Contribution Remittance Form — kept as a spreadsheet on Pag-IBIG's own template and submitted through Virtual Pag-IBIG or a partner bank. The template is an Excel workbook of member details and contribution amounts.",
    api:
      "No public API. Submission is a spreadsheet on the Fund's template, lodged through a portal or a bank. Nothing published describes an endpoint for payroll software.",
    recommendation: [
      "Fill their template, do not invent one. The MCRF is accepted on Pag-IBIG's own layout — argonaut should produce the member rows and leave the workbook otherwise as issued.",
      "Key on the Pag-IBIG MID number, which argonaut already stores per employee.",
      "Let the template be uploaded and kept here, the way BIR forms are, so a change to the Fund's layout is a file swap rather than a code change.",
      "Same gap as SSS: without monthly compensation on the employee record, the amount column cannot be computed.",
    ],
    connection: [
      { label: "Pag-IBIG Employer ID", note: "The employer number on the MCRF." },
      { label: "Registered employer name", note: "As registered with the Fund." },
      { label: "Virtual Pag-IBIG URL", note: "Or the partner bank's portal, if you lodge through a bank." },
      { label: "Portal username", note: "The employer account." },
      { label: "Portal password", note: "Held masked, for the filer's convenience only." },
      { label: "Employee and employer share (%)", note: "From the current Pag-IBIG circular." },
    ],
    artefacts: ["MCRF — Membership Contribution Remittance Form"],
    sources: [
      { label: "Pag-IBIG MCRF template and encoding instructions", url: "https://www.pagibigfund.gov.ph/" },
      { label: "Employer guidance — Pag-IBIG remittance", url: "https://www.globe.com.ph/help/business/sme/pag-ibig" },
    ],
    idField: "pagibigId",
    idLabel: "Pag-IBIG MID",
  },
};

export const isAgency = (v: string): v is Agency => v in AGENCIES;

/** The nav slug each agency page sits at. */
export const AGENCY_SLUG: Record<Agency, string> = {
  SSS: "sss",
  PAGIBIG: "pagibig",
  PHILHEALTH: "philhealth",
};

export function agencyForSlug(slug: string): Agency | null {
  const hit = (Object.keys(AGENCY_SLUG) as Agency[]).find((k) => AGENCY_SLUG[k] === slug);
  return hit ?? null;
}

