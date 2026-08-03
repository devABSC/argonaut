"use client";

import { useState } from "react";

export type CityOption = { name: string; province: string | null; region: string | null; zipCode: string | null };

/**
 * City is chosen from the register; province and region follow from it rather
 * than being asked for again. Both stay editable for the cases the register
 * has not caught up with.
 */
export default function CityRegion({
  cities,
  city: initialCity = "",
  province: initialProvince = "",
  region: initialRegion = "",
  zipCode: initialZip = "",
}: {
  cities: CityOption[];
  city?: string;
  province?: string;
  region?: string;
  zipCode?: string;
}) {
  const [city, setCity] = useState(initialCity);
  const chosen = cities.find((c) => c.name === city);
  // Whatever is on the record wins until the city is changed, so a value the
  // register does not carry is not silently wiped.
  const touched = city !== initialCity;

  return (
    <>
      <label>
        <span>City</span>
        <select name="city" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">— choose —</option>
          {initialCity && !cities.some((c) => c.name === initialCity) && (
            <option value={initialCity}>{initialCity}</option>
          )}
          {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </label>

      <label>
        <span>Province</span>
        <input
          name="state"
          key={`p-${city}`}
          defaultValue={touched ? chosen?.province ?? "" : initialProvince}
          placeholder={city ? "Not set for this city" : "Pick a city first"}
        />
      </label>

      <label>
        <span>Region</span>
        <input
          name="region"
          key={`r-${city}`}
          defaultValue={touched ? chosen?.region ?? "" : initialRegion}
          placeholder={city ? "Not set for this city" : "Pick a city first"}
        />
      </label>

      <label>
        <span>Zip code</span>
        <input
          name="zipCode"
          key={`z-${city}`}
          defaultValue={touched ? chosen?.zipCode ?? "" : initialZip}
          placeholder={city ? "Not set for this city" : "Pick a city first"}
        />
      </label>
    </>
  );
}
