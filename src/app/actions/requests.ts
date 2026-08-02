"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getStandardForm } from "@/lib/forms";

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Wall-clock parts in Manila time — Vercel runs in UTC, which would be 8h off. */
function manilaParts() {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    year: "2-digit", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { yy: get("year"), mm: get("month"), hh: get("hour"), mi: get("minute"), ss: get("second") };
}

/**
 * Ticket reference: YYMM-CCC-SSS-hhssNNNN — year, month, category code,
 * subtype code, then hour + seconds and a running series. The series restarts
 * each month per subtype, e.g. 2608-001-001-14070001.
 */
async function nextReference(subcategoryId: string, categoryCode: number, subCode: number) {
  const { yy, mm, hh, ss } = manilaParts();
  const prefix = `${yy}${mm}-${pad(categoryCode, 3)}-${pad(subCode, 3)}-`;

  // Counted rather than parsed off the last reference: the hhmmss segment makes
  // string ordering useless for finding the highest series.
  const used = await prisma.serviceRequest.count({
    where: { subcategoryId, reference: { startsWith: prefix } },
  });

  return `${prefix}${hh}${ss}${pad(used + 1, 4)}`;
}

export async function createRequest(formData: FormData) {
  const user = await requireUser();

  const subcategoryId = String(formData.get("subcategoryId") ?? "");
  if (!subcategoryId) throw new Error("NO_SUBCATEGORY");

  const sub = await prisma.requestSubcategory.findUnique({
    where: { id: subcategoryId },
    include: {
      category: { select: { name: true, code: true } },
      formType: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
      steps: { orderBy: { sequence: "asc" }, include: { approvers: true } },
    },
  });
  if (!sub || !sub.isActive) throw new Error("SUBCATEGORY_UNAVAILABLE");

  const standard = await getStandardForm();
  const fields = [...standard.fields, ...sub.formType.fields];

  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) throw new Error("SUBJECT_REQUIRED");
  const description = String(formData.get("description") ?? "").trim() || null;

  // Answers are posted as f_<fieldId> so a standard field and a form-specific
  // field can share a key without clobbering each other on the way in.
  const details: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = formData.get(`f_${f.id}`);
    const value = f.kind === "CHECKBOX" ? raw === "on" : String(raw ?? "").trim();

    if (f.required && (value === "" || value === false)) {
      throw new Error(`REQUIRED_FIELD:${f.label}`);
    }
    if (value !== "" && value !== false) details[f.key] = value;
  }

  // The service type and subtype are chosen in the picker, so record them
  // regardless of whether the form also carries lookup fields for them.
  details.__serviceType = sub.category.name;
  details.__serviceSubtype = sub.name;

  const reference = await nextReference(sub.id, sub.category.code, sub.code);

  const created = await prisma.serviceRequest.create({
    data: {
      reference,
      requesterId: user.id,
      subcategoryId: sub.id,
      subject,
      description,
      details: details as object,
      status: sub.steps.length > 0 ? "SUBMITTED" : "APPROVED",
      submittedAt: new Date(),
      closedAt: sub.steps.length > 0 ? null : new Date(),
      currentSequence: 1,
      // Snapshot the chain so later edits to the workflow cannot rewrite history.
      approvals: {
        // Only approver steps gate the ticket; a step with several approvers
        // yields one approval row each, ordered after its step.
        create: sub.steps
          .filter((st) => st.actor === "APPROVER")
          .flatMap((st, i) =>
            st.approvers.map((a, k) => ({
              sequence: (i + 1) * 100 + k,
              approverId: a.userId,
            })),
          ),
      },
    },
  });

  revalidatePath("/service-desk/my-requests");
  // Carries the reference so the list can confirm which ticket was raised.
  redirect(`/service-desk/my-requests?new=${encodeURIComponent(created.reference)}`);
}
