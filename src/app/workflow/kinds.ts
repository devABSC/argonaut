/** Display types offered when adding or editing a field. */
export const KINDS = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Text Area" },
  { value: "SELECT", label: "List" },
  { value: "LOOKUP", label: "Lookup" },
  { value: "FILE", label: "File Upload" },
  { value: "NUMBER", label: "Number" },
  { value: "CURRENCY", label: "Amount" },
  { value: "DATE", label: "Date" },
  { value: "CHECKBOX", label: "Checkbox" },
];

export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));
