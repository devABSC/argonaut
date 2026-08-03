"use client";

import { useState } from "react";
import { IconPlus } from "../icons";
import { QUARTERS, quarterLabel } from "@/lib/quarters";

/**
 * A 2307 for one supplier over one period.
 *
 * Certificates are filed by quarter, so the period is chosen as a year and a
 * quarter rather than two dates — the BIR's own calendar, and it makes a
 * missing quarter obvious in the list.
 *
 * Picking a supplier from the register fills their TIN and registered address;
 * typing over it wins where a particular certificate needs something else.
 */
export default function Bir2307Form({
  suppliers,
  action,
}: {
  suppliers: { id: string; name: string; tin: string | null; address: string | null }[];
  action: (formData: FormData) => void;
}) {
  const [picked, setPicked] = useState("");
  const sup = suppliers.find((s) => s.id === picked);
  const thisYear = new Date().getUTCFullYear();

  return (
    <form action={action} className="coaform" key={picked || "blank"}>
      <label className="statfield">
        <span>Year</span>
        <input name="year" type="number" min="2000" max="2100" required defaultValue={thisYear} />
      </label>

      <label className="statfield">
        <span>Quarter</span>
        <select name="quarter" defaultValue="1" required>
          {QUARTERS.map((q) => (
            <option key={q} value={q}>Q{q} — {quarterLabel(q)}</option>
          ))}
        </select>
      </label>

      <label className="statfield">
        <span>Income Recipient / Payee</span>
        <select name="supplierId" value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="">— type the name below —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <label className="statfield">
        <span>Payee Name</span>
        <input name="supplierName" autoComplete="off" placeholder="As it appears on the certificate"
          defaultValue={sup?.name ?? ""} required={!picked} />
      </label>

      <label className="statfield">
        <span>Payee TIN</span>
        <input name="supplierTin" autoComplete="off" placeholder="000-000-000-000"
          defaultValue={sup?.tin ?? ""} />
      </label>

      <label className="statfield">
        <span>ZIP Code</span>
        <input name="zipCode" autoComplete="off" placeholder="0000" />
      </label>

      <label className="statfield full">
        <span>Registered Address</span>
        <input name="address" autoComplete="off" placeholder="As registered with the BIR"
          defaultValue={sup?.address ?? ""} />
      </label>

      <div className="statacts">
        <button className="btn-primary" type="submit"><IconPlus /> Create 2307</button>
      </div>
    </form>
  );
}
