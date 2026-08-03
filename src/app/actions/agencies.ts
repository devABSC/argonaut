"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { isAgency, AGENCY_SLUG, type Agency } from "@/lib/agencies";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

function rate(f: FormData, k: string): number | null {
  const n = Number(String(f.get(k) ?? "").replace(/[%\s]/g, "").trim());
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

function day(f: FormData, k: string): number | null {
  const n = Math.floor(Number(String(f.get(k) ?? "").trim()));
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
}

/**
 * Save one agency's connection details.
 *
 * Owner only: these are the company's identity with a government agency, and
 * the password field is a convenience for whoever files — nothing here logs in
 * by itself.
 */
export async function saveAgencyLink(agency: string, formData: FormData) {
  const u = await requireUser();
  if (u.role !== "SUPER_USER") throw new Error("FORBIDDEN");
  if (!isAgency(agency)) return;

  const path = `/admin/${AGENCY_SLUG[agency as Agency]}`;

  // A blank password means "leave it alone", not "clear it" — the field is
  // rendered empty on purpose, since it is never shown back.
  const secret = String(formData.get("portalSecret") ?? "").trim();

  const data = {
    employerNumber: text(formData, "employerNumber"),
    branchCode: text(formData, "branchCode"),
    registeredName: text(formData, "registeredName"),
    portalUrl: text(formData, "portalUrl"),
    portalUsername: text(formData, "portalUsername"),
    ...(secret ? { portalSecret: secret } : {}),
    employeeRate: rate(formData, "employeeRate"),
    employerRate: rate(formData, "employerRate"),
    dueDayFrom: day(formData, "dueDayFrom"),
    dueDayTo: day(formData, "dueDayTo"),
    contactName: text(formData, "contactName"),
    contactEmail: text(formData, "contactEmail"),
    notes: text(formData, "notes"),
    updatedById: u.id,
    updatedByName: u.name,
  };

  await prisma.agencyLink.upsert({
    where: { agency },
    update: data,
    create: { agency, ...data },
  });

  revalidatePath(path);
  await logHistory({ type: "update", module: `ADMIN > ${agency}`, description: `Saved the ${agency} connection details`, user: u });
  done(path, `${agency} connection saved.`);
}

/** Forget the stored portal password without touching anything else. */
export async function clearAgencySecret(agency: string) {
  const u = await requireUser();
  if (u.role !== "SUPER_USER") throw new Error("FORBIDDEN");
  if (!isAgency(agency)) return;

  const path = `/admin/${AGENCY_SLUG[agency as Agency]}`;
  await prisma.agencyLink.updateMany({ where: { agency }, data: { portalSecret: null } });

  revalidatePath(path);
  await logHistory({ type: "update", module: `ADMIN > ${agency}`, description: `Cleared the stored ${agency} password`, user: u });
  done(path, `${agency} password cleared.`);
}
