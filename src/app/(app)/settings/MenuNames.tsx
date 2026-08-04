import { prisma } from "@/lib/prisma";
import { NAV } from "@/lib/nav";
import { moduleNodeKey, tabNodeKey } from "@/lib/access-policy";
import { renameMenu } from "@/app/actions/rbac";
import { IconSave } from "@/app/icons";

/**
 * Rename any menu or page. Structure stays in code; these are only the words,
 * so fixing a spelling can never break a route or a permission.
 */
export default async function MenuNames() {
  const rows = await prisma.menuLabel.findMany();
  const by = new Map(rows.map((r) => [r.nodeKey, r]));

  const items = NAV.flatMap((s) => [
    { key: moduleNodeKey(s.key), original: s.label, kind: "module" as const, section: s.label },
    ...s.tabs.map((t) => ({
      key: tabNodeKey(s.key, t.slug),
      original: t.label,
      kind: "page" as const,
      section: s.label,
      originalTitle: t.title ?? "",
    })),
  ]);

  const renamed = items.filter((i) => by.has(i.key)).length;

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="cat-head">
        <h2>Menu names <span className="count">{items.length}</span></h2>
        <span className="spacer" />
        {renamed > 0 && <span className="tree-meta">{renamed} renamed</span>}
      </div>
      <p>
        Fix a spelling or a capital without waiting on a deploy. Only the words
        change — what each menu links to, and who may open it, stay as they are.
        Clear a field to put the original name back. The hover text is for
        abbreviations, like COA showing Chart of Accounts.
      </p>

      <div className="checklist">
        <div className="checkhead menuhead">
          <span>Menu</span>
          <span>Original</span>
          <span>Shown as</span>
          <span>Hover text</span>
          <span />
        </div>

        {items.map((i) => {
          const o = by.get(i.key);
          return (
            <form action={renameMenu} className="checkrow menurow" key={i.key}>
              <input type="hidden" name="nodeKey" value={i.key} />
              <input type="hidden" name="fallback" value={i.original} />

              <span className="citem">
                <b>{i.kind === "module" ? i.original : `${i.section} › ${i.original}`}</b>
                <code className="rkey">{i.key}</code>
              </span>

              <span className="muted">{i.original}</span>

              <input name="label" defaultValue={o?.label ?? i.original} autoComplete="off" />
              <input
                name="title"
                defaultValue={o?.title ?? ("originalTitle" in i ? i.originalTitle : "")}
                placeholder="optional"
                autoComplete="off"
              />

              <span className="rowacts">
                <button className="save icon" type="submit" title={`Save ${i.original}`} aria-label="Save name">
                  <IconSave />
                </button>
              </span>
            </form>
          );
        })}
      </div>
    </div>
  );
}
