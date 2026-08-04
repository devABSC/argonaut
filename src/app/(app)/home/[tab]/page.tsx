import { requireAccess } from "@/lib/guard";

/**
 * Where everyone lands. Deliberately empty: the menu is the way in, and
 * repeating it here said nothing the rail was not already saying.
 */
export default async function HomeTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  await requireAccess("home", tab);

  return null;
}
