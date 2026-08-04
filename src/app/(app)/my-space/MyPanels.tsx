import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PASSWORD_MAX_AGE_DAYS } from "@/lib/auth";
import ChangePasswordForm from "@/app/change-password/ChangePasswordForm";

const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value && String(value).trim() ? value : "—"}</dd>
    </div>
  );
}

/**
 * Everyone's own corner. Personal Info and Statutory are read-only here — a
 * person can check what HR holds on them, but corrections go through HR rather
 * than being self-edited.
 *
 * The HRIS record is matched by email; Employee.userId is not populated.
 */
async function myRecord(email: string) {
  return prisma.employee.findFirst({
    where: { emailAdd: { equals: email, mode: "insensitive" } },
    include: { bou: { select: { name: true } } },
  });
}

function NoRecord({ what }: { what: string }) {
  return (
    <div className="panel">
      <h2>{what}</h2>
      <p>
        No HRIS record is linked to your sign-in address, so there is nothing to
        show. Ask HR to check the email on your employee record.
      </p>
    </div>
  );
}

export async function MyPersonalInfo({ email }: { email: string }) {
  const e = await myRecord(email);
  if (!e) return <NoRecord what="Personal Info" />;

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>{e.firstName} {e.lastName}</h2>
        <span className="ticket">{e.individ}</span>
        <span className="spacer" />
        <span className="tree-meta">view only — ask HR to correct anything wrong</span>
      </div>
      <h3 className="tsubject">{e.jobTitle ?? "No job title on file"}</h3>

      <p className="secdiv">Identity</p>
      <dl className="tmeta wide">
        <Field label="Last name" value={e.lastName} />
        <Field label="First name" value={e.firstName} />
        <Field label="Middle name" value={e.middleName} />
        <Field label="Birth date" value={fmtDate(e.birthDate)} />
        <Field label="Gender" value={e.gender} />
        <Field label="Employee ID" value={e.individ} />
      </dl>

      <p className="secdiv">Contact</p>
      <dl className="tmeta wide">
        <Field label="Email" value={e.emailAdd} />
        <Field label="Mobile" value={e.mobile} />
        <Field label="Landline" value={e.landline} />
        <Field label="Street" value={e.street} />
        <Field label="City" value={e.city} />
        <Field label="Province" value={e.state} />
        <Field label="Region" value={e.region} />
        <Field label="Zip code" value={e.zipCode} />
      </dl>

      <p className="secdiv">Employment</p>
      <dl className="tmeta wide">
        <Field label="Company" value={e.company} />
        <Field label="BOU" value={e.bou?.name} />
        <Field label="Department" value={e.subBou} />
        <Field label="Emp status" value={e.empStatus} />
        <Field label="Emp type" value={e.empType} />
        <Field label="Start date" value={fmtDate(e.startDate)} />
      </dl>
    </div>
  );
}

export async function MyStatutory({ email }: { email: string }) {
  const e = await myRecord(email);
  if (!e) return <NoRecord what="Statutory" />;

  const fields = [
    ["Company ID", e.compId], ["TIN ID", e.tinId], ["SSS ID", e.sssId],
    ["Philhealth ID", e.philId], ["Pagibig", e.pagibigId], ["HMO ID", e.hmoId],
  ] as const;
  const onFile = fields.filter(([, v]) => v).length;

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Statutory</h2>
        <span className="count">{onFile} of {fields.length} on file</span>
        <span className="spacer" />
        <span className="tree-meta">view only</span>
      </div>
      <p>
        What HR holds against your record. A blank means nothing is on file —
        raise it with HR rather than assuming it is wrong here.
      </p>
      <dl className="tmeta wide">
        {fields.map(([label, value]) => <Field key={label} label={label} value={value} />)}
      </dl>
    </div>
  );
}

export function MyPassword({ name, changedAt }: { name: string; changedAt: Date | null }) {
  const due = changedAt
    ? new Date(changedAt.getTime() + PASSWORD_MAX_AGE_DAYS * 86_400_000)
    : null;

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Change password</h2>
        <span className="spacer" />
        <span className="tree-meta">
          {changedAt ? `last changed ${fmtDate(changedAt)}` : "never changed"}
          {due && ` · due ${fmtDate(due)}`}
        </span>
      </div>
      <p>
        At least 12 characters, with letters, digits and a special character.
        A password you have used before will be refused.
      </p>
      <div className="pwform">
        <ChangePasswordForm forced={false} name={name} />
      </div>
    </div>
  );
}

export async function MyNotifications({ email }: { email: string }) {
  const rows = await prisma.notification.findMany({
    where: { to: { equals: email, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="panel">
      <div className="cat-head">
        <h2>Notifications <span className="count">{rows.length}</span></h2>
        <span className="spacer" />
        <span className="tree-meta">everything the system has sent you</span>
      </div>

      {rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>Nothing yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="utable">
            <thead>
              <tr><th className="numcol">No.</th><th>Subject</th><th>Kind</th><th>Status</th><th>Sent</th></tr>
            </thead>
            <tbody>
              {rows.map((n, i) => (
                <tr key={n.id}>
                  <td className="numcol">{i + 1}</td>
                  <td><b>{n.subject}</b></td>
                  <td className="muted">{n.kind}</td>
                  <td>
                    <span className={`pill ${n.status === "sent" ? "s-ACTIVE" : n.status === "failed" ? "s-REJECTED" : "s-PENDING"}`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="muted nowrap">{fmtDate(n.sentAt ?? n.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MyOverviewLinks() {
  return (
    <div className="viewbar" style={{ marginTop: 14 }}>
      <Link className="viewtoggle" href="/my-space/personal-info">My personal info →</Link>
    </div>
  );
}
