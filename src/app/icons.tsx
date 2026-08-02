/** Shared action glyphs. Every icon button carries a title + aria-label. */
const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconSave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M5 4.5h11L19.5 8v11.5a1 1 0 01-1 1h-13a1 1 0 01-1-1v-14a1 1 0 011-1z" />
    <path d="M8 4.5v5h7v-5M8 20.5v-6h8v6" />
  </svg>
);

export const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M4 6.5h16M9.5 6.5V4.8a1 1 0 011-1h3a1 1 0 011 1v1.7" />
    <path d="M6.5 6.5l.8 12.3a1 1 0 001 .95h7.4a1 1 0 001-.95l.8-12.3" />
    <path d="M10 10v6M14 10v6" />
  </svg>
);

export const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);

export const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
