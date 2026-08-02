import { prisma } from "./prisma";

/**
 * Reserved form holding the fields every request form inherits.
 * Created on first use, so there is nothing to seed.
 */
export const STANDARD_SLUG = "__standard";

export async function getStandardForm() {
  return (
    (await prisma.formType.findUnique({
      where: { slug: STANDARD_SLUG },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    })) ??
    (await prisma.formType.create({
      data: { name: "Standard fields", slug: STANDARD_SLUG },
      include: { fields: true },
    }))
  );
}
