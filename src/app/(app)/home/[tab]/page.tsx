import Link from "next/link";
import { ROLE_LABEL } from "@/lib/rbac";
import { requireAccess } from "@/lib/guard";
import { sectionHref } from "@/lib/nav";

/**
 * The way in. No article, no statistics of its own — the modules this person
 * can open, and nothing they cannot.
 */
export default async function HomeTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const { user, nav, section, tab: active } = await requireAccess("home", tab);

  const hour = Number(
    new Date().toLocaleString("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", hour12: false }),
  );
  const partOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Everything but Home itself; `nav` is already cut to what this user may see.
  const modules = nav.filter((s) => s.key !== "home");

  return (
    <>
      <div className="panel">
        <h2>{partOfDay}, {user.name.split(" ")[0]}</h2>
        <p>{ROLE_LABEL[user.role]} · {modules.length} module{modules.length === 1 ? "" : "s"} open to you.</p>

        <div className="homegrid">
          {modules.map((s) => (
            <Link className="homecard" key={s.key} href={sectionHref(s)}>
              <b>{s.label}</b>
              <span className="tree-meta">
                {s.tabs.filter((t) => !t.parent).slice(0, 3).map((t) => t.label).join(" · ")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
