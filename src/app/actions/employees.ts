"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";

const PATH = "/hris/employees";

async function requireHrAdmin() {
  const u = await requireUser();
  if (!canManageUsers({ id: u.id, role: u.role }) && u.role !== "HR_SUPERVISOR") {
    throw new Error("FORBIDDEN");
  }
  return u;
}

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const date = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  return isNaN(+d) ? null : d;
};

/** YYMMDD-NNNNN, matching the source system's shape. */
async function nextEmployeeId(start: Date): Promise<string> {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila", year: "2-digit", month: "2-digit", day: "2-digit",
  }).formatToParts(start);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  const prefix = `${get("year")}${get("month")}${get("day")}-`;

  const used = await prisma.employee.count({ where: { individ: { startsWith: prefix } } });
  return `${prefix}${String(used + 1).padStart(5, "0")}`;
}

export async function createEmployee(formData: FormData) {
  await requireHrAdmin();

  const lastName = String(formData.get("lastName") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!lastName || !firstName) throw new Error("NAME_REQUIRED");

  const startDate = date(formData, "startDate") ?? new Date();
  const supplied = text(formData, "individ");
  const individ = supplied ?? (await nextEmployeeId(startDate));

  if (await prisma.employee.findUnique({ where: { individ } })) {
    throw new Error("EMPLOYEE_ID_TAKEN");
  }

  // rowid is the source system's key; new joiners get one past the highest.
  const top = await prisma.employee.findFirst({ orderBy: { rowid: "desc" }, select: { rowid: true } });

  await prisma.employee.create({
    data: {
      rowid: (top?.rowid ?? 0) + 1,
      individ,
      lastName,
      firstName,
      middleName: text(formData, "middleName"),
      emailAdd: text(formData, "emailAdd"),
      bouId: text(formData, "bouId"),
      subBou: text(formData, "subBou"),
      street: text(formData, "street"),
      city: text(formData, "city"),
      state: text(formData, "state"),
      startDate,
      birthDate: date(formData, "birthDate"),
      jobTitle: text(formData, "jobTitle"),
      empStatus: text(formData, "empStatus"),
      empType: text(formData, "empType"),
      mobile: text(formData, "mobile"),
      mobile2: text(formData, "mobile2"),
      landline: text(formData, "landline"),
      gender: text(formData, "gender"),
      endOfContract: date(formData, "endOfContract"),
      lastWorkingDate: date(formData, "lastWorkingDate"),
      terminationDate: date(formData, "terminationDate"),
      employmentStatus: text(formData, "employmentStatus") ?? "Active",
      remarks: text(formData, "remarks"),
      hasAccess: formData.get("hasAccess") === "on",
      hasExpense: formData.get("hasExpense") === "on",
      company: text(formData, "company"),
    },
  });

  revalidatePath(PATH);
}
