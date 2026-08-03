"use client";

import { useState } from "react";
import { IconPlus } from "../icons";
import PartThree from "./PartThree";
import { QUARTERS, quarterLabel, quarterRange } from "@/lib/quarters";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * A 2307 for one supplier over one period.
 *
 * Certificates are filed by quarter, so the period is chosen as a year and a
 * quarter rather than two dates — the BIR's own calendar, and it makes a
 * missing quarter obvious in the list.
 *
 * Both sides are picked from a list: the buyer is one of our registered
 * companies, the payee one of the suppliers on the register. Their TIN and
 * address come from those records rather than being retyped, so a certificate
 * can never disagree with the register it was raised from.
 */
export default function Bir2307Form({
  suppliers,
  companies,
  action,
}: {
  suppliers: {
    id: string; name: string; tin: string | null; address: string | null;
    companyId: string | null;
  }[];
  companies: { id: string; name: string }[];
  action: (formData: FormData) => void;
}) {
  const [buyer, setBuyer] = useState(companies[0]?.id ?? "");
  const [picked, setPicked] = useState("");
  // A supplier belongs to one company, so changing the buyer changes who can
  // be named. One left over from the previous buyer is dropped.
  const mine = suppliers.filter((s) => !s.companyId || s.companyId === buyer);
  const sup = mine.find((s) => s.id === picked);
  const thisYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(thisYear);
  const [quarter, setQuarter] = useState(1);

  // The quarter sets the dates; touching a date leaves it where it was put.
  const span = quarterRange(year, quarter);
  const [from, setFrom] = useState(iso(span.from));
  const [to, setTo] = useState(iso(span.to));
  const [span0, setSpan0] = useState(`${year}-${quarter}`);
  if (span0 !== `${year}-${quarter}`) {
    setSpan0(`${year}-${quarter}`);
    setFrom(iso(span.from));
    setTo(iso(span.to));
  }

  return (
    <form action={action} className="coaform" key={`${buyer}:${picked}`}>
      <label className="statfield">
        <span>Year</span>
        <input name="year" type="number" min="2000" max="2100" required value={year}
          onChange={(e) => setYear(Number(e.target.value))} />
      </label>

      <label className="statfield">
        <span>Quarter</span>
        <select name="quarter" required value={quarter}
          onChange={(e) => setQuarter(Number(e.target.value))}>
          {QUARTERS.map((q) => (
            <option key={q} value={q}>Q{q} — {quarterLabel(q)}</option>
          ))}
        </select>
      </label>

      {/* The period the certificate covers. It follows the quarter picked
          above, and stays editable — a certificate is sometimes raised for
          part of one. */}
      <div className="fieldpair">
        <label className="statfield">
          <span>Period from</span>
          <input name="periodFrom" type="date" required
            value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>

        <label className="statfield">
          <span>Period to</span>
          <input name="periodTo" type="date" required
            value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <label className="statfield">
        <span>Buyer / Withholding Agent</span>
        <select name="companyId" required value={buyer}
          onChange={(e) => { setBuyer(e.target.value); setPicked(""); }}>
          {companies.length === 0 && <option value="">No company registered</option>}
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      {/* Both sides come from a list — the details on a certificate are the
          ones already registered, not retyped per certificate. */}
      <label className="statfield">
        <span>Supplier / Payee</span>
        <select name="supplierId" required value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="" disabled>
            {mine.length ? "Choose a supplier" : "No suppliers under this buyer yet"}
          </option>
          {mine.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      {/* Read straight off the chosen supplier, so what will be printed is
          visible before the certificate is raised. */}
      <dl className="infolist picked">
        <div><dt>Payee TIN</dt><dd>{sup?.tin || "—"}</dd></div>
        <div><dt>Registered Address</dt><dd>{sup?.address || "—"}</dd></div>
      </dl>

      <PartThree />

      <div className="statacts">
        <button className="btn-primary" type="submit"
          disabled={!mine.length || !companies.length}
          title={mine.length ? "Raise this certificate" : "Add a supplier for this buyer first"}>
          <IconPlus /> Create 2307
        </button>
      </div>
    </form>
  );
}
