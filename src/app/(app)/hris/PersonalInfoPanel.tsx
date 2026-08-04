import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { saveEmployeeContact, saveEmployeeEmployment } from "@/app/actions/employees";
import CityRegion from "./CityRegion";
import { IconSave } from "@/app/icons";

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
    include: { bou: { select: { id: true, name: true } } },
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

  // encodedBy holds another employee's source id; show the person, not the code.
  const [bous, cities, encoder] = await Promise.all([
    prisma.bou.findMany({
      where: { OR: [{ isActive: true }, { id: e.bouId ?? "" }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.city.findMany({
      orderBy: { name: "asc" },
      where: { isActive: true },
      select: { name: true, province: true, region: true, zipCode: true },
    }),
    e.encodedBy
      ? prisma.employee.findFirst({
          where: { individ: e.encodedBy },
          select: { firstName: true, lastName: true },
        })
      : null,
  ]);
  const encodedByName = encoder ? `${encoder.firstName} ${encoder.lastName}` : e.encodedBy;

  return (
    <>
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
        </dl>

        <form action={saveEmployeeContact} className="statgrid">
          <input type="hidden" name="empId" value={e.id} />
          <label className="statfield"><span>Mobile</span>
            <input name="mobile" defaultValue={e.mobile ?? ""} autoComplete="off" /></label>
          <label className="statfield"><span>Landline</span>
            <input name="landline" defaultValue={e.landline ?? ""} autoComplete="off" /></label>
          <label className="statfield"><span>Street</span>
            <input name="street" defaultValue={e.street ?? ""} autoComplete="off" /></label>

          <div className="statfield cityset">
            <CityRegion
              cities={cities}
              city={e.city ?? ""}
              province={e.state ?? ""}
              region={e.region ?? ""}
              zipCode={e.zipCode ?? ""}
            />
          </div>

          <label className="statfield"><span>Country</span>
            <input name="country" defaultValue={e.country || "Philippines"} autoComplete="off" /></label>
          <div className="statacts">
            <button className="btn-primary" type="submit"><IconSave /> Save contact</button>
          </div>
        </form>

        <p className="secdiv">Employment</p>

        <form action={saveEmployeeEmployment} className="statgrid">
          <input type="hidden" name="empId" value={e.id} />
          <label className="statfield"><span>Job title</span>
            <input name="jobTitle" defaultValue={e.jobTitle ?? ""} autoComplete="off" /></label>
          <label className="statfield"><span>BOU</span>
            <select name="bouId" defaultValue={e.bouId ?? ""}>
              <option value="">— no BOU —</option>
              {bous.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="statfield"><span>Department</span>
            <input name="subBou" defaultValue={e.subBou ?? ""} autoComplete="off" /></label>

          <div className="statacts">
            <button className="btn-primary" type="submit"><IconSave /> Save employment</button>
          </div>
        </form>

        <dl className="tmeta wide">
          <Field label="Company" value={e.company} />
          <Field label="Biometric ID" value={e.biometricID} />
          <Field label="Encoded by" value={encodedByName} />
          <Field label="Source created" value={fmtDate(e.sourceCreatedAt)} />
          <Field label="Source updated" value={fmtDate(e.sourceUpdatedAt)} />
        </dl>
      </div>
    </>
  );
}
