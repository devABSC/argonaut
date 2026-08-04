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

export const IconUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const IconDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

export const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M4 20h4.2L19 9.2a2 2 0 000-2.8l-1.4-1.4a2 2 0 00-2.8 0L4 15.8z" />
    <path d="M14.5 6.5l3 3" />
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

export const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </svg>
);

/* File-type marks: the conventional shapes, drawn in the same stroke style and
   currentColor as every other glyph. They differ by silhouette, not by colour —
   a coloured icon in a grey row reads as an alert rather than an action. */
export const IconExcel = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M13.5 2.5H6.5a2 2 0 00-2 2v15a2 2 0 002 2h11a2 2 0 002-2V8.5z" />
    <path d="M13.5 2.5v6h6" />
    <path d="M8.8 12.6l4.4 5.4M13.2 12.6l-4.4 5.4" />
  </svg>
);

export const IconPdf = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M13.5 2.5H6.5a2 2 0 00-2 2v15a2 2 0 002 2h11a2 2 0 002-2V8.5z" />
    <path d="M13.5 2.5v6h6" />
    <path d="M8.2 18v-4.4h1.5a1.2 1.2 0 010 2.4H8.2" />
    <path d="M12.6 18v-4.4h1.1a2.2 2.2 0 010 4.4z" />
  </svg>
);

export const IconLink = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M10.5 13.5a4 4 0 006 .4l2.4-2.4a4 4 0 10-5.7-5.7l-1.4 1.4" />
    <path d="M13.5 10.5a4 4 0 00-6-.4l-2.4 2.4a4 4 0 105.7 5.7l1.4-1.4" />
  </svg>
);

export const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 012-2h10" />
  </svg>
);

export const IconUpload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M12 20.5v-11M7.5 13.5L12 9l4.5 4.5" />
    <path d="M4.5 4.5h15" />
  </svg>
);

export const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.6 6.2l8.4 6.4 8.4-6.4" />
  </svg>
);