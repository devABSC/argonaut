import { prisma } from "./prisma";
import { notify } from "./notify";
import { rebuildUploadStats } from "./upload-stat";

/**
 * What a scheduled job can actually do.
 *
 * A registry rather than free-form code: a job stored in the database names one
 * of these, so nothing arbitrary is ever executed from a row someone typed.
 */
export type CronResult = { ok: boolean; message: string };

/** Quotes shipped with the app, so the job needs no outside service. */
const QUOTES: { text: string; who: string }[] = [
  { text: "The best way out is always through.", who: "Robert Frost" },
  { text: "Simplicity is the ultimate sophistication.", who: "Leonardo da Vinci" },
  { text: "Well begun is half done.", who: "Aristotle" },
  { text: "Make it work, make it right, make it fast.", who: "Kent Beck" },
  { text: "It always seems impossible until it is done.", who: "Nelson Mandela" },
  { text: "The obstacle is the way.", who: "Marcus Aurelius" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", who: "Dale Carnegie" },
  { text: "Perfection is achieved when there is nothing left to take away.", who: "Antoine de Saint-Exupéry" },
  { text: "A goal without a plan is just a wish.", who: "Antoine de Saint-Exupéry" },
  { text: "What gets measured gets managed.", who: "Peter Drucker" },
  { text: "Slow is smooth, and smooth is fast.", who: "proverb" },
  { text: "You do not rise to the level of your goals; you fall to the level of your systems.", who: "James Clear" },
];

type Runner = (config: Record<string, unknown>) => Promise<CronResult>;

const RUNNERS: Record<string, { label: string; describe: string; run: Runner }> = {
  "random-quote": {
    label: "Send a random quote",
    describe: "Emails one quote, picked at random, to the address in the job's settings.",
    run: async (config) => {
      const to = String(config.to ?? "").trim();
      if (!to) return { ok: false, message: "No recipient set on the job." };

      const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      const sent = await notify({
        to,
        subject: `A thought for today — ${q.who}`,
        body: `"${q.text}"\n\n— ${q.who}`,
        kind: "quote",
      });
      return sent
        ? { ok: true, message: `Sent to ${to}: "${q.text}" — ${q.who}` }
        : { ok: false, message: `Could not deliver to ${to}. Check the mail settings.` };
    },
  },

  "rollup-uploads": {
    label: "Roll up CV upload counts",
    describe:
      "Recounts CV uploads into the tally the ATS chart reads — daily, weekly, monthly, quarterly and yearly. Runs once a day so the chart never counts anything itself.",
    run: async () => {
      const { rows, uploads } = await rebuildUploadStats();
      return { ok: true, message: `${uploads} upload(s) rolled into ${rows} tally row(s).` };
    },
  },

  "low-stock-digest": {
    label: "Low stock digest",
    describe: "Emails the items at or below their low mark. Nothing is sent when none are.",
    run: async (config) => {
      const to = String(config.to ?? "").trim();
      if (!to) return { ok: false, message: "No recipient set on the job." };

      const items = await prisma.invItem.findMany({
        where: { isActive: true, type: "GOODS" },
        select: { sku: true, name: true, stock: true, lowStockAt: true, unit: true },
      });
      const low = items.filter((i) => i.stock <= i.lowStockAt);
      if (low.length === 0) return { ok: true, message: "Nothing is low — no email sent." };

      const sent = await notify({
        to,
        subject: `${low.length} item${low.length === 1 ? "" : "s"} at or below the low mark`,
        body: low.map((i) => `${i.sku} — ${i.name}: ${i.stock} ${i.unit} (low at ${i.lowStockAt})`).join("\n"),
        kind: "low-stock",
      });
      return sent
        ? { ok: true, message: `Reported ${low.length} low item(s) to ${to}.` }
        : { ok: false, message: `Could not deliver to ${to}.` };
    },
  },
};

export const CRON_ACTIONS = Object.entries(RUNNERS).map(([key, r]) => ({
  key, label: r.label, describe: r.describe,
}));

export const isCronAction = (v: string) => v in RUNNERS;

/** Runs one job and writes the attempt down, worked or not. */
export async function runCronJob(jobId: string, manual: boolean): Promise<CronResult> {
  const job = await prisma.cronJob.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, message: "That job no longer exists." };

  const run = await prisma.cronRun.create({ data: { jobId, manual } });

  let result: CronResult;
  try {
    const runner = RUNNERS[job.action];
    result = runner
      ? await runner.run((job.config as Record<string, unknown>) ?? {})
      : { ok: false, message: `No logic registered under "${job.action}".` };
  } catch (e) {
    // A job that throws must still leave a record of having tried.
    result = { ok: false, message: (e as Error).message.slice(0, 300) };
  }

  await prisma.$transaction([
    prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: result.ok, message: result.message },
    }),
    prisma.cronJob.update({ where: { id: jobId }, data: { lastRunAt: new Date() } }),
  ]);

  return result;
}
