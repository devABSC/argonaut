"use client";

import { useState } from "react";
import { IconPlus } from "../icons";

/**
 * One row: supplier, account, recurring, amount — and MSF, which only exists
 * on a telco account.
 *
 * The MSF box appears the moment Telco is picked rather than sitting there
 * greyed out on every other account, so the form only ever asks for what the
 * chosen account actually has.
 */
export default function BillForm({
  suppliers,
  accounts,
  action,
}: {
  suppliers: { id: string; name: string }[];
  accounts: { id: string; code: string; name: string }[];
  action: (formData: FormData) => void;
}) {
  const [coaId, setCoaId] = useState("");
  const telco = accounts.some((a) => a.id === coaId && /telco/i.test(a.name));

  return (
    <form action={action} className="billbar">
      <select name="supplierId" required defaultValue="" aria-label="Supplier">
        <option value="" disabled>{suppliers.length ? "Supplier" : "No suppliers yet"}</option>
        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <select
        name="coaId"
        required
        value={coaId}
        aria-label="Chart of Accounts"
        onChange={(e) => setCoaId(e.target.value)}
      >
        <option value="" disabled>{accounts.length ? "COA" : "No accounts yet"}</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
      </select>

      <select name="recurring" defaultValue="N" aria-label="Recurring" title="Does this bill repeat?">
        <option value="N">Recurring: N</option>
        <option value="Y">Recurring: Y</option>
      </select>

      {telco && (
        <input name="msf" type="number" step="0.01" min="0" placeholder="MSF"
          aria-label="Monthly service fee" title="Monthly service fee — telco accounts only" />
      )}

      <input name="invoiceAmount" type="number" step="0.01" min="0" required
        placeholder="Invoice amount" aria-label="Invoice amount" />

      <button className="btn-primary" type="submit" disabled={!suppliers.length || !accounts.length}
        title={suppliers.length && accounts.length ? "Add this bill" : "Add a supplier and an account first"}>
        <IconPlus /> Add bill
      </button>
    </form>
  );
}
