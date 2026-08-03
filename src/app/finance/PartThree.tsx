"use client";

import { useState } from "react";
import { IconPlus, IconTrash } from "../icons";

type Row = { nature: string; atc: string; amount: string; tax: string };

const peso = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (v: string) => {
  const n = Number(v.replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Part III — Details of Income Payment and Tax Withheld.
 *
 * As many rows as the certificate needs, with the total kept live at the foot
 * the way the printed form has it. Rows post as one field each so the whole
 * certificate is raised in a single submit, rather than created empty and
 * filled in afterwards.
 */
export default function PartThree() {
  const [rows, setRows] = useState<Row[]>([{ nature: "", atc: "", amount: "", tax: "" }]);

  const set = (i: number, k: keyof Row, v: string) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const totalAmount = rows.reduce((t, r) => t + num(r.amount), 0);
  const totalTax = rows.reduce((t, r) => t + num(r.tax), 0);

  return (
    <div className="partiii full">
      <div className="cat-head">
        <h2>Part III — Details of Income Payment and Tax Withheld</h2>
        <span className="spacer" />
        <button className="ghost icon" type="button"
          onClick={() => setRows([...rows, { nature: "", atc: "", amount: "", tax: "" }])}
          title="Add a row" aria-label="Add a row"><IconPlus /></button>
      </div>

      <div className="p3head">
        <span>Nature of Income Payment</span>
        <span>ATC</span>
        <span className="amt">Amount of Payment</span>
        <span className="amt">Tax Withheld</span>
        <span />
      </div>

      {rows.map((r, i) => (
        <div className="p3row" key={i}>
          {/* Each cell carries its own field; the server pairs them by index. */}
          <input name="ln_nature" value={r.nature} onChange={(e) => set(i, "nature", e.target.value)}
            placeholder="e.g. Professional fees" autoComplete="off" aria-label="Nature of income payment" />
          <input name="ln_atc" value={r.atc} onChange={(e) => set(i, "atc", e.target.value)}
            placeholder="WI010" autoComplete="off" aria-label="ATC" />
          <input name="ln_amount" value={r.amount} onChange={(e) => set(i, "amount", e.target.value)}
            type="number" step="0.01" min="0" placeholder="0.00" aria-label="Amount of payment" />
          <input name="ln_tax" value={r.tax} onChange={(e) => set(i, "tax", e.target.value)}
            type="number" step="0.01" min="0" placeholder="0.00" aria-label="Tax withheld" />
          {rows.length > 1 ? (
            <button className="reject icon" type="button"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              title="Remove this row" aria-label="Remove this row"><IconTrash /></button>
          ) : (
            <span />
          )}
        </div>
      ))}

      <div className="p3row total">
        <span>Total</span>
        <span />
        <span className="amt">{peso(totalAmount)}</span>
        <span className="amt">{peso(totalTax)}</span>
        <span />
      </div>
    </div>
  );
}
