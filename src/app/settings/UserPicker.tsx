"use client";

import { useRouter } from "next/navigation";

/** Chooses whose overrides to edit; the choice lives in the URL. */
export default function UserPicker({
  users,
  selected,
}: {
  users: { id: string; label: string }[];
  selected: string;
}) {
  const router = useRouter();

  return (
    <div className="picker one">
      <div className="pvf">
        <label>User</label>
        <select
          value={selected}
          onChange={(e) =>
            router.push(e.target.value ? `/settings/rbac?u=${e.target.value}` : "/settings/rbac")
          }
        >
          <option value="">— choose a user —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
      </div>
    </div>
  );
}
