/**
 * What a model run cost, in dollars and pesos.
 *
 * Input and output are priced differently — output is five times input — so a
 * single token count cannot be converted. The two must be kept apart, which is
 * why AssessmentRun stores them separately.
 *
 * Owner-only wherever it is shown: what the business spends running itself is
 * not a recruiter's concern.
 */

/** USD per million tokens, Claude Opus 5. */
const RATE = { input: 5, output: 25 } as const;

/**
 * Held here rather than fetched. A live rate would make yesterday's figure
 * change overnight, and this is for a sense of scale, not accounting.
 */
export const USD_PHP = 58.5;

export function costUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * RATE.input + outputTokens * RATE.output) / 1_000_000;
}

/** Sub-cent amounts still need to read as money, hence four decimals. */
export function fmtUsd(n: number): string {
  return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

export function fmtPhp(usd: number): string {
  const php = usd * USD_PHP;
  return php >= 1 ? `₱${php.toFixed(2)}` : `₱${php.toFixed(3)}`;
}

/** "$0.18 · ₱10.53" — both, because one of them is the one that lands. */
export function fmtCost(inputTokens: number, outputTokens: number): string {
  const usd = costUsd(inputTokens, outputTokens);
  return `${fmtUsd(usd)} · ${fmtPhp(usd)}`;
}
