/**
 * Strength rules, kept free of framework imports so they can be unit-tested
 * and reused by every place a password is set: sign-up, reset, and change.
 */
export const MIN_LENGTH = 12;

export const RULES_TEXT =
  `At least ${MIN_LENGTH} characters, with a letter, a number and a special character.`;

/** Returns a problem to show the user, or null when the password is acceptable. */
export function checkStrength(pw: string): string | null {
  if (pw.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(pw)) return "Password needs at least one letter.";
  if (!/\d/.test(pw)) return "Password needs at least one number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password needs at least one special character.";
  if (/\s$/.test(pw) || /^\s/.test(pw)) return "Password cannot start or end with a space.";
  return null;
}
