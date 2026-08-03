"use client";

import { useState } from "react";

/** The link is sent by hand, so copying it has to be one click and obvious. */
export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="copylink">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Interview link" />
      <button
        type="button"
        className="btn-primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            // Clipboard is blocked outside a secure context; the field is
            // already selectable, so say what to do instead of failing quietly.
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
