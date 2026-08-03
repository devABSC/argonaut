"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { parseCV } from "@/lib/cv-parse";

const PATH = "/recruitment/candidates";
const MAX_BYTES = 10 * 1024 * 1024;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

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

  const candidate = await prisma.candidate.create({
    data: {
      firstName: parsed?.firstName?.trim() || "Unnamed",
      lastName: parsed?.lastName?.trim() || "Candidate",
      middleName: parsed?.middleName ?? null,
      email: parsed?.email ?? null,
      mobile: parsed?.mobile ?? null,
      position: parsed?.position ?? null,
      summary: parsed?.summary ?? null,
      skills: parsed?.skills ?? [],
      yearsExperience: parsed?.yearsExperience ?? null,
      education: parsed?.education ?? null,
      currentEmployer: parsed?.currentEmployer ?? null,
      location: parsed?.location ?? null,
      parsedAt: parsed ? new Date() : null,
      cvData: bytes,
      cvFileName: file.name,
      cvMime: file.type || "application/octet-stream",
      cvSize: file.size,
      recruiterId: me.id,
      companyCode: me.company ?? null,
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
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { ...parsed, parsedAt: new Date() },
    });
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
