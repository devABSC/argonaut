"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { IconPlus } from "../icons";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf";
const OK = /\.(pdf|docx?|xlsx?|txt)$/i;

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
 * Drop a CV on the box or click to browse.
 *
 * The dropped file is written back into the file input rather than held in
 * state — that keeps the plain form submission working, so the upload does not
 * depend on JavaScript beyond the drop itself.
 *
 * Reading a CV takes several seconds, so the button says so rather than looking
 * hung. The file name is shown before upload: the usual mistake is picking the
 * wrong file, and that is cheaper to catch here.
 */
export default function UploadCV({ action }: { action: (fd: FormData) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [size, setSize] = useState(0);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  function take(file: File | undefined) {
    if (!file) return;
    if (!OK.test(file.name)) {
      setRejected(`${file.name} — only PDF, Word, Excel or plain text`);
      setName(null);
      return;
    }
    setRejected(null);
    setName(file.name);
    setSize(file.size);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !input.current) return;
    // Hand the drop to the real input so the form posts it unchanged.
    const dt = new DataTransfer();
    dt.items.add(file);
    input.current.files = dt.files;
    take(file);
  }

  return (
    <form action={action} className="cvupload">
      <label
        className={`cvdrop${over ? " over" : ""}${rejected ? " bad" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={input}
          type="file"
          name="cv"
          accept={ACCEPT}
          onChange={(e) => take(e.currentTarget.files?.[0])}
        />
        <span className="cvicon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M12 18v-6M9 15l3-3 3 3" />
          </svg>
        </span>
        <span className="cvtext">
          {rejected ? (
            <>
              <b>That file will not do</b>
              <span className="tree-meta">{rejected}</span>
            </>
          ) : name ? (
            <>
              <b>{name}</b>
              <span className="tree-meta">{(size / 1024).toFixed(0)} KB — ready to upload</span>
            </>
          ) : over ? (
            <>
              <b>Drop it here</b>
              <span className="tree-meta">Release to attach</span>
            </>
          ) : (
            <>
              <b>Drop a CV here, or click to browse</b>
              <span className="tree-meta">PDF, Word, Excel or plain text</span>
            </>
          )}
        </span>
      </label>

      <Submit hasFile={!!name} />
    </form>
  );
}
