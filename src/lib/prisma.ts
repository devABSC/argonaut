import { PrismaClient } from "@prisma/client";
import { getPageContext, pushSql, sqlMark, sqlSince, SLOW_MS, KEEP_ROWS } from "./query-log";

// Reuse a single PrismaClient across hot-reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function build(): PrismaClient {
  const base = new PrismaClient({ log: [{ emit: "event", level: "query" }] });

  // Prisma reports the statement it sent on this event; the recorder below
  // pairs it with the call that caused it.
  (base as unknown as { $on: (e: string, cb: (v: { query: string }) => void) => void })
    .$on("query", (e) => pushSql(e.query));

  const extended = base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const mark = sqlMark();
        const started = Date.now();
        const result = await query(args);
        const ms = Date.now() - started;

        // Recording is a diagnostic, so it must never slow or break the thing
        // it measures: slow calls only, never its own writes, failures eaten.
        if (ms >= SLOW_MS && model !== "QueryStat") {
          const ctx = getPageContext();
          const sql = sqlSince(mark) || `prisma.${String(model)}.${operation}()`;
          void base.queryStat
            .create({
              data: { module: ctx?.module ?? "—", url: ctx?.url ?? "—", sql, ms },
            })
            .then(async () => {
              // Keep the table small, but not on every write — one pass in
              // twenty is enough to hold the line.
              if (started % 20 !== 0) return;
              const edge = await base.queryStat.findMany({
                orderBy: { at: "desc" }, skip: KEEP_ROWS, take: 1, select: { at: true },
              });
              if (edge[0]) await base.queryStat.deleteMany({ where: { at: { lt: edge[0].at } } });
            })
            .catch(() => {});
        }

        return result;
      },
    },
  });

  return extended as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? build();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
