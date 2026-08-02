"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function createProject(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || "Untitled project";
  await prisma.project.create({ data: { name, userId: user.id } });
  revalidatePath("/");
}
