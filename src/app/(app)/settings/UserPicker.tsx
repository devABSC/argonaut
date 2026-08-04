"use client";

import { useRouter } from "next/navigation";

/**
 * Narrow by BOU first, then pick the person. A flat list of every account
 * stops being usable as the headcount grows, and the BOU is how people are
 * actually grouped.
 */
export default function UserPicker({
  bous,
  users,
  selected,
  selectedBou,
}: {
  bous: { id: string; label: string; count: number }[];
  users: { id: string; label: string }[];
  selected: string;
  selectedBou: string;
}) {
  const router = useRouter();

  const go = (bou: string, user: string) => {
    const p = new URLSearchParams();
    if (bou) p.set("bou", bou);
    if (user) p.set("u", user);
    router.push(`/settings/rbac${p.toString() ? `?${p}` : ""}`);
  };

  return (
    <div className="picker">
      <div className="pvf">
        <label>BOU</label>
        {/* Changing the BOU clears the person — otherwise the form keeps
            editing someone who is no longer in the list. */}
        <select value={selectedBou} onChange={(e) => go(e.target.value, "")}>
          <option value="">— all BOUs —</option>
          {bous.map((b) => (
            <option key={b.id} value={b.id}>{b.label} ({b.count})</option>
          ))}
          <option value="none">— no employee record —</option>
        </select>
      </div>

      <div className="pvf">
        <label>Person</label>
        <select value={selected} onChange={(e) => go(selectedBou, e.target.value)}>
          <option value="">
            {users.length ? "— choose a person —" : "— nobody here has an account —"}
          </option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
      </div>
    </div>
  );
}
