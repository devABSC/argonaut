/** A calendar quarter — what the BIR files 2307s against. */
export function quarterRange(year: number, q: number) {
  const from = new Date(Date.UTC(year, (q - 1) * 3, 1));
  // Day zero of the next quarter is the last day of this one.
  const to = new Date(Date.UTC(year, q * 3, 0));
  return { from, to };
}

export const QUARTERS = [1, 2, 3, 4] as const;

export const quarterLabel = (q: number) =>
  ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"][q - 1] ?? "";
