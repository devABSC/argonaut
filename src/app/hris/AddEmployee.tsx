"use client";

import { useState } from "react";
import { createEmployee } from "../actions/employees";
import { IconPlus } from "../icons";
import SubmitButton from "../SubmitButton";
import CityRegion, { type CityOption } from "./CityRegion";

const EMP_STATUS = ["Term-Based", "Probationary", "Regular", "Project-Based", "Consultant"];
const EMP_TYPE = ["Rank & File", "Supervisory", "Managerial", "Executive"];
const STATUS = ["Active", "Resigned", "Terminated", "On Leave"];

/**
 * Add Employee, folded away until needed so it does not push the list down.
 * Mirrors the fields on the HRIS information sheet; Emp ID is generated when
 * left blank, and Age and Tenure are derived rather than stored.
 */
export default function AddEmployee({
  bous, companies, cities,
}: {
  bous: { id: string; name: string }[];
  companies: { code: string; name: string }[];
  cities: CityOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="addemp">
      <button type="button" className="addtoggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <IconPlus /> {open ? "Cancel" : "Add employee"}
      </button>

      {open && (
        <form action={createEmployee} className="empform">
          <p className="secdiv">Identity</p>
          <div className="grid3">
            <label><span>Emp ID</span><input name="individ" placeholder="Generated if left blank" /></label>
            <label><span>Email</span><input name="emailAdd" type="email" placeholder="name@atomitsoln.com" /></label>
            <label><span>Job title</span><input name="jobTitle" placeholder="Jr Network Administrator" /></label>

            <label><span>Last name *</span><input name="lastName" required /></label>
            <label><span>First name *</span><input name="firstName" required /></label>
            <label><span>Middle name</span><input name="middleName" /></label>

            <label><span>BOU</span>
              <select name="bouId" defaultValue="">
                <option value="">— none —</option>
                {bous.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label><span>Sub-BOU / Dept</span><input name="subBou" /></label>
            <label><span>Company</span>
              {/* First registered company wins — ordered on the Company page. */}
              <select name="company" defaultValue={companies[0]?.code ?? ""}>
                {companies.length === 0 && <option value="">— none registered —</option>}
                {companies.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
          </div>

          <p className="secdiv">Address</p>
          <div className="grid3">
            <label><span>Street</span><input name="street" /></label>
            <CityRegion cities={cities} />
          </div>

          <p className="secdiv">Employment</p>
          <div className="grid3">
            <label><span>Start date</span><input name="startDate" type="date" /></label>
            <label><span>Birthdate</span><input name="birthDate" type="date" /></label>
            <label><span>Gender</span>
              <select name="gender" defaultValue="">
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>

            <label><span>Emp status</span>
              <select name="empStatus" defaultValue="">
                <option value="">—</option>
                {EMP_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label><span>Emp type</span>
              <select name="empType" defaultValue="">
                <option value="">—</option>
                {EMP_TYPE.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label><span>Status</span>
              <select name="employmentStatus" defaultValue="Active">
                {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <p className="secdiv">Contact</p>
          <div className="grid3">
            <label><span>Mobile 1</span><input name="mobile" placeholder="09XXXXXXXXX" /></label>
            <label><span>Mobile 2</span><input name="mobile2" /></label>
            <label><span>Landline</span><input name="landline" /></label>
          </div>

          <p className="secdiv">Contract</p>
          <div className="grid3">
            <label><span>End of contract</span><input name="endOfContract" type="date" /></label>
            <label><span>Last working date</span><input name="lastWorkingDate" type="date" /></label>
            <label><span>Termination date</span><input name="terminationDate" type="date" /></label>
          </div>

          <div className="checkrow">
            <label className="req"><input type="checkbox" name="hasAccess" /> Access</label>
            <label className="req"><input type="checkbox" name="hasExpense" /> Expense</label>
          </div>

          <label className="full"><span>Remarks</span>
            <textarea name="remarks" rows={3} maxLength={500} placeholder="Up to 500 characters" />
          </label>

          <SubmitButton label="Save employee" />
        </form>
      )}
    </div>
  );
}
