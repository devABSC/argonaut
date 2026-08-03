import { redirect } from "next/navigation";

/**
 * Finish a write by returning to `path` with a message the shell will show.
 * A server action cannot hold state across the navigation it triggers, so the
 * confirmation rides in the query string.
 *
 * Call last — redirect() works by throwing, so nothing after it runs.
 */
export function done(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}ok=${encodeURIComponent(message)}`);
}
