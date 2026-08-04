"use client";

import { useState } from "react";

type T = { id: string; name: string; subject: string; body: string; signature: string };

/** Choosing a template loads its subject, body and signature into the form. */
export default function TemplatePicker({ templates }: { templates: T[] }) {
  const [id, setId] = useState("");
  const t = templates.find((x) => x.id === id);

  return (
    <>
      <div className="grid3">
        <label>
          <span>Template</span>
          <select name="templateId" value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">— none, write it below —</option>
            {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label style={{ gridColumn: "span 2" }}>
          <span>Subject</span>
          <input name="subject" key={`s-${id}`} defaultValue={t?.subject ?? ""} required />
        </label>
      </div>

      <label className="full">
        <span>Body</span>
        <textarea name="body" key={`b-${id}`} rows={8} defaultValue={t?.body ?? ""} required />
      </label>

      <label className="full">
        <span>Signature</span>
        <textarea name="signature" key={`g-${id}`} rows={3} defaultValue={t?.signature ?? ""} />
      </label>
    </>
  );
}
