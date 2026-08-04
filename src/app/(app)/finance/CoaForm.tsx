"use client";

import { useState } from "react";
import { QBO_ACCOUNT_TYPES, subtypesFor } from "@/lib/qbo";
import { IconPlus } from "@/app/icons";

/**
 * A new chart-of-accounts line.
 *
 * Type and subtype follow QuickBooks Online, so the two charts reconcile —
 * picking a type narrows the subtype list to the ones QBO allows under it, and
 * changing the type clears a subtype that no longer belongs.
 */
export type CoaDefaults = {
  code: string;
  name: string;
  accountType: string;
  accountSubType: string;
  parentId: string;
  description: string;
};

const EMPTY: CoaDefaults = {
  code: "", name: "", accountType: "", accountSubType: "", parentId: "", description: "",
};

export default function CoaForm({
  parents,
  action,
  defaults = EMPTY,
  submitLabel = "Add account",
  onCancel,
}: {
  /** Existing accounts, any of which a new one can sit under. */
  parents: { id: string; code: string; name: string }[];
  action: (formData: FormData) => void;
  /** Filled in when correcting an existing account. */
  defaults?: CoaDefaults;
  submitLabel?: string;
  /** Where Cancel goes. Absent on the add form, which has nothing to leave. */
  onCancel?: string;
}) {
  const [type, setType] = useState(defaults.accountType);
  const subs = subtypesFor(type);

  return (
    <form action={action} className="coaform" key={defaults.code || "new"}>
      <label className="statfield">
        <span>Account Name</span>
        <input name="name" required autoComplete="off" placeholder="e.g. Telco" defaultValue={defaults.name} />
      </label>

      <label className="statfield">
        <span>Account No.</span>
        <input name="code" required autoComplete="off" placeholder="e.g. 5100" defaultValue={defaults.code} />
      </label>

      <label className="statfield">
        <span>SubAccount of</span>
        <select name="parentId" defaultValue={defaults.parentId}>
          <option value="">— top level —</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
      </label>

      {/* One choice in two halves — the subtype only means anything next to
          its type, so they stay side by side at every width. */}
      <div className="fieldpair">
        <label className="statfield">
          <span>Account Type</span>
          <select name="accountType" value={type} onChange={(e) => setType(e.target.value)} required>
            <option value="" disabled>Choose a type</option>
            {QBO_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="statfield">
          <span>Account Subtype</span>
          <select name="accountSubType" defaultValue={defaults.accountSubType} disabled={!type}
            title={type ? undefined : "Choose an account type first"}>
            <option value="">{type ? "— none —" : "Choose a type first"}</option>
            {subs.map((sSub) => <option key={sSub} value={sSub}>{sSub}</option>)}
          </select>
        </label>
      </div>

      <label className="statfield full">
        <span>Account Description</span>
        <input name="description" autoComplete="off" placeholder="What belongs in this account" defaultValue={defaults.description} />
      </label>

      <div className="statacts">
        <button className="btn-primary" type="submit"><IconPlus /> {submitLabel}</button>
        {onCancel && <a className="subtab" href={onCancel}>Cancel</a>}
      </div>
    </form>
  );
}
