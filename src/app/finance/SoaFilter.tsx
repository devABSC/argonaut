"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconPlus } from "../icons";

/**
 * One line: BOU, employee, period, create.
 *
 * The two selects navigate rather than submit — picking a BOU re-scopes the
 * employee list straight away, and clears a person who belonged to the BOU you
 * just left. The button is the only thing that writes, so filtering and
 * creating can share a single row without one triggering the other.
 */
export default function SoaFilter({
  bou,
  emp,
  bous,
  staff,
  action,
}: {
  bou: string;
  emp: string;
  bous: { id: string; name: string }[];
  /** Already scoped to `bou` by the server. */
  staff: { id: string; name: string }[];
  action: (formData: FormData) => void;
}) {
  const router = useRouter();
  const [who, setWho] = useState(emp);

  const go = (nextBou: string, nextEmp: string) => {
    const q = new URLSearchParams();
    if (nextBou) q.set("bou", nextBou);
    if (nextEmp) q.set("emp", nextEmp);
    const s = q.toString();
    router.push(s ? `/finance/soa?${s}` : "/finance/soa");
  };

  const picked = staff.find((e) => e.id === who);

  return (
    <form action={action} className="soabar">
      <select
        name="bou"
        defaultValue={bou}
        aria-label="BOU"
        onChange={(e) => { setWho(""); go(e.target.value, ""); }}
      >
        <option value="">All BOUs</option>
        {bous.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <select
        name="emp"
        value={who}
        aria-label="Employee"
        onChange={(e) => { setWho(e.target.value); go(bou, e.target.value); }}
      >
        <option value="">{staff.length ? "All employees" : "No active staff in this BOU"}</option>
        {staff.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      <input name="periodFrom" type="date" title="Period from" aria-label="Period from" />
      <input name="periodTo" type="date" title="Period to" aria-label="Period to" />

      <button className="btn-primary" type="submit" disabled={!who}
        title={picked ? `Raise a statement for ${picked.name}` : "Pick an employee first"}>
        <IconPlus /> Create SOA
      </button>

      {(bou || who) && <a className="clear" href="/finance/soa">Clear</a>}
    </form>
  );
}
