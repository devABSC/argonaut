"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const PATH = "/recruitment/jobs";

async function requireRecruiter() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role }) && u.role !== "HR_SUPERVISOR") {
    throw new Error("FORBIDDEN");
  }
  return u;
}

/** A job description is a document: Word, PDF, or plain text. */
const TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];
const MAX = 8 * 1024 * 1024;

export async function addJobReq(formData: FormData) {
  const me = await requireRecruiter();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) done(PATH, "Not added — a job needs a title.");

  const bouId = String(formData.get("bouId") ?? "").trim() || null;
  if (!bouId) done(PATH, "Not added — choose the BOU this job sits in.");

  // The description is optional: a role can be opened before its document is
  // written, and the file can be attached later.
  const file = formData.get("file");
  let doc = {};
  if (file instanceof File && file.size > 0) {
    if (!TYPES.includes(file.type)) done(PATH, "Not added — attach a PDF, Word or text file.");
    if (file.size > MAX) done(PATH, `Not added — that file is over ${MAX / 1024 / 1024} MB.`);
    doc = {
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      fileData: Buffer.from(await file.arrayBuffer()),
    };
  }

  await prisma.jobReq.create({
    data: { title, bouId, ...doc, createdById: me.id, createdByName: me.name },
  });

  revalidatePath(PATH);
  await logHistory({ type: "create", module: "ATS > Job Reqs", description: `Opened the job ${title}`, user: me });
  done(PATH, `${title} added.`);
}

export async function setJobReqOpen(formData: FormData) {
  const me = await requireRecruiter();
  const id = String(formData.get("jobId") ?? "").trim();
  const state = String(formData.get("state") ?? "");
  if (!id || (state !== "Open" && state !== "Closed")) return;

  const job = await prisma.jobReq.update({
    where: { id },
    data: { isOpen: state === "Open" },
    select: { title: true },
  });
  revalidatePath(PATH);
  await logHistory({ type: "update", module: "ATS > Job Reqs", description: `${job.title} → ${state}`, user: me });
  done(PATH, `${job.title} is now ${state.toLowerCase()}.`);
}

export async function deleteJobReq(id: string) {
  const me = await requireRecruiter();
  const job = await prisma.jobReq.findUnique({ where: { id }, select: { title: true } });
  if (!job) return;

  await prisma.jobReq.delete({ where: { id } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "ATS > Job Reqs", description: `Removed the job ${job.title}`, user: me });
  done(PATH, `${job.title} removed.`);
}
