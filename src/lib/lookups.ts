import { prisma } from "./prisma";

/**
 * Sources a TABLE field can draw its choices from. The values are read live at
 * render time, so a field stays in step with the catalogue instead of holding a
 * copy that goes stale.
 */
export const LOOKUPS = [
  { key: "SERVICE_TYPE", label: "Service Type", table: "RequestCategory" },
  { key: "SERVICE_SUBTYPE", label: "Service Subtype", table: "RequestSubcategory" },
  { key: "USER", label: "Users", table: "User" },
] as const;

export type LookupKey = (typeof LOOKUPS)[number]["key"];

export function isLookupKey(v: unknown): v is LookupKey {
  return typeof v === "string" && LOOKUPS.some((l) => l.key === v);
}

export function lookupLabel(key: string | null): string | null {
  return LOOKUPS.find((l) => l.key === key)?.label ?? null;
}

export async function lookupValues(key: string | null): Promise<string[]> {
  switch (key) {
    case "SERVICE_TYPE":
      return (
        await prisma.requestCategory.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { name: true },
        })
      ).map((r) => r.name);

    case "SERVICE_SUBTYPE":
      return (
        await prisma.requestSubcategory.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { name: true },
        })
      ).map((r) => r.name);

    case "USER":
      return (
        await prisma.user.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { name: true },
        })
      ).map((r) => r.name);

    default:
      return [];
  }
}
