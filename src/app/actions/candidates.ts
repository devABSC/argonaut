"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { parseCV, type ParsedCV } from "@/lib/cv-parse";

const PATH = "/recruitment/candidates";
const MAX_BYTES = 10 * 1024 * 1024;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

/**
 * The parser returns more than the Candidate table holds — assessment findings
 * live in aiData, and the employment history becomes its own rows. Only these
 * are columns, so only these are written.
 */
function candidateColumns(p: ParsedCV) {
  return {
    firstName: p.firstName?.trim() || "Unnamed",
    lastName: p.lastName?.trim() || "Candidate",
    middleName: p.middleName ?? null,
    email: p.email ?? null,
    mobile: p.mobile ?? null,
    position: p.position ?? null,
    summary: p.summary ?? null,
    skills: p.skills ?? [],
    yearsExperience: p.yearsExperience ?? null,
    education: p.education ?? null,
    currentEmployer: p.currentEmployer ?? null,
    location: p.location ?? null,
  };
}

async function requireRecruiter() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role }) && u.role !== "HR_SUPERVISOR") {
    throw new Error("FORBIDDEN");
  }
  return u;
}

/**
 * Upload a CV, read it, and file the candidate.
 *
 * The document is stored whatever happens — a parse that fails must not lose
 * the CV, since a recruiter can always fill the details in by hand.
 */
export async function uploadCV(formData: FormData) {
  const me = await requireRecruiter();

  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) {
    done(PATH, "No file chosen — pick a CV to upload.");
  }
  if (file.size > MAX_BYTES) {
    done(PATH, `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let parsed = null;
  let failure: string | null = null;
  try {
    parsed = await parseCV(bytes, file.name, file.type);
  } catch (e) {
    failure = (e as Error).message;
  }

  // First to file owns the candidate. A second recruiter uploading the same
  // person is turned away rather than creating a duplicate pipeline — and is
  // not told whose it is, since that would leak another recruiter's list.
  if (parsed?.firstName?.trim() && parsed?.lastName?.trim()) {
    const taken = await prisma.candidate.findFirst({
      where: {
        firstName: { equals: parsed.firstName.trim(), mode: "insensitive" },
        lastName: { equals: parsed.lastName.trim(), mode: "insensitive" },
      },
      select: { id: true, recruiterId: true, recruiter: { select: { name: true } } },
    });
    if (taken) {
      done(
        PATH,
        taken.recruiterId === me.id
          ? `${parsed.firstName} ${parsed.lastName} is already on your list — open the record and use Read again to refresh it.`
          : `${parsed.firstName} ${parsed.lastName} is already filed by another recruiter. First to file keeps the candidate.`,
      );
    }
  }

  const candidate = await prisma.candidate.create({
    data: {
      ...(parsed ? candidateColumns(parsed) : { firstName: "Unnamed", lastName: "Candidate" }),
      parsedAt: parsed ? new Date() : null,
      aiData: parsed ?? undefined,
      cvData: bytes,
      cvFileName: file.name,
      cvMime: file.type || "application/octet-stream",
      cvSize: file.size,
      recruiterId: me.id,
      companyCode: me.company ?? null,
      experience: parsed?.history?.length
        ? { create: parsed.history.map((h) => ({ ...h })) }
        : undefined,
    },
  });

  revalidatePath(PATH);
  await logHistory({
    type: "create", module: "Recruitment > Candidates",
    description: parsed
      ? `Read CV ${file.name} — added ${candidate.firstName} ${candidate.lastName}`
      : `Stored CV ${file.name} unread (${failure})`,
    user: me,
  });

  if (parsed) {
    done(PATH, `${candidate.firstName} ${candidate.lastName} added from ${file.name}.`);
  }
  done(
    PATH,
    failure === "NO_API_KEY"
      ? `${file.name} saved, but no Anthropic API key is set — add one in Settings → Email to read CVs automatically.`
      : `${file.name} saved, but could not be read (${failure}). Fill the details in by hand.`,
  );
}

/** Re-read a CV already on file — after a parser change, or a first failure. */
export async function reparseCV(candidateId: string) {
  const me = await requireRecruiter();

  const c = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { cvData: true, cvFileName: true, cvMime: true },
  });
  if (!c?.cvData) done(PATH, "There is no CV on file for that candidate.");

  const where = `/recruitment/candidate/${candidateId}/personal-info`;
  try {
    const parsed = await parseCV(
      Buffer.from(c!.cvData!),
      c!.cvFileName ?? "cv.pdf",
      c!.cvMime ?? "application/pdf",
    );
    // History becomes its own rows and is replaced wholesale; the findings go
    // to aiData; only real columns are written to the candidate.
    await prisma.$transaction([
      prisma.candidate.update({
        where: { id: candidateId },
        data: { ...candidateColumns(parsed), parsedAt: new Date(), aiData: parsed },
      }),
      prisma.workExperience.deleteMany({ where: { candidateId } }),
      prisma.workExperience.createMany({
        data: (parsed.history ?? []).map((h) => ({ ...h, candidateId })),
      }),
    ]);
    revalidatePath(where);
    await logHistory({ type: "update", module: "Recruitment > Candidates", description: `Re-read CV for ${parsed.firstName} ${parsed.lastName}`, user: me });
    done(where, "CV read again — details refreshed.");
  } catch (e) {
    done(where, `Could not read that CV (${(e as Error).message}).`);
  }
}

export async function saveCandidate(formData: FormData) {
  const me = await requireRecruiter();

  const id = String(formData.get("candidateId") ?? "");
  if (!id) return;
  const existing = await prisma.candidate.findUnique({ where: { id }, select: { firstName: true } });
  if (!existing) return;

  await prisma.candidate.update({
    where: { id },
    data: {
      firstName: text(formData, "firstName") ?? existing.firstName,
      lastName: text(formData, "lastName") ?? "",
      email: text(formData, "email"),
      mobile: text(formData, "mobile"),
      position: text(formData, "position"),
      location: text(formData, "location"),
      currentEmployer: text(formData, "currentEmployer"),
      education: text(formData, "education"),
      source: text(formData, "source"),
      notes: text(formData, "notes"),
    },
  });

  const where = `/recruitment/candidate/${id}/personal-info`;
  revalidatePath(where);
  await logHistory({ type: "update", module: "Recruitment > Candidates", description: `Saved candidate ${id}`, user: me });
  done(where, "Candidate saved.");
}

export async function setCandidateStage(formData: FormData) {
  const me = await requireRecruiter();

  const id = String(formData.get("candidateId") ?? "");
  const stage = String(formData.get("stage") ?? "").trim();
  if (!id || !stage) return;

  const c = await prisma.candidate.update({
    where: { id },
    data: { stage, hiredAt: stage === "Hired" ? new Date() : null },
    select: { firstName: true, lastName: true },
  });

  revalidatePath(PATH);
  await logHistory({ type: "update", module: "Recruitment > Candidates", description: `${c.firstName} ${c.lastName} moved to ${stage}`, user: me });
  done(PATH, `${c.firstName} ${c.lastName} → ${stage}.`);
}

export async function deleteCandidate(candidateId: string) {
  const me = await requireRecruiter();
  const c = await prisma.candidate.delete({ where: { id: candidateId }, select: { firstName: true, lastName: true } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Recruitment > Candidates", description: `Deleted candidate ${c.firstName} ${c.lastName}`, user: me });
  done(PATH, `${c.firstName} ${c.lastName} deleted.`);
}

/* ---------- work experience ---------- */

const at = (id: string) => `/recruitment/candidate/${id}/work-experience`;

const year = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  // A four-digit year within living memory; anything else is a typo.
  return Number.isInteger(n) && n >= 1950 && n <= new Date().getFullYear() + 1 ? n : null;
};

export async function addExperience(formData: FormData) {
  const me = await requireRecruiter();

  const candidateId = String(formData.get("candidateId") ?? "");
  const companyName = String(formData.get("companyName") ?? "").trim();
  if (!candidateId) return;
  if (!companyName) done(at(candidateId), "Not added — a post needs a company name.");

  const yearFrom = year(formData, "yearFrom");
  const yearTo = year(formData, "yearTo");
  if (yearFrom && yearTo && yearTo < yearFrom) {
    done(at(candidateId), "Not added — the end year is before the start year.");
  }

  await prisma.workExperience.create({
    data: {
      candidateId, companyName, yearFrom, yearTo,
      position: text(formData, "position"),
      city: text(formData, "city"),
      country: text(formData, "country"),
      duties: text(formData, "duties"),
    },
  });

  revalidatePath(at(candidateId));
  await logHistory({ type: "create", module: "Recruitment > Work Experience", description: `Added ${companyName} to a candidate`, user: me });
  done(at(candidateId), `${companyName} added.`);
}

export async function deleteExperience(experienceId: string) {
  const me = await requireRecruiter();
  const row = await prisma.workExperience.delete({
    where: { id: experienceId },
    select: { candidateId: true, companyName: true },
  });
  revalidatePath(at(row.candidateId));
  await logHistory({ type: "delete", module: "Recruitment > Work Experience", description: `Removed ${row.companyName} from a candidate`, user: me });
  done(at(row.candidateId), `${row.companyName} removed.`);
}

/* ---------- character references ---------- */

const refAt = (id: string) => `/recruitment/candidate/${id}/char-ref`;

export async function addReference(formData: FormData) {
  const me = await requireRecruiter();

  const candidateId = String(formData.get("candidateId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!candidateId) return;
  if (!name) done(refAt(candidateId), "Not added — a reference needs a name.");

  await prisma.characterReference.create({
    data: {
      candidateId, name,
      relationship: text(formData, "relationship"),
      company: text(formData, "company"),
      position: text(formData, "position"),
      contactNo: text(formData, "contactNo"),
      email: text(formData, "email"),
      remarks: text(formData, "remarks"),
    },
  });

  revalidatePath(refAt(candidateId));
  await logHistory({ type: "create", module: "Recruitment > Char Ref", description: `Added reference ${name} to a candidate`, user: me });
  done(refAt(candidateId), `${name} added.`);
}

/** Records that the reference was reached, and what they said. */
export async function markReferenceContacted(formData: FormData) {
  const me = await requireRecruiter();

  const id = String(formData.get("referenceId") ?? "");
  if (!id) return;

  const before = await prisma.characterReference.findUnique({
    where: { id },
    select: { candidateId: true, name: true, contactedAt: true },
  });
  if (!before) return;

  const r = await prisma.characterReference.update({
    where: { id },
    data: {
      remarks: text(formData, "remarks"),
      contactedAt: before.contactedAt ?? new Date(),
    },
  });

  revalidatePath(refAt(r.candidateId));
  await logHistory({ type: "update", module: "Recruitment > Char Ref", description: `Recorded a check on ${before.name}`, user: me });
  done(refAt(r.candidateId), `${before.name} — check recorded.`);
}

export async function deleteReference(referenceId: string) {
  const me = await requireRecruiter();
  const r = await prisma.characterReference.delete({
    where: { id: referenceId },
    select: { candidateId: true, name: true },
  });
  revalidatePath(refAt(r.candidateId));
  await logHistory({ type: "delete", module: "Recruitment > Char Ref", description: `Removed reference ${r.name}`, user: me });
  done(refAt(r.candidateId), `${r.name} removed.`);
}

/** A recruiter's notes against the AI findings. */
export async function saveAiNotes(formData: FormData) {
  const me = await requireRecruiter();

  const id = String(formData.get("candidateId") ?? "");
  if (!id) return;
  const c = await prisma.candidate.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
  if (!c) return;

  await prisma.candidate.update({ where: { id }, data: { aiNotes: text(formData, "aiNotes") } });

  const where = `/recruitment/candidate/${id}/ai-data`;
  revalidatePath(where);
  await logHistory({
    type: "update", module: "Recruitment > Other AI Data",
    description: `Noted findings for ${c.firstName} ${c.lastName}`, user: me,
  });
  done(where, "Notes saved.");
}

/* ---------- pre-job-offer documents ---------- */

const docAt = (id: string) => `/recruitment/candidate/${id}/prejo-docs`;

const day = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  if (!v) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return isNaN(+d) ? null : d;
};

export async function addPreJoDoc(formData: FormData) {
  const me = await requireRecruiter();

  const candidateId = String(formData.get("candidateId") ?? "");
  const docType = String(formData.get("docType") ?? "").trim();
  if (!candidateId) return;
  if (!docType) done(docAt(candidateId), "Not added — choose a document type.");

  const issuedAt = day(formData, "issuedAt");
  const expiresAt = day(formData, "expiresAt");
  if (issuedAt && expiresAt && expiresAt < issuedAt) {
    done(docAt(candidateId), "Not added — the expiry is before the issue date.");
  }

  // The file is optional: a document can be logged as expected before it arrives.
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && file.size > MAX_BYTES) {
    done(docAt(candidateId), `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB.`);
  }
  const bytes = hasFile ? Buffer.from(await file.arrayBuffer()) : null;

  const status = String(formData.get("status") ?? "").trim() || (hasFile ? "Submitted" : "Pending");

  await prisma.preJoDoc.create({
    data: {
      candidateId, docType, status,
      refNo: text(formData, "refNo"),
      issuer: text(formData, "issuer"),
      issuedAt, expiresAt,
      remarks: text(formData, "remarks"),
      fileData: bytes,
      fileName: hasFile ? file.name : null,
      fileMime: hasFile ? file.type || "application/octet-stream" : null,
      fileSize: hasFile ? file.size : null,
    },
  });

  revalidatePath(docAt(candidateId));
  await logHistory({ type: "create", module: "Recruitment > PreJO Docs", description: `Logged ${docType} for a candidate`, user: me });
  done(docAt(candidateId), `${docType} logged.`);
}

/** Marks a document verified, recording who checked it and when. */
export async function setPreJoStatus(formData: FormData) {
  const me = await requireRecruiter();

  const id = String(formData.get("docId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) return;

  const verified = status === "Verified";
  const d = await prisma.preJoDoc.update({
    where: { id },
    data: {
      status,
      verifiedById: verified ? me.id : null,
      verifiedAt: verified ? new Date() : null,
    },
    select: { candidateId: true, docType: true },
  });

  revalidatePath(docAt(d.candidateId));
  await logHistory({ type: "update", module: "Recruitment > PreJO Docs", description: `${d.docType} → ${status}`, user: me });
  done(docAt(d.candidateId), `${d.docType} → ${status}.`);
}

export async function deletePreJoDoc(docId: string) {
  const me = await requireRecruiter();
  const d = await prisma.preJoDoc.delete({ where: { id: docId }, select: { candidateId: true, docType: true } });
  revalidatePath(docAt(d.candidateId));
  await logHistory({ type: "delete", module: "Recruitment > PreJO Docs", description: `Removed ${d.docType}`, user: me });
  done(docAt(d.candidateId), `${d.docType} removed.`);
}

/* ---------- Argonaut AI Analytics ---------- */

/**
 * Runs the hiring assessment. Costs a few cents per candidate, so it is never
 * automatic — a recruiter decides this one is worth it.
 */
export async function runAssessment(formData: FormData) {
  const me = await requireRecruiter();

  const id = String(formData.get("candidateId") ?? "");
  if (!id) return;
  const where = `/recruitment/candidate/${id}/assessment`;

  const role =
    String(formData.get("role") ?? "").trim() ||
    "the position the candidate applied for";

  try {
    const { assessCandidate } = await import("@/lib/assess");
    const { assessment, inputTokens, outputTokens, model } = await assessCandidate(id, role);
    const tokens = inputTokens + outputTokens;

    // Every run is kept. The candidate carries the latest for the tab to
    // render; the run row is the record of what was produced, when, against
    // which role and by whom — an assessment informs a hiring decision, so it
    // should not be silently replaced by the next one.
    const [c] = await prisma.$transaction([
      prisma.candidate.update({
        where: { id },
        data: { assessment, assessedAt: new Date(), assessTokens: tokens },
        select: { firstName: true, lastName: true },
      }),
      prisma.assessmentRun.create({
        data: {
          candidateId: id, role, result: assessment, model,
          inputTokens, outputTokens,
          runById: me.id, runByName: me.name,
        },
      }),
    ]);

    revalidatePath(where);
    await logHistory({
      type: "update", module: "Recruitment > Assessment",
      description: `Ran AI analytics on ${c.firstName} ${c.lastName} against "${role}" (${tokens} tokens)`,
      user: me,
    });
    done(where, `Assessment ready — ${tokens.toLocaleString()} tokens.`);
  } catch (e) {
    const m = (e as Error).message;
    done(
      where,
      m === "NO_API_KEY"
        ? "No Anthropic API key is set — add one under Settings → Email."
        : m === "CV_NOT_READ"
          ? "Read the CV first — the CV tab has a Read again button."
          : `Could not run the assessment (${m}).`,
    );
  }
}

/* ---------- verify items and interview questions ---------- */

const vAt = (id: string) => `/recruitment/candidate/${id}/assessment`;

/**
 * Copies the assessment's lists into rows that can be worked through.
 *
 * Existing rows are left alone — the remarks against them are the point, and a
 * re-run must not wipe what two people have already written. Only genuinely
 * new items are added.
 */
export async function seedVerifyItems(candidateId: string) {
  const me = await requireRecruiter();

  const c = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { assessment: true },
  });
  const a = c?.assessment as { verifyThese?: string[]; interviewQuestions?: string[] } | null;
  if (!a) done(vAt(candidateId), "Run the assessment first.");

  const wanted = [
    ...(a!.verifyThese ?? []).map((item) => ({ kind: "verify", item })),
    ...(a!.interviewQuestions ?? []).map((item) => ({ kind: "question", item })),
  ];

  const { count } = await prisma.verifyItem.createMany({
    data: wanted.map((w) => ({ ...w, candidateId })),
    skipDuplicates: true,
  });

  revalidatePath(vAt(candidateId));
  await logHistory({ type: "create", module: "Recruitment > Assessment", description: `Added ${count} items to check`, user: me });
  done(
    vAt(candidateId),
    count ? `${count} item${count === 1 ? "" : "s"} added to work through.` : "Nothing new — every item is already listed.",
  );
}

export async function saveVerifyItem(formData: FormData) {
  const me = await requireRecruiter();

  const id = String(formData.get("itemId") ?? "");
  if (!id) return;
  const before = await prisma.verifyItem.findUnique({ where: { id }, select: { candidateId: true } });
  if (!before) return;

  await prisma.verifyItem.update({
    where: { id },
    data: {
      recruiterRemarks: text(formData, "recruiterRemarks"),
      managerRemarks: text(formData, "managerRemarks"),
      status: String(formData.get("status") ?? "Open"),
    },
  });

  revalidatePath(vAt(before.candidateId));
  await logHistory({ type: "update", module: "Recruitment > Assessment", description: "Recorded remarks on an item", user: me });
  done(vAt(before.candidateId), "Remarks saved.");
}

export async function deleteVerifyItem(itemId: string) {
  const me = await requireRecruiter();
  const r = await prisma.verifyItem.delete({ where: { id: itemId }, select: { candidateId: true } });
  revalidatePath(vAt(r.candidateId));
  await logHistory({ type: "delete", module: "Recruitment > Assessment", description: "Removed an item", user: me });
  done(vAt(r.candidateId), "Item removed.");
}

/* ---------- candidate interview link ---------- */


const INVITE_DAYS = 14;

/**
 * Creates the link a candidate answers through.
 *
 * One live link at a time: issuing a new one revokes the last, so a link that
 * has been passed around cannot still be answered after it was replaced.
 */
export async function createInvite(formData: FormData) {
  const me = await requireRecruiter();

  const candidateId = String(formData.get("candidateId") ?? "");
  if (!candidateId) return;
  const where = vAt(candidateId);

  const questions = await prisma.verifyItem.count({ where: { candidateId, kind: "question" } });
  if (questions === 0) {
    done(where, "Add the interview questions to the checklist first — there is nothing to ask.");
  }

  await prisma.$transaction([
    prisma.candidateInvite.updateMany({
      where: { candidateId, revokedAt: null, submittedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.candidateInvite.create({
      data: {
        candidateId,
        // 32 bytes of randomness — the token is the only thing guarding the page.
        token: randomBytes(32).toString("base64url"),
        message: text(formData, "message"),
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
        createdById: me.id,
      },
    }),
  ]);

  revalidatePath(where);
  await logHistory({ type: "create", module: "Recruitment > Interview link", description: "Issued an interview link", user: me });
  done(where, `Link created — valid for ${INVITE_DAYS} days. Copy it and send it to the candidate.`);
}

export async function revokeInvite(inviteId: string) {
  const me = await requireRecruiter();
  const i = await prisma.candidateInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
    select: { candidateId: true },
  });
  revalidatePath(vAt(i.candidateId));
  await logHistory({ type: "update", module: "Recruitment > Interview link", description: "Revoked an interview link", user: me });
  done(vAt(i.candidateId), "Link revoked — it will no longer open.");
}

/* ---------- salary ---------- */

/** Blank stays blank — an empty expectation is not zero. */
const money = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").replace(/[^\d.-]/g, "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function saveSalary(formData: FormData) {
  const me = await requireRecruiter();

  const id = String(formData.get("candidateId") ?? "");
  if (!id) return;
  const c = await prisma.candidate.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
  if (!c) return;

  await prisma.candidate.update({
    where: { id },
    data: {
      currentSalary: money(formData, "currentSalary"),
      expectedSalary: money(formData, "expectedSalary"),
      offeredSalary: money(formData, "offeredSalary"),
      salaryPeriod: String(formData.get("salaryPeriod") ?? "Monthly"),
      salaryCurrency: String(formData.get("salaryCurrency") ?? "PHP").toUpperCase().slice(0, 3),
      salaryNotes: text(formData, "salaryNotes"),
    },
  });

  const where = `/recruitment/candidate/${id}/salary`;
  revalidatePath(where);
  await logHistory({
    type: "update", module: "Recruitment > Salary",
    description: `Saved salary details for ${c.firstName} ${c.lastName}`, user: me,
  });
  done(where, "Salary saved.");
}
