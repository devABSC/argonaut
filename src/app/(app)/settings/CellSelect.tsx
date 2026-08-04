"use client";

/**
 * One table cell, one field, saved the moment it changes.
 *
 * Each cell carries its own form so the table keeps real columns — the old
 * layout merged four columns into a single cell to fit one wide form, which is
 * why the headings stopped lining up with the values beneath them.
 */
export default function CellSelect({
  name,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  /** Shown as the empty choice. Omit to require a value. */
  placeholder?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="cellsel"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
