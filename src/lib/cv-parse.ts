import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { isImage, ocrImage, readPdfText, looksLikeText } from "./ocr";

/**
 * Reads a CV and returns the candidate's details.
 *
 * PDFs go to Claude as a document block — it reads them directly, so there is
 * no text-extraction step to lose the layout. DOCX has no such support, so it
 * is converted to text first.
 */

export type ParsedCV = {
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string | null;
  mobile: string | null;
  position: string | null;
  summary: string | null;
  skills: string[];
  yearsExperience: number | null;
  education: string | null;
  currentEmployer: string | null;
  location: string | null;
  /// Assessment signal, all of it read off the document the candidate sent.
  achievements: string[];
  certifications: string[];
  languages: string[];
  awards: string[];
  publicSites: string[];
  compensationNoted: string | null;
  employmentGaps: string[];
  shortTenures: string[];
  documentConcerns: string[];
  history: {
    yearFrom: number | null;
    yearTo: number | null;
    companyName: string;
    position: string | null;
    city: string | null;
    country: string | null;
    duties: string | null;
  }[];
};

const SCHEMA = {
  type: "object",
  properties: {
    firstName: { type: "string", description: "Given name. Empty string if the CV never states one." },
    lastName: { type: "string", description: "Family name. Empty string if absent." },
    middleName: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    mobile: { type: ["string", "null"], description: "Mobile or contact number, as written." },
    position: { type: ["string", "null"], description: "Role applied for, or the most recent job title." },
    summary: { type: ["string", "null"], description: "Two or three sentences on who this candidate is." },
    skills: { type: "array", items: { type: "string" }, description: "Named skills and technologies. Empty array if none listed." },
    yearsExperience: { type: ["integer", "null"], description: "Total years of professional experience, if it can be worked out." },
    education: { type: ["string", "null"], description: "Highest qualification and institution." },
    currentEmployer: { type: ["string", "null"] },
    location: { type: ["string", "null"], description: "City or province." },

    achievements: { type: "array", items: { type: "string" }, description: "Concrete accomplishments the CV claims — targets hit, systems delivered, teams led. Quote the substance, not the adjectives." },
    certifications: { type: "array", items: { type: "string" }, description: "Named certifications and licences, with the issuing body where given." },
    languages: { type: "array", items: { type: "string" }, description: "Languages the CV says they speak." },
    awards: { type: "array", items: { type: "string" } },
    publicSites: { type: "array", items: { type: "string" }, description: "Links the candidate themselves put on the CV — LinkedIn, portfolio, GitHub. Only what is printed on the document." },
    compensationNoted: { type: ["string", "null"], description: "Any salary or rate the document states. Null if it says none." },

    employmentGaps: { type: "array", items: { type: "string" }, description: "Unexplained breaks of a year or more between dated posts, as 'YYYY–YYYY'. Empty if the dates are continuous or too vague to tell." },
    shortTenures: { type: "array", items: { type: "string" }, description: "Posts held under a year, as 'Company (YYYY–YYYY)'. State them plainly; do not editorialise." },
    documentConcerns: { type: "array", items: { type: "string" }, description: "Internal contradictions in the document itself — overlapping dates, a claimed degree with no institution, a role that predates the stated career start. Only what the document contradicts about itself." },

    history: {
      type: "array",
      description: "Every post in the employment history, most recent first.",
      items: {
        type: "object",
        properties: {
          yearFrom: { type: ["integer", "null"] },
          yearTo: { type: ["integer", "null"], description: "Null if the post is current." },
          companyName: { type: "string" },
          position: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          country: { type: ["string", "null"] },
          duties: { type: ["string", "null"], description: "Duties and responsibilities, condensed to a sentence or two." },
        },
        required: ["yearFrom", "yearTo", "companyName", "position", "city", "country", "duties"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "firstName", "lastName", "middleName", "email", "mobile", "position",
    "summary", "skills", "yearsExperience", "education", "currentEmployer", "location",
    "achievements", "certifications", "languages", "awards", "publicSites",
    "compensationNoted", "employmentGaps", "shortTenures", "documentConcerns", "history",
  ],
  additionalProperties: false,
} as const;

const PROMPT = `Read this CV and record what it says about the candidate.

Report only what the document states. Where a field is absent, return null or an
empty array rather than inferring it — a guessed email or an estimated salary is
worse than a blank, because someone downstream will treat it as fact.
yearsExperience may be worked out from dated employment history; leave it null if
the dates don't support it.

The assessment fields exist so a recruiter can see what the document actually
supports, so keep them factual: achievements are what the CV claims, quoted for
substance rather than adjectives; employmentGaps, shortTenures and
documentConcerns are observations about the dates and internal consistency of
this document, not judgements about the person. Do not infer character, ability
or risk. Do not guess at anything the document does not say — you are reading one
file, not researching a person.`;

/** The key lives in the Setting table so it can be rotated without a redeploy. */
async function apiKey(): Promise<string | undefined> {
  const row = await prisma.setting.findUnique({ where: { key: "anthropic_api_key" } }).catch(() => null);
  return row?.value || process.env.ANTHROPIC_API_KEY || undefined;
}

export async function cvParsingConfigured(): Promise<boolean> {
  return Boolean(await apiKey());
}

export async function parseCV(
  bytes: Buffer,
  fileName: string,
  mime: string,
): Promise<ParsedCV> {
  const key = await apiKey();
  if (!key) throw new Error("NO_API_KEY");

  const client = new Anthropic({ apiKey: key });
  const isPdf = mime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  // An image has to be read before it can be parsed. OCR is free and local,
  // so it runs first; only its output goes on to be turned into fields.
  if (isImage(fileName, mime)) {
    const { text: ocred, confidence } = await ocrImage(bytes);
    if (!looksLikeText(ocred)) throw new Error(`CV_OCR_POOR:${Math.round(confidence)}`);
    return parseText(client, `${fileName} (read by OCR, confidence ${Math.round(confidence)}%)`, ocred);
  }

  const content: Anthropic.ContentBlockParam[] = isPdf
    ? [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") },
        },
        { type: "text", text: PROMPT },
      ]
    : [
        {
          type: "text",
          text: `${PROMPT}\n\n--- CV: ${fileName} ---\n${await toText(bytes, fileName)}`,
        },
      ];

  const res = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content }],
  });

  if (res.stop_reason === "refusal") throw new Error("CV_REFUSED");

  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new Error("CV_NO_OUTPUT");
  return JSON.parse(text) as ParsedCV;
}

async function toText(bytes: Buffer, fileName: string): Promise<string> {
  if (/\.docx?$/i.test(fileName)) {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return value;
  }
  if (/\.xlsx?$/i.test(fileName)) {
    // A CV in a spreadsheet is unusual but happens — read every sheet as rows.
    const wb = XLSX.read(bytes, { type: "buffer" });
    return wb.SheetNames.map(
      (n) => `--- ${n} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`,
    ).join("\n\n");
  }
  // .txt, .rtf and anything else legible as plain text.
  return bytes.toString("utf8");
}

/** Turns already-extracted text into fields. */
async function parseText(client: Anthropic, label: string, body: string): Promise<ParsedCV> {
  const res = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: [{ type: "text", text: `${PROMPT}\n\n--- CV: ${label} ---\n${body}` }] }],
  });
  if (res.stop_reason === "refusal") throw new Error("CV_REFUSED");
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new Error("CV_NO_OUTPUT");
  return JSON.parse(text) as ParsedCV;
}

/**
 * Text out of a document, without calling anything paid. Returns null when the
 * file yields nothing legible — a scanned PDF has no text layer, and rendering
 * its pages to images for OCR needs a canvas this runtime does not have.
 */
export async function extractTextFree(
  bytes: Buffer,
  fileName: string,
  mime?: string | null,
): Promise<{ text: string; how: string } | null> {
  if (isImage(fileName, mime)) {
    const { text, confidence } = await ocrImage(bytes);
    return looksLikeText(text) ? { text, how: `OCR, ${Math.round(confidence)}% confidence` } : null;
  }
  if (mime === "application/pdf" || /\.pdf$/i.test(fileName)) {
    const text = await readPdfText(bytes).catch(() => "");
    return looksLikeText(text) ? { text, how: "PDF text layer" } : null;
  }
  const text = await toText(bytes, fileName);
  return looksLikeText(text) ? { text, how: "document text" } : null;
}
