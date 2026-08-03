import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { landingPath } from "@/lib/guard";
import { needsPasswordChange } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (needsPasswordChange(user)) redirect("/change-password");

  // Land on the first page this user is actually permitted to open.
  const path = await landingPath(user);
  if (!path) redirect("/no-access");
  redirect(path);
}
