"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { IconPlus } from "../icons";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf";

function Submit({ hasFile }: { hasFile: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" type="submit" disabled={pending || !hasFile}>
      {pending ? <span className="spinner" aria-hidden="true" /> : <IconPlus />}
      {pending ? "Reading the CV…" : "Upload CV"}
    </button>
  );
}

/**
 * Reading a CV takes several seconds, so the button says so rather than
 * looking hung. The file name is shown before upload — the usual mistake is
 * picking the wrong file, and that is cheaper to catch here.
 */
export default function UploadCV({ action }: { action: (fd: FormData) => Promise<void> }) {
  const [name, setName] = useState<string | null>(null);
  const [size, setSize] = useState(0);

  return (
    <form action={action} className="cvupload">
      <label className="cvdrop">
        <input
          type="file"
          name="cv"
          accept={ACCEPT}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            setName(f?.name ?? null);
            setSize(f?.size ?? 0);
          }}
        />
        <span className="cvicon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M12 18v-6M9 15l3-3 3 3" />
          </svg>
        </span>
        <span className="cvtext">
          {name ? (
            <>
              <b>{name}</b>
              <span className="tree-meta">{(size / 1024).toFixed(0)} KB — ready to upload</span>
            </>
          ) : (
            <>
              <b>Choose a CV</b>
              <span className="tree-meta">PDF, Word, Excel or plain text</span>
            </>
          )}
        </span>
      </label>

      <Submit hasFile={!!name} />
    </form>
  );
}
