"use client";

/**
 * The Active switch saves the moment it is flicked — it submits the row form
 * it sits in, so there is no separate Save click to forget. Everything else on
 * the row goes along with it, which is what you want anyway.
 */
export default function ActiveToggle({
  name = "isActive",
  defaultChecked,
  label,
}: {
  name?: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <label className="switch" title={`${defaultChecked ? "Deactivate" : "Activate"} — saves immediately`}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
      <span className="track" aria-hidden="true" />
      <span className="swlabel">{label}</span>
    </label>
  );
}
