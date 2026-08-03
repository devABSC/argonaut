import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";

/**
 * A hiring assessment built from the candidate's own CV.
 *
 * It costs real money per run, so it is never automatic — a recruiter presses
 * the button. The result is stored whole, so the tab renders without calling
 * again.
 */

export type Assessment = {
  fitSummary: string;
  strengths: string[];
  depthBySkill: {
    skill: string;
    evidence: string;
    yearsEvidenced: number | null;
    confidence: "strong" | "claimed" | "mentioned only";
  }[];
  trajectory: string;
  hiringRisks: {
    risk: string;
    basis: string;
    severity: "low" | "medium" | "high";
    howToTest: string;
  }[];
  verifyThese: string[];
  interviewQuestions: string[];
  roleFit: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    fitSummary: { type: "string", description: "Three or four sentences: what this candidate is, and what they would be good and bad at." },
    strengths: { type: "array", items: { type: "string" }, description: "What the document genuinely evidences, each tied to the post that shows it." },
    depthBySkill: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          evidence: { type: "string", description: "Which post or project shows it." },
          yearsEvidenced: { type: ["integer", "null"], description: "Years the dated history supports; null if the CV does not show it." },
          confidence: { type: "string", enum: ["strong", "claimed", "mentioned only"] },
        },
        required: ["skill", "evidence", "yearsEvidenced", "confidence"],
        additionalProperties: false,
      },
    },
    trajectory: { type: "string", description: "How the career has moved — direction, pace, and any plateau or step change." },
    hiringRisks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          risk: { type: "string" },
          basis: { type: "string", description: "What in the document supports this. Cite the line." },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          howToTest: { type: "string", description: "A specific question or check that would settle it at interview." },
        },
        required: ["risk", "basis", "severity", "howToTest"],
        additionalProperties: false,
      },
    },
    verifyThese: { type: "array", items: { type: "string" }, description: "Factual claims worth verifying with the issuer or previous employer." },
    interviewQuestions: { type: "array", items: { type: "string" }, description: "Questions that would discriminate between a strong and a weak version of this candidate. Specific, not generic." },
    roleFit: { type: "string", description: "How well this person fits the role described, and where they would struggle." },
  },
  required: ["fitSummary", "strengths", "depthBySkill", "trajectory", "hiringRisks", "verifyThese", "interviewQuestions", "roleFit"],
  additionalProperties: false,
} as const;

const GUARD = `You are assessing a candidate for a hiring decision. Everything below was extracted from the CV the candidate themselves submitted.

Assess only what this document supports. Every claim must trace to something in it — cite the post or line. Do not infer character, honesty, or personal circumstances, and do not speculate about anything the document does not say. Where the document is silent, say it is silent.

"Risks" means hiring risks a manager should test at interview — capability gaps, unverified claims, availability questions — never judgements about the person.`;

export async function assessCandidate(
  candidateId: string,
  role: string,
): Promise<{
  assessment: Assessment;
  inputTokens: number;
  outputTokens: number;
  model: string;
}> {
  const key =
    (await prisma.setting.findUnique({ where: { key: "anthropic_api_key" } }).catch(() => null))?.value ||
    process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("NO_API_KEY");

  const c = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { experience: { orderBy: { yearFrom: "desc" } } },
  });
  if (!c) throw new Error("NO_CANDIDATE");
  if (!c.parsedAt) throw new Error("CV_NOT_READ");

  const dossier = JSON.stringify(
    {
      name: [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" "),
      position: c.position,
      yearsClaimed: c.yearsExperience,
      education: c.education,
      currentEmployer: c.currentEmployer,
      skills: c.skills,
      summary: c.summary,
      findings: c.aiData,
      history: c.experience.map((e) => ({
        from: e.yearFrom, to: e.yearTo, company: e.companyName,
        position: e.position, duties: e.duties,
      })),
    },
    null,
    1,
  );

  const client = new Anthropic({ apiKey: key });
  const res = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${GUARD}\n\nThe role in question: ${role}\n\n--- CANDIDATE DOSSIER ---\n${dossier}`,
          },
        ],
      },
    ],
  });

  if (res.stop_reason === "refusal") throw new Error("ASSESS_REFUSED");
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new Error("ASSESS_NO_OUTPUT");

  return {
    assessment: JSON.parse(text) as Assessment,
    inputTokens: res.usage.input_tokens ?? 0,
    outputTokens: res.usage.output_tokens ?? 0,
    model: res.model,
  };
}
