"use client";

import { useState } from "react";

/**
 * The Supplier Info box, laid out to mirror Buyer Info beside it — same seven
 * lines, in the same order, so the two read as one comparison.
 *
 * Picking an existing supplier loads their details for correcting; leaving the
 * picker on "new" adds one. This is the box that gets used over and over; the
 * buyer beside it is entered once.
 */
export default function SupplierInfoForm({
  suppliers,
  companies,
  action,
}: {
  suppliers: {
    id: string; name: string; tin: string | null; address: string | null;
    city: string | null; region: string | null; country: string | null;
    issuanceDate: string | null;
    companyId: string | null;
  }[];
  companies: { id: string; name: string }[];
  action: (formData: FormData) => void;
}) {
  const [picked, setPicked] = useState("");
  const s = suppliers.find((x) => x.id === picked);

  return (
    <form action={action} className="infoform" key={picked || "new"}>
      <input type="hidden" name="supplierId" value={picked} />

      <label className="inforow pick">
        <span>Existing</span>
        <select value={picked} onChange={(e) => setPicked(e.target.value)}
          aria-label="Load an existing supplier">
          <option value="">— new supplier —</option>
          {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>

      {/* A supplier is registered under one of our companies — that is the
          relation the certificate is raised on. */}
      <label className="inforow">
        <span>Buyer</span>
        <select name="companyId" defaultValue={s?.companyId ?? companies[0]?.id ?? ""} required>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label className="inforow">
        <span>Company Name</span>
        <input name="name" required defaultValue={s?.name ?? ""} autoComplete="off" />
      </label>

      <label className="inforow">
        <span>TIN No</span>
        <input name="tin" defaultValue={s?.tin ?? ""} placeholder="000-000-000-000000" autoComplete="off" />
      </label>

      <label className="inforow">
        <span>Issuance Date</span>
        <input name="issuanceDate" type="date" defaultValue={s?.issuanceDate ?? ""} />
      </label>

      <label className="inforow">
        <span>Registered Add</span>
        <textarea name="address" rows={2} defaultValue={s?.address ?? ""} autoComplete="off" />
      </label>

      <label className="inforow">
        <span>City</span>
        <input name="city" defaultValue={s?.city ?? ""} autoComplete="off" />
      </label>

      <label className="inforow">
        <span>Region</span>
        <input name="region" defaultValue={s?.region ?? ""} autoComplete="off" />
      </label>

      <label className="inforow">
        <span>Country</span>
        <input name="country" defaultValue={s?.country ?? "PHILIPPINES"} autoComplete="off" />
      </label>

      <div className="infoact">
        <button className="btn-primary wide" type="submit">
          {picked ? "SAVE SUPPLIER" : "ADD SUPPLIER"}
        </button>
      </div>
    </form>
  );
}
