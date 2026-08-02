import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "./AppShell";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell
      user={{ name: user.name }}
      projects={projects.map((p) => ({ id: p.id, name: p.name, status: p.status, progress: p.progress }))}
    />
  );
}
