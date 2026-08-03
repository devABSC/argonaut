import { NextRequest } from "next/server";

// PDF generation needs Node, not the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The standalone build carries its font metrics inside the bundle. The plain
// import reads .afm files from disk at runtime, which the serverless bundler
// does not trace — it works locally and 500s in production.
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/guard";
import { fmtCost } from "@/lib/cost";
import type { Assessment } from "@/lib/assess";

/**
 * The whole candidate as one PDF — every tab in the order a reader needs them.
 *
 * Owner only. It gathers a person's contact details, employment history,
 * statutory document numbers and an assessment into a single file that can
 * leave the system, which is a different thing from viewing those tabs behind
 * a login.
 */

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "—");
const when = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-GB", { timeZone: "Asia/Manila", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { user } = await requireAccess("recruitment", "candidates");
  if (user.role !== "SUPER_USER") return new Response("Not found", { status: 404 });

  const c = await prisma.candidate.findUnique({
    where: { id },
    include: {
      recruiter: { select: { name: true } },
      bou: { select: { name: true } },
      experience: { orderBy: { yearFrom: "desc" } },
      references: { orderBy: { createdAt: "asc" } },
      preJoDocs: { orderBy: { docType: "asc" } },
      verifyItems: { orderBy: { createdAt: "asc" } },
      assessments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!c) return new Response("Not found", { status: 404 });

  const a = c.assessment as Assessment | null;
  const ai = (c.aiData ?? {}) as Record<string, unknown>;
  const list = (k: string) => (Array.isArray(ai[k]) ? (ai[k] as string[]) : []);

  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (b: Buffer) => chunks.push(b));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const W = doc.page.width - 96;
  const H1 = (t: string) => doc.moveDown(0.9).fontSize(13).fillColor("#111").font("Helvetica-Bold").text(t).moveDown(0.3);
  const P = (t: string) => doc.fontSize(9.5).fillColor("#222").font("Helvetica").text(t, { width: W });
  const Muted = (t: string) => doc.fontSize(8.5).fillColor("#666").font("Helvetica").text(t, { width: W });
  const KV = (k: string, v: string | null | undefined) => {
    doc.fontSize(9).fillColor("#666").font("Helvetica").text(`${k}  `, { continued: true });
    doc.fillColor("#111").font("Helvetica-Bold").text(v && String(v).trim() ? String(v) : "—");
  };
  const Bullets = (items: string[]) => {
    if (!items.length) return Muted("None recorded.");
    for (const x of items) doc.fontSize(9.5).fillColor("#222").font("Helvetica").text(`•  ${x}`, { width: W, indent: 4 }).moveDown(0.15);
  };
  const Rule = () => {
    doc.moveDown(0.4);
    doc.strokeColor("#ddd").lineWidth(0.5).moveTo(48, doc.y).lineTo(48 + W, doc.y).stroke();
    doc.moveDown(0.4);
  };

  // --- cover ---
  doc.fontSize(8).fillColor("#888").font("Helvetica").text("ARGONAUT · CANDIDATE DOSSIER");
  doc.moveDown(0.3);
  doc.fontSize(22).fillColor("#111").font("Helvetica-Bold")
     .text([c.lastName, c.firstName].filter(Boolean).join(", ") + (c.middleName ? ` ${c.middleName}` : ""));
  doc.fontSize(11).fillColor("#444").font("Helvetica").text(c.position ?? "No position stated");
  doc.moveDown(0.6);
  Muted(`Generated ${when(new Date())} by ${user.name} · confidential`);
  Rule();

  H1("Personal Info");
  KV("Email", c.email); KV("Mobile", c.mobile); KV("Location", c.location);
  KV("Current employer", c.currentEmployer); KV("Education", c.education);
  KV("Years of experience", c.yearsExperience?.toString());
  KV("Stage", c.stage); KV("Applied", day(c.appliedAt));
  KV("BOU", c.bou?.name); KV("Recruiter", c.recruiter?.name);
  KV("CV on file", c.cvFileName);
  KV("CV read", when(c.parsedAt));

  if (c.summary) { H1("Summary"); P(c.summary); }

  H1(`Work Experience (${c.experience.length})`);
  if (!c.experience.length) Muted("Nothing on file.");
  for (const e of c.experience) {
    doc.fontSize(10).fillColor("#111").font("Helvetica-Bold")
       .text(`${e.yearFrom ?? "?"}–${e.yearTo ?? "present"}   ${e.companyName}`);
    doc.fontSize(9).fillColor("#444").font("Helvetica")
       .text([e.position, [e.city, e.country].filter(Boolean).join(", ")].filter(Boolean).join(" · "));
    if (e.duties) doc.fontSize(9).fillColor("#333").text(e.duties, { width: W });
    doc.moveDown(0.4);
  }

  H1(`Skills (${c.skills.length})`);
  P(c.skills.length ? c.skills.join(" · ") : "None listed.");

  H1("Other AI Data");
  for (const [label, key] of [["Achievements","achievements"],["Certifications","certifications"],["Awards","awards"],["Languages","languages"],["Links on the CV","publicSites"]] as const) {
    doc.moveDown(0.3).fontSize(9.5).fillColor("#666").font("Helvetica-Bold").text(label);
    Bullets(list(key));
  }
  const flags = [...list("employmentGaps").map((x) => `Gap: ${x}`), ...list("shortTenures").map((x) => `Short tenure: ${x}`), ...list("documentConcerns").map((x) => `Document: ${x}`)];
  doc.moveDown(0.3).fontSize(9.5).fillColor("#666").font("Helvetica-Bold").text("Observations on the document");
  Bullets(flags);
  if (c.aiNotes) { doc.moveDown(0.3).fontSize(9.5).fillColor("#666").font("Helvetica-Bold").text("Recruiter notes"); P(c.aiNotes); }

  H1(`Character References (${c.references.length})`);
  if (!c.references.length) Muted("None on file.");
  for (const r of c.references) {
    doc.fontSize(10).fillColor("#111").font("Helvetica-Bold").text(r.name);
    doc.fontSize(9).fillColor("#444").font("Helvetica")
       .text([r.relationship, r.company, r.position].filter(Boolean).join(" · ") || "—");
    doc.fontSize(9).fillColor("#666").text([r.contactNo, r.email].filter(Boolean).join(" · ") || "—");
    doc.fontSize(9).fillColor("#333").text(`Checked: ${r.contactedAt ? day(r.contactedAt) : "not yet"}${r.remarks ? ` — ${r.remarks}` : ""}`, { width: W });
    doc.moveDown(0.4);
  }

  H1(`PreJO Docs (${c.preJoDocs.length})`);
  if (!c.preJoDocs.length) Muted("Nothing logged.");
  for (const d of c.preJoDocs) {
    doc.fontSize(9.5).fillColor("#111").font("Helvetica-Bold").text(`${d.docType}  —  ${d.status}`);
    doc.fontSize(9).fillColor("#444").font("Helvetica")
       .text([d.refNo && `Ref ${d.refNo}`, d.issuer, d.issuedAt && `issued ${day(d.issuedAt)}`, d.expiresAt && `expires ${day(d.expiresAt)}`].filter(Boolean).join(" · ") || "—");
    doc.moveDown(0.3);
  }

  if (a) {
    doc.addPage();
    doc.fontSize(8).fillColor("#888").font("Helvetica").text("ARGONAUT AI ANALYTICS");
    H1("Assessment");
    P(a.fitSummary);
    doc.moveDown(0.4); doc.fontSize(9.5).fillColor("#666").font("Helvetica-Bold").text("Fit for the role"); P(a.roleFit);
    doc.moveDown(0.4); doc.fontSize(9.5).fillColor("#666").font("Helvetica-Bold").text("Trajectory"); P(a.trajectory);
    doc.moveDown(0.4); doc.fontSize(9.5).fillColor("#666").font("Helvetica-Bold").text("What the CV evidences"); Bullets(a.strengths);

    H1("Skill depth");
    for (const d of a.depthBySkill) {
      doc.fontSize(9.5).fillColor("#111").font("Helvetica-Bold")
         .text(`${d.skill}  —  ${d.confidence}${d.yearsEvidenced ? `, ${d.yearsEvidenced} yr` : ""}`);
      doc.fontSize(9).fillColor("#444").font("Helvetica").text(d.evidence, { width: W }).moveDown(0.25);
    }

    H1("Risks to test");
    for (const r of a.hiringRisks) {
      doc.fontSize(9.5).fillColor("#111").font("Helvetica-Bold").text(`[${r.severity.toUpperCase()}] ${r.risk}`);
      doc.fontSize(9).fillColor("#444").font("Helvetica").text(r.basis, { width: W });
      doc.fontSize(9).fillColor("#222").text(`How to test: ${r.howToTest}`, { width: W }).moveDown(0.35);
    }

    // The checklist rows, where two people have answered, beat the raw lists.
    const verify = c.verifyItems.filter((v) => v.kind === "verify");
    const asked = c.verifyItems.filter((v) => v.kind === "question");

    H1("Verify these");
    if (verify.length) {
      for (const v of verify) {
        doc.fontSize(9.5).fillColor("#111").font("Helvetica-Bold").text(`${v.item}  —  ${v.status}`, { width: W });
        if (v.recruiterRemarks) doc.fontSize(9).fillColor("#444").font("Helvetica").text(`Recruiter: ${v.recruiterRemarks}`, { width: W });
        if (v.managerRemarks) doc.fontSize(9).fillColor("#444").font("Helvetica").text(`Hiring manager: ${v.managerRemarks}`, { width: W });
        doc.moveDown(0.3);
      }
    } else Bullets(a.verifyThese);

    H1("Interview questions");
    if (asked.length) {
      asked.forEach((v, i) => {
        doc.fontSize(9.5).fillColor("#111").font("Helvetica-Bold").text(`${i + 1}. ${v.item}`, { width: W });
        if (v.recruiterRemarks) doc.fontSize(9).fillColor("#444").font("Helvetica").text(`Recruiter: ${v.recruiterRemarks}`, { width: W });
        if (v.managerRemarks) doc.fontSize(9).fillColor("#444").font("Helvetica").text(`Hiring manager: ${v.managerRemarks}`, { width: W });
        doc.moveDown(0.3);
      });
    } else a.interviewQuestions.forEach((q, i) => doc.fontSize(9.5).fillColor("#222").font("Helvetica").text(`${i + 1}. ${q}`, { width: W }).moveDown(0.15));

    const run = c.assessments[0];
    if (run) {
      Rule();
      Muted(`Assessed against "${run.role}" · ${when(run.createdAt)} · ${run.model ?? ""} · ${fmtCost(run.inputTokens ?? 0, run.outputTokens ?? 0)} · run by ${run.runByName || "—"}`);
    }
  }

  // Page numbers, once the page count is known.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fontSize(7.5).fillColor("#999").font("Helvetica")
       .text(`${c.firstName} ${c.lastName} · confidential · page ${i + 1} of ${range.count}`,
             48, doc.page.height - 34, { width: W, align: "center" });
  }

  doc.end();
  const pdf = await done;

  const safe = `${c.lastName}-${c.firstName}`.replace(/[^A-Za-z0-9-]/g, "") || "candidate";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dossier-${safe}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
