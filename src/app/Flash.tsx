"use client";

import { useSearchParams } from "next/navigation";

/**
 * Shows the confirmation an action left in the URL. Rendered once by the shell
 * so every page reports its writes without plumbing this through each one.
 */
export default function Flash() {
  const ok = useSearchParams().get("ok");
  if (!ok) return null;
  return <div className="banner flash">{ok}</div>;
}
