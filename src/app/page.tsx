import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { visibleNav, sectionHref } from "@/lib/nav";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // No standalone dashboard — land on the first section this role can open.
  redirect(sectionHref(visibleNav(user.role)[0]));
}
