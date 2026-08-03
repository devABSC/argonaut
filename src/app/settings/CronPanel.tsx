import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { IconPlus, IconTrash, IconCheck, IconX } from "../icons";
import { addCronJob, deleteCronJob, toggleCronJob, testRunCronJob } from "../actions/cron";
import { CRON_ACTIONS } from "@/lib/cron-actions";
import { describeSchedule } from "@/lib/cron-schedule";

const when = (d: Date | null) =>
  d ? d.toLocaleString("en-GB", {
    timeZone: "Asia/Manila", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) : "—";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

const VIEWS = [
  { slug: "", label: "Jobs" },
  { slug: "test-run", label: "Test Run" },
] as const;

/**
 * Every scheduled job, what it does, and whether it worked.
 *
 * A schedule with no run history cannot be trusted, so the last result travels
 * with the job rather than living somewhere else.
 */
export default async function CronPanel({ view = "" }: { view?: string }) {
  const on = view === "test-run" ? "test-run" : "";

  const [jobs, runs] = await Promise.all([
    prisma.cronJob.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
    }),
    prisma.cronRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 30,
      include: { job: { select: { name: true } } },
    }),
  ]);

  const strip = (
    <div className="subtabs" role="tablist">
      {VIEWS.map((v) => (
        <Link key={v.slug} role="tab" aria-selected={v.slug === on}
          className={v.slug === on ? "subtab on" : "subtab"}
          href={v.slug ? "/settings/cron-jobs?view=test-run" : "/settings/cron-jobs"}>
          {v.label}
        </Link>
      ))}
    </div>
  );

  if (on === "test-run") {
    return (
      <>
        {strip}
        <div className="panel">
          <div className="cat-head">
            <h2>Test Run</h2>
            <span className="spacer" />
            <span className="tree-meta">runs the job now, and records it as a manual attempt</span>
          </div>

          {jobs.length === 0 ? (
            <p style={{ marginTop: 14 }}>No jobs to run — add one on the Jobs tab.</p>
          ) : (
            <div className="tablewrap">
              <table className="utable stacked">
                <thead><tr>
                  <th className="numcol">No.</th><th>Job</th><th>Does</th>
                  <th>Last run</th><th>Result</th><th />
                </tr></thead>
                <tbody>
                  {jobs.map((j, i) => {
                    const last = j.runs[0];
                    return (
                      <tr key={j.id}>
                        <td className="numcol" data-label="No.">{i + 1}</td>
                        <td data-label="Job"><b>{j.name}</b></td>
                        <td className="muted" data-label="Does">
                          {CRON_ACTIONS.find((a) => a.key === j.action)?.label ?? j.action}
                        </td>
                        <td className="muted nowrap" data-label="Last run">{when(j.lastRunAt)}</td>
                        <td data-label="Result">
                          {last ? (
                            <span className={`pill ${last.ok ? "s-ACTIVE" : "s-REJECTED"}`}>
                              {last.ok ? "ok" : "failed"}
                            </span>
                          ) : <span className="muted">never run</span>}
                        </td>
                        <td className="rowacts">
                          <form action={testRunCronJob.bind(null, j.id)}>
                            <button className="save" type="submit" title="Run this job now">Run now</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="cat-head">
            <h2>Run log <span className="count">{runs.length}</span></h2>
          </div>
          {runs.length === 0 ? (
            <p style={{ marginTop: 14 }}>Nothing has run yet.</p>
          ) : (
            <div className="tablewrap">
              <table className="utable stacked">
                <thead><tr>
                  <th>Started</th><th>Job</th><th>How</th><th>Result</th><th>Message</th>
                </tr></thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td className="muted nowrap" data-label="Started">{when(r.startedAt)}</td>
                      <td data-label="Job">{r.job.name}</td>
                      <td className="muted" data-label="How">{r.manual ? "test run" : "schedule"}</td>
                      <td data-label="Result">
                        <span className={`pill ${r.ok ? "s-ACTIVE" : "s-REJECTED"}`}>{r.ok ? "ok" : "failed"}</span>
                      </td>
                      <td className="muted clip" data-label="Message" title={r.message}>{r.message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {strip}
      <div className="panel">
        <div className="cat-head">
          <h2>Cron Jobs <span className="count">{jobs.length}</span></h2>
          <span className="spacer" />
          <span className="tree-meta">times are Manila</span>
        </div>

        <form action={addCronJob} className="coaform">
          <label className="statfield">
            <span>Cron name</span>
            <input name="name" required autoComplete="off" placeholder="e.g. Daily quote" />
          </label>
          <label className="statfield">
            <span>Action logic</span>
            <select name="action" required defaultValue="">
              <option value="" disabled>What should it do?</option>
              {CRON_ACTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </label>
          <label className="statfield">
            <span>Send to</span>
            <input name="to" type="email" autoComplete="off" placeholder="who receives it" />
          </label>

          <div className="fieldpair">
            <label className="statfield">
              <span>Frequency</span>
              <select name="frequency" defaultValue="DAILY">
                <option value="HOURLY">Hourly</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </label>
            <label className="statfield">
              <span>Times of day</span>
              <input name="times" autoComplete="off" placeholder="7am, 12nn, 5pm" />
            </label>
          </div>

          <div className="fieldpair">
            <label className="statfield">
              <span>Recurring</span>
              <select name="recurring" defaultValue="1">
                <option value="1">Yes — keeps running</option>
                <option value="0">No — once only</option>
              </select>
            </label>
            <label className="statfield">
              <span>Ends on</span>
              <input name="endsOn" type="date" title="Leave blank to run indefinitely" />
            </label>
          </div>

          <label className="statfield">
            <span>Day (weekly / monthly)</span>
            <input name="onDay" type="number" min="1" max="31" placeholder="1 = Monday, or day of month" />
          </label>

          <label className="statfield full">
            <span>Cron description</span>
            <input name="description" autoComplete="off" placeholder="What this job is for" />
          </label>

          <div className="statacts">
            <button className="btn-primary" type="submit"><IconPlus /> Schedule job</button>
          </div>
        </form>

        {jobs.length === 0 ? (
          <p style={{ marginTop: 14 }}>Nothing scheduled yet.</p>
        ) : (
          <div className="tablewrap">
            <table className="utable stacked">
              <thead><tr>
                <th className="numcol">No.</th><th>Cron name</th><th>Description</th>
                <th>Frequency</th><th>Action logic</th><th>Ends</th>
                <th>Last result</th><th>Status</th><th />
              </tr></thead>
              <tbody>
                {jobs.map((j, i) => {
                  const last = j.runs[0];
                  return (
                    <tr key={j.id}>
                      <td className="numcol" data-label="No.">{i + 1}</td>
                      <td data-label="Cron name"><b>{j.name}</b></td>
                      <td className="muted clip" data-label="Description" title={j.description ?? undefined}>
                        {j.description ?? "—"}
                      </td>
                      <td className="muted" data-label="Frequency">{describeSchedule(j)}</td>
                      <td className="muted" data-label="Action logic">
                        {CRON_ACTIONS.find((a) => a.key === j.action)?.label ?? j.action}
                      </td>
                      <td className="muted nowrap" data-label="Ends">{day(j.endsOn)}</td>
                      <td data-label="Last result">
                        {last ? (
                          <span className={`pill ${last.ok ? "s-ACTIVE" : "s-REJECTED"}`}
                            title={last.message}>
                            {last.ok ? "ok" : "failed"}
                          </span>
                        ) : <span className="muted">never run</span>}
                      </td>
                      <td data-label="Status">
                        <span className={`pill ${j.isActive ? "s-ACTIVE" : "s-SUSPENDED"}`}>
                          {j.isActive ? "Active" : "Paused"}
                        </span>
                      </td>
                      <td className="rowacts">
                        <form action={toggleCronJob.bind(null, j.id)}>
                          <button className="ghost icon" type="submit"
                            title={j.isActive ? "Pause this job" : "Resume this job"}
                            aria-label={j.isActive ? "Pause" : "Resume"}>
                            {j.isActive ? <IconX /> : <IconCheck />}
                          </button>
                        </form>
                        <form action={deleteCronJob.bind(null, j.id)}>
                          <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
