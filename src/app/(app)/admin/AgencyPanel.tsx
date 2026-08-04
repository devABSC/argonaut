import { prisma } from "@/lib/prisma";
import { IconSave, IconDownload, IconTrash } from "@/app/icons";
import { saveAgencyLink, clearAgencySecret } from "@/app/actions/agencies";
import { AGENCIES, AGENCY_SLUG, type Agency } from "@/lib/agencies";

/**
 * One statutory agency: what it offers, what argonaut should do about it, the
 * details needed to work with it, and the roster it can hand over.
 *
 * The analysis is stated rather than implied — none of the three publish an
 * API, and a page that quietly showed a "Connect" button would be lying about
 * what is possible.
 */
export default async function AgencyPanel({
  agency,
  isOwner,
}: {
  agency: Agency;
  isOwner: boolean;
}) {
  const a = AGENCIES[agency];
  const [link, members, staff] = await Promise.all([
    prisma.agencyLink.findUnique({ where: { agency } }),
    prisma.employee.count({ where: { status: 0, [a.idField]: { not: null } } }),
    prisma.employee.count({ where: { status: 0 } }),
  ]);

  const missing = staff - members;
  const period = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 7);

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>{a.name} <span className="tree-meta">{a.full}</span></h2>
          <span className="spacer" />
          <span className="pill s-REJECTED">No public API</span>
        </div>

        <div className="finding">
          <h3>What they offer today</h3>
          <p>{a.channel}</p>

          <h3>Can argonaut connect to it?</h3>
          <p>{a.api}</p>

          <h3>What I recommend building</h3>
          <ol className="reclist">
            {a.recommendation.map((r, i) => <li key={i}>{r}</li>)}
          </ol>

          <h3>The forms involved</h3>
          <p className="muted">{a.artefacts.join(" · ")}</p>

          <h3>Sources</h3>
          <ul className="srclist">
            {a.sources.map((s) => (
              <li key={s.url}>
                <a className="ticket" href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a>
                <span className="tree-meta"> {s.label}</span>
              </li>
            ))}
          </ul>
          <p className="muted" style={{ marginTop: 10 }}>
            Researched August 2026. Agencies change their channels — check the
            sources before relying on this.
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="cat-head">
          <h2>Connection details</h2>
          <span className="spacer" />
          {link?.updatedByName && <span className="tree-meta">last saved by {link.updatedByName}</span>}
          {!isOwner && <span className="pill s-SUSPENDED">Owner sets this</span>}
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          What an employer needs before any of this works. The password is held
          so whoever files is not hunting for it — argonaut never signs in on
          its own.
        </p>

        <ul className="needlist">
          {a.connection.map((c) => (
            <li key={c.label}><b>{c.label}</b><span className="tree-meta"> {c.note}</span></li>
          ))}
        </ul>

        {isOwner ? (
          <form action={saveAgencyLink.bind(null, agency)} className="coaform">
            <label className="statfield">
              <span>Employer number</span>
              <input name="employerNumber" defaultValue={link?.employerNumber ?? ""} autoComplete="off" />
            </label>
            <label className="statfield">
              <span>Registered name</span>
              <input name="registeredName" defaultValue={link?.registeredName ?? ""} autoComplete="off" />
            </label>
            <label className="statfield">
              <span>Branch code</span>
              <input name="branchCode" defaultValue={link?.branchCode ?? ""} autoComplete="off" />
            </label>
            <label className="statfield">
              <span>Portal URL</span>
              <input name="portalUrl" type="url" defaultValue={link?.portalUrl ?? ""} autoComplete="off"
                placeholder="https://" />
            </label>
            <label className="statfield">
              <span>Portal username</span>
              <input name="portalUsername" defaultValue={link?.portalUsername ?? ""} autoComplete="off" />
            </label>
            <label className="statfield">
              <span>Portal password</span>
              <input name="portalSecret" type="password" autoComplete="new-password"
                placeholder={link?.portalSecret ? "•••••••• — leave blank to keep" : "not set"} />
            </label>

            <div className="fieldpair">
              <label className="statfield">
                <span>Employee share (%)</span>
                <input name="employeeRate" type="number" step="0.0001" min="0" max="100"
                  defaultValue={link?.employeeRate == null ? "" : String(link.employeeRate)} />
              </label>
              <label className="statfield">
                <span>Employer share (%)</span>
                <input name="employerRate" type="number" step="0.0001" min="0" max="100"
                  defaultValue={link?.employerRate == null ? "" : String(link.employerRate)} />
              </label>
            </div>

            <div className="fieldpair">
              <label className="statfield">
                <span>Due from (day)</span>
                <input name="dueDayFrom" type="number" min="1" max="31"
                  defaultValue={link?.dueDayFrom ?? ""} />
              </label>
              <label className="statfield">
                <span>Due to (day)</span>
                <input name="dueDayTo" type="number" min="1" max="31"
                  defaultValue={link?.dueDayTo ?? ""} />
              </label>
            </div>

            <label className="statfield">
              <span>Contact name</span>
              <input name="contactName" defaultValue={link?.contactName ?? ""} autoComplete="off" />
            </label>
            <label className="statfield">
              <span>Contact email</span>
              <input name="contactEmail" type="email" defaultValue={link?.contactEmail ?? ""} autoComplete="off" />
            </label>
            <label className="statfield full">
              <span>Notes</span>
              <input name="notes" defaultValue={link?.notes ?? ""} autoComplete="off" />
            </label>

            <div className="statacts">
              <button className="btn-primary" type="submit"><IconSave /> Save connection</button>
              {link?.portalSecret && (
                <button className="reject icon" type="submit"
                  formAction={clearAgencySecret.bind(null, agency)}
                  title="Forget the stored password" aria-label="Forget the stored password">
                  <IconTrash />
                </button>
              )}
            </div>
          </form>
        ) : (
          <dl className="infolist">
            <div><dt>Employer number</dt><dd>{link?.employerNumber ?? "—"}</dd></div>
            <div><dt>Registered name</dt><dd>{link?.registeredName ?? "—"}</dd></div>
            <div><dt>Portal</dt><dd>{link?.portalUrl ?? "—"}</dd></div>
            <div><dt>Shares</dt>
              <dd>
                {link?.employeeRate == null && link?.employerRate == null
                  ? "not set"
                  : `${link?.employeeRate ?? "—"}% employee · ${link?.employerRate ?? "—"}% employer`}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="cat-head">
          <h2>Remittance roster</h2>
          <span className="spacer" />
          <span className="tree-meta">{members} of {staff} active staff have a {a.idLabel}</span>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          The member list, keyed on {a.idLabel}, ready to carry into {a.name}&rsquo;s
          own template. The compensation and share columns are left blank —
          argonaut holds no monthly pay yet, and a guessed figure on a statutory
          file is worse than an empty column.
        </p>

        {missing > 0 && (
          <p className="muted">
            {missing} active {missing === 1 ? "employee has" : "employees have"} no {a.idLabel} on
            record and {missing === 1 ? "is" : "are"} left out — a blank number is a rejected row.
          </p>
        )}

        <form className="billbar" action={`/api/agency/${AGENCY_SLUG[agency]}`} method="get">
          <input name="period" type="month" defaultValue={period} aria-label="Period" />
          <button className="btn-primary" type="submit" disabled={members === 0}
            title={members ? `Download the ${a.name} roster` : `No employee has a ${a.idLabel} yet`}>
            <IconDownload /> Download roster
          </button>
        </form>
      </div>
    </>
  );
}
