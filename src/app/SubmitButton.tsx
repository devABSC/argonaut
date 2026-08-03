"use client";

import { useFormStatus } from "react-dom";

/** Submit with a pending spinner, so a slow save cannot be double-clicked. */
export default function SubmitButton({ label = "Submit Ticket" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="btn-primary" type="submit" disabled={pending}>
      {pending && <span className="spinner" aria-hidden="true" />}
      {pending ? "Saving…" : label}
    </button>
  );
}
