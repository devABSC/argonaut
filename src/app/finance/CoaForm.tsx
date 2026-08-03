"use client";

import { useState } from "react";
import { QBO_ACCOUNT_TYPES, subtypesFor } from "@/lib/qbo";
import { IconPlus } from "../icons";

/**
 * A new chart-of-accounts line.
 *
 * Type and subtype follow QuickBooks Online, so the two charts reconcile —
 * picking a type narrows the subtype list to the ones QBO allows under it, and
 * changing the type clears a subtype that no longer belongs.
 */
export default function CoaForm({
  parents,
  action,
}: {
  /** Existing accounts, any of which a new one can sit under. */
  parents: { id: string; code: string; name: string }[];
  action: (formData: FormData) => void;
}) {
  const [type, setType] = useState("");
  const subs = subtypesFor(type);

  return (
    <form action={action} className="coaform">
      <label className="statfield">
        <span>Account Name</span>
        <input name="name" required autoComplete="off" placeholder="e.g. Telco" />
      </label>

      <label className="statfield">
        <span>Account No.</span>
        <input name="code" required autoComplete="off" placeholder="e.g. 5100" />
      </label>

      <label className="statfield">
        <span>Account Type</span>
        <select name="accountType" value={type} onChange={(e) => setType(e.target.value)} required>
          <option value="" disabled>Choose a type</option>
          {QBO_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label className="statfield">
        <span>Account Subtype</span>
        <select name="accountSubType" defaultValue="" disabled={!type}
          title={type ? undefined : "Choose an account type first"}>
          <option value="">{type ? "— none —" : "Choose a type first"}</option>
          {subs.map((sSub) => <option key={sSub} value={sSub}>{sSub}</option>)}
        </select>
      </label>

      <label className="statfield">
        <span>SubAccount of</span>
        <select name="parentId" defaultValue="">
          <option value="">— top level —</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
      </label>

      <label className="statfield full">
        <span>Account Description</span>
        <input name="description" autoComplete="off" placeholder="What belongs in this account" />
      </label>

      <div className="statacts">
        <button className="btn-primary" type="submit"><IconPlus /> Add account</button>
      </div>
    </form>
  );
}
