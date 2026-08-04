import { cache } from "react";

/**
 * Which page a database call belongs to.
 *
 * Set once by the access gate, which every page goes through, and read by the
 * recorder in prisma.ts — the calls worth measuring are made deep inside
 * components that have no business knowing what route they are rendering.
 *
 * Held in React's per-request cache rather than async storage: it gives one
 * object per request without pulling a Node-only module into the bundle.
 */
export type PageContext = { module: string; url: string };

const holder = cache((): { current: PageContext | null } => ({ current: null }));

export function setPageContext(ctx: PageContext) {
  try {
    holder().current = ctx;
  } catch {
    // Outside a render — a server action, say. Nothing to attribute to.
  }
}

export function getPageContext(): PageContext | null {
  try {
    return holder().current;
  } catch {
    return null;
  }
}

/** Only calls slower than this are worth a row. */
export const SLOW_MS = Number(process.env.SLOW_QUERY_MS ?? 250);

/** How many rows to keep. Beyond this the oldest are dropped. */
export const KEEP_ROWS = 500;

/**
 * SQL emitted since the last drain.
 *
 * Prisma reports the statement it sent on a separate event that does not carry
 * the async context, so the statement cannot be attributed where it is raised.
 * The recorder marks the buffer before a call and takes what appeared after —
 * with joined relation loading a call is normally one statement, so the two
 * line up. It is a diagnostic, and a mis-paired statement costs nothing.
 */
const buffer: string[] = [];

export function pushSql(sql: string) {
  buffer.push(sql);
  // Never let the buffer grow if nothing is draining it.
  if (buffer.length > 50) buffer.splice(0, buffer.length - 50);
}

export const sqlMark = () => buffer.length;

export function sqlSince(mark: number): string {
  const taken = buffer.slice(Math.max(0, mark));
  buffer.length = 0;
  return taken.join(";\n").slice(0, 4000);
}
