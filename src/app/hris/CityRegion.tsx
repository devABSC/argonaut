"use client";

import { useState } from "react";

export type CityOption = { name: string; province: string | null; region: string | null };

/**
 * City is chosen from the register; province and region follow from it rather
 * than being asked for again. Both stay editable for the cases the register
 * has not caught up with.
 */
export default function CityRegion({ cities }: { cities: CityOption[] }) {
  const [city, setCity] = useState("");
  const chosen = cities.find((c) => c.name === city);

  return (
    <>
      <label>
        <span>City</span>
        <select name="city" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">— choose —</option>
          {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </label>

      <label>
        <span>Province</span>
        <input
          name="state"
          key={`p-${city}`}
          defaultValue={chosen?.province ?? ""}
          placeholder={city ? "Not set for this city" : "Pick a city first"}
        />
      </label>

      <label>
        <span>Region</span>
        <input
          name="region"
          key={`r-${city}`}
          defaultValue={chosen?.region ?? ""}
          placeholder={city ? "Not set for this city" : "Pick a city first"}
        />
      </label>
    </>
  );
}
