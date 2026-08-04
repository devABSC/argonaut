"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PickerCategory = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

/**
 * Service Type then Service Subtype. Choosing a subtype navigates with ?sub=,
 * which is what loads its form — the fields are resolved on the server so the
 * form definition never has to be shipped to the browser.
 */
export default function RequestPicker({
  categories,
  selectedCategoryId = "",
  selectedSubcategoryId = "",
}: {
  categories: PickerCategory[];
  selectedCategoryId?: string;
  selectedSubcategoryId?: string;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(selectedCategoryId);
  const subs = categories.find((c) => c.id === categoryId)?.subcategories ?? [];

  return (
    <div className="picker">
      <div className="pvf">
        <label>Pick Service Type <span className="rq">*</span></label>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            router.push("/service-desk/new-request");
          }}
        >
          <option value="">— choose —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="pvf">
        <label>Pick Service Subtype <span className="rq">*</span></label>
        <select
          value={selectedSubcategoryId}
          disabled={!categoryId}
          onChange={(e) => {
            const v = e.target.value;
            router.push(v ? `/service-desk/new-request?sub=${v}` : "/service-desk/new-request");
          }}
        >
          <option value="">{categoryId ? "— choose —" : "Pick a service type first"}</option>
          {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {categoryId && subs.length === 0 && (
          <span className="pvhelp">No subtypes set up under this service type yet.</span>
        )}
      </div>
    </div>
  );
}
