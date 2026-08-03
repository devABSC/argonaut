import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { prisma } from "./prisma";

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
  },
  required: [
    "firstName", "lastName", "middleName", "email", "mobile", "position",
    "summary", "skills", "yearsExperience", "education", "currentEmployer", "location",
  ],
  additionalProperties: false,
} as const;

const PROMPT = `Read this CV and record what it says about the candidate.

Report only what the document states. Where a field is absent, return null rather
than inferring it — a guessed email or an estimated salary is worse than a blank,
because someone downstream will treat it as fact. yearsExperience may be worked
out from dated employment history; leave it null if the dates don't support it.`;

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
