import { prisma } from "@/lib/prisma";
import { saveTemplate, deleteTemplate } from "@/app/actions/marketing";
import { IconSave, IconTrash, IconPlus } from "@/app/icons";

export default async function TemplatesPanel() {
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { recipients: true } } },
  });

  return (
    <>
      <div className="panel">
        <h2>Templates <span className="count">{templates.length}</span></h2>
        <p>
          Reusable emails. The send form loads one and remembers who has already
          received it, so nobody gets the same template twice by accident.
        </p>

        <form action={saveTemplate} className="empform" style={{ marginTop: 4 }}>
          <div className="grid3">
            <label><span>Name</span><input name="name" required placeholder="Welcome pack" /></label>
            <label style={{ gridColumn: "span 2" }}>
              <span>Subject</span><input name="subject" placeholder="Welcome to ATOMIT" />
            </label>
          </div>
          <label className="full"><span>Body</span><textarea name="body" rows={6} /></label>
          <label className="full"><span>Signature</span><textarea name="signature" rows={3} /></label>
          <button className="btn-primary" type="submit"><IconPlus /> Add template</button>
        </form>
      </div>

      {templates.map((t) => (
        <div className="panel" key={t.id} style={{ marginTop: 18 }}>
          <form action={saveTemplate}>
            <input type="hidden" name="templateId" value={t.id} />
            <div className="cat-head">
              <h2>{t.name}</h2>
              <span className="tree-meta">sent to {t._count.recipients}</span>
              <span className="spacer" />
              <span className="rowacts">
                <button className="save icon" type="submit" title="Save" aria-label="Save"><IconSave /></button>
                <button
                  className="reject icon" type="submit" title="Delete" aria-label="Delete"
                  formAction={deleteTemplate.bind(null, t.id)}
                ><IconTrash /></button>
              </span>
            </div>

            <div className="empform" style={{ border: 0, padding: 0, background: "transparent" }}>
              <div className="grid3">
                <label><span>Name</span><input name="name" defaultValue={t.name} required /></label>
                <label style={{ gridColumn: "span 2" }}>
                  <span>Subject</span><input name="subject" defaultValue={t.subject} />
                </label>
              </div>
              <label className="full"><span>Body</span><textarea name="body" rows={6} defaultValue={t.body} /></label>
              <label className="full"><span>Signature</span><textarea name="signature" rows={3} defaultValue={t.signature} /></label>
            </div>
          </form>
        </div>
      ))}
    </>
  );
}
