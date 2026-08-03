"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { done } from "@/lib/flash";
import { logHistory } from "@/lib/log";
import { isCronAction, runCronJob } from "@/lib/cron-actions";
import type { CronFrequency } from "@prisma/client";

const PATH = "/settings/cron-jobs";

/** Schedules are the owner's — a job runs unattended and sends real mail. */
async function requireOwner() {
  const u = await requireUser();
  if (u.role !== "SUPER_USER") throw new Error("FORBIDDEN");
  return u;
}

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** "7am, 12nn, 5pm" and "07:00 12:00 17:00" both mean the same three times. */
function parseTimes(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => {
      if (t === "12nn" || t === "noon") return "12:00";
      if (t === "12mn" || t === "midnight") return "00:00";
      const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
      if (ampm) {
        let h = Number(ampm[1]) % 12;
        if (ampm[3] === "pm") h += 12;
        return `${String(h).padStart(2, "0")}:${ampm[2] ?? "00"}`;
      }
      const hm = t.match(/^(\d{1,2}):(\d{2})$/);
      if (hm) return `${String(Number(hm[1])).padStart(2, "0")}:${hm[2]}`;
      return "";
    })
    .filter(Boolean)
    .filter((t, i, a) => a.indexOf(t) === i)
    .sort();
}

function freq(v: string): CronFrequency {
  return v === "HOURLY" || v === "WEEKLY" || v === "MONTHLY" ? v : "DAILY";
}

export async function addCronJob(formData: FormData) {
  const me = await requireOwner();

  const name = text(formData, "name");
  const action = text(formData, "action");
  if (!name) done(PATH, "Not added — a job needs a name.");
  if (!isCronAction(action)) done(PATH, "Not added — pick what the job should do.");

  if (await prisma.cronJob.findUnique({ where: { name }, select: { id: true } })) {
    done(PATH, `Not added — a job called "${name}" already exists.`);
  }

  const frequency = freq(text(formData, "frequency"));
  const times = parseTimes(text(formData, "times"));
  if (frequency !== "HOURLY" && times.length === 0) {
    done(PATH, "Not added — give at least one time of day, e.g. 7am, 12nn, 5pm.");
  }

  const endsRaw = text(formData, "endsOn");
  const onDay = Math.floor(Number(text(formData, "onDay")));

  await prisma.cronJob.create({
    data: {
      name,
      description: text(formData, "description") || null,
      frequency,
      times,
      onDay: Number.isFinite(onDay) && onDay > 0 ? onDay : null,
      recurring: text(formData, "recurring") !== "0",
      endsOn: /^\d{4}-\d{2}-\d{2}$/.test(endsRaw) ? new Date(`${endsRaw}T23:59:59+08:00`) : null,
      action,
      config: { to: text(formData, "to") || null },
      createdById: me.id,
      createdByName: me.name,
    },
  });

  revalidatePath(PATH);
  await logHistory({ type: "create", module: "Settings > Cron Jobs", description: `Scheduled ${name}`, user: me });
  done(PATH, `"${name}" scheduled.`);
}

export async function toggleCronJob(id: string) {
  const me = await requireOwner();
  const job = await prisma.cronJob.findUnique({ where: { id }, select: { name: true, isActive: true } });
  if (!job) return;

  await prisma.cronJob.update({ where: { id }, data: { isActive: !job.isActive } });
  revalidatePath(PATH);
  await logHistory({ type: "update", module: "Settings > Cron Jobs", description: `${job.isActive ? "Paused" : "Resumed"} ${job.name}`, user: me });
  done(PATH, `"${job.name}" ${job.isActive ? "paused" : "resumed"}.`);
}

export async function deleteCronJob(id: string) {
  const me = await requireOwner();
  const job = await prisma.cronJob.findUnique({ where: { id }, select: { name: true } });
  if (!job) return;

  await prisma.cronJob.delete({ where: { id } });
  revalidatePath(PATH);
  await logHistory({ type: "delete", module: "Settings > Cron Jobs", description: `Removed ${job.name}`, user: me });
  done(PATH, `"${job.name}" removed.`);
}

/** Run it now, on purpose. The attempt is recorded and marked manual. */
export async function testRunCronJob(id: string) {
  const me = await requireOwner();
  const job = await prisma.cronJob.findUnique({ where: { id }, select: { name: true } });
  if (!job) return;

  const result = await runCronJob(id, true);
  revalidatePath(PATH);
  await logHistory({
    type: result.ok ? "update" : "reject",
    module: "Settings > Cron Jobs",
    description: `Test run of ${job.name}: ${result.ok ? "ok" : "failed"}`,
    user: me,
  });
  done(`${PATH}?view=test-run`, `${job.name} — ${result.message}`);
}
