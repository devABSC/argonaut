"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";

const PATH = "/finance/bir-forms";

async function requireFinanceUser() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role })) throw new Error("FORBIDDEN");
  return u;
}

/** A blank form is a spreadsheet, a PDF or a Word document. */
const TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];
const MAX = 8 * 1024 * 1024;

export async function addBirForm(formData: FormData) {
  const me = await requireFinanceUser();

  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!code || !description) done(PATH, "Not added — a form needs a number and a description.");

  if (await prisma.birForm.findUnique({ where: { code }, select: { id: true } })) {
    done(PATH, `Not added — form ${code} is already listed.`);
  }

  // The blank is optional: a form can be listed before its file is to hand.
  const file = formData.get("file");
  let blank = {};
  if (file instanceof File && file.size > 0) {
    if (!TYPES.includes(file.type)) done(PATH, "Not added — attach an Excel, PDF or Word file.");
    if (file.size > MAX) done(PATH, `Not added — that file is over ${MAX / 1024 / 1024} MB.`);
    blank = {
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      fileData: Buffer.from(await file.arrayBuffer()),
    };
  }

  await prisma.birForm.create({
    data: { code, description, ...blank, uploadedById: me.id, uploadedByName: me.name },
  });

  revalidatePath(PATH);
  await logHistory({ type: "create", module: "Finance > BIR", description: `Listed BIR form ${code}`, user: me });
  done(PATH, `Form ${code} added.`);
}

export async function deleteBirForm(id: string) {
  const me = await requireFinanceUser();
  const f = await prisma.birForm.findUnique({ where: { id }, select: { code: true } });
  if (!f) return;

  await prisma.birForm.delete({ where: { id } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Finance > BIR", description: `Removed BIR form ${f.code}`, user: me });
  done(PATH, `Form ${f.code} removed.`);
}
