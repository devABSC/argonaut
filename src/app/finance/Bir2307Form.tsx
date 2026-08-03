"use client";

import { useState } from "react";
import { IconPlus } from "../icons";

/**
 * A 2307 for one supplier over one period.
 *
 * Picking a supplier from the register fills their TIN and registered address,
 * which is where the certificate's own details come from — typed over where a
 * particular certificate needs something different.
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

  return (
    <form action={action} className="coaform" key={picked || "blank"}>
      <label className="statfield">
        <span>Period from</span>
        <input name="periodFrom" type="date" required />
      </label>

      <label className="statfield">
        <span>Period to</span>
        <input name="periodTo" type="date" required />
      </label>

      <label className="statfield">
        <span>Supplier</span>
        <select name="supplierId" value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="">— type the name below —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <label className="statfield">
        <span>Supplier Name</span>
        <input name="supplierName" autoComplete="off" placeholder="As it appears on the certificate"
          defaultValue={sup?.name ?? ""} required={!picked} />
      </label>

      <label className="statfield">
        <span>Supplier TIN</span>
        <input name="supplierTin" autoComplete="off" placeholder="000-000-000-000"
          defaultValue={sup?.tin ?? ""} />
      </label>

      <label className="statfield full">
        <span>Registered Address</span>
        <input name="address" autoComplete="off" placeholder="As registered with the BIR"
          defaultValue={sup?.address ?? ""} />
      </label>

      <div className="statacts">
        <button className="btn-primary" type="submit"><IconPlus /> Add 2307</button>
      </div>
    </form>
  );
}
