import { prisma } from "./prisma";

/**
 * Reserved form holding the fields every request form inherits.
 * Created on first use, so there is nothing to seed.
 */
export const STANDARD_SLUG = "__standard";

/** How the ticket reached us. A fixed list, not free text. */
export const CHANNELS = ["Email", "Phone", "Walk In", "Argonaut", "Others"] as const;

export async function getStandardForm() {
  const form =
    (await prisma.formType.findUnique({
      where: { slug: STANDARD_SLUG },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    })) ??
    (await prisma.formType.create({
      data: { name: "Standard fields", slug: STANDARD_SLUG },
      include: { fields: true },
    }));

  // Channel is a choice, and the form is created empty on first use — so seed
  // it here rather than leaving a free-text box behind. Only created when
  // absent: an admin who has since edited it keeps their version.
  if (!form.fields.some((f) => f.key === "channel")) {
    await prisma.formField.create({
      data: {
        formTypeId: form.id,
        key: "channel",
        label: "Channel",
        kind: "SELECT",
        options: [...CHANNELS],
        sortOrder: 0,
      },
    });
    return prisma.formType.findUniqueOrThrow({
      where: { slug: STANDARD_SLUG },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });
  }

  return form;
}
