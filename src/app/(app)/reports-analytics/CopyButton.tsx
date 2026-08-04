"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "@/app/icons";

/** Puts one query on the clipboard, and says so. */
export default function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className="ghost icon"
      title={done ? "Copied" : "Copy this query"}
      aria-label={done ? "Copied" : "Copy this query"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          // Clipboard refused — the query is on screen and can be selected.
        }
      }}
    >
      {done ? <IconCheck /> : <IconCopy />}
    </button>
  );
}
