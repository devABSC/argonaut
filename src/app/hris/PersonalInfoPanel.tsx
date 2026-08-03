import Link from "next/link";
import { prisma } from "@/lib/prisma";

const fmtDate = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : "—";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value && value.trim() !== "" ? value : "—"}</dd>
    </div>
  );
}

/** One employee's record. Reached from the Emp ID link on the Employees tab. */
export default async function PersonalInfoPanel({ empId }: { empId?: string }) {
  if (!empId) {
    return (
      <div className="panel">
        <h2>Personal Info</h2>
        <p>Pick someone from the Employees tab — open their Emp ID to see this page.</p>
        <div className="viewbar" style={{ justifyContent: "flex-start", marginTop: 14 }}>
          <Link className="viewtoggle" href="/hris/employees">Browse employees →</Link>
        </div>
      </div>
    );
  }

  const e = await prisma.employee.findUnique({
    where: { id: empId },
    include: { bou: { select: { name: true } } },
  });
  if (!e) {
    return (
      <div className="panel">
        <h2>Personal Info</h2>
        <p>That employee record no longer exists.</p>
      </div>
    );
  }

  const fullName = [e.lastName, e.firstName].filter(Boolean).join(", ") +
    (e.middleName ? ` ${e.middleName}` : "");

  return (
    <>
      <div className="viewbar">
        <Link className="viewtoggle" href="/hris/employees">← Back to employees</Link>
      </div>

      <div className="panel">
        <div className="cat-head">
          <h2>{fullName}</h2>
          <span className="ticket">{e.individ}</span>
          <span className="spacer" />
          {e.company && <span className="tree-meta">{e.company}</span>}
        </div>

        <h3 className="tsubject">{e.jobTitle ?? "No job title on file"}</h3>

        <p className="secdiv">Identity</p>
        <dl className="tmeta wide">
          <Field label="Last name" value={e.lastName} />
          <Field label="First name" value={e.firstName} />
          <Field label="Middle name" value={e.middleName} />
          <Field label="Birth date" value={fmtDate(e.birthDate)} />
          <Field label="Employee ID" value={e.individ} />
          <Field label="Senior citizen" value={e.isSenior == null ? null : e.isSenior ? "Yes" : "No"} />
          <Field label="PWD" value={e.isPWD == null ? null : e.isPWD ? "Yes" : "No"} />
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
          <Field label="Country" value={e.country} />
          <Field label="Zip code" value={e.zipCode} />
        </dl>

        <p className="secdiv">Employment</p>
        <dl className="tmeta wide">
          <Field label="Company" value={e.company} />
          <Field label="Job title" value={e.jobTitle} />
          <Field label="BOU" value={e.bou?.name ?? e.bouID} />
          <Field label="Department" value={e.subBou} />
          <Field label="Biometric ID" value={e.biometricID} />
          <Field label="Encoded by" value={e.encodedBy} />
          <Field label="Source created" value={fmtDate(e.sourceCreatedAt)} />
          <Field label="Source updated" value={fmtDate(e.sourceUpdatedAt)} />
        </dl>
      </div>
    </>
  );
}
