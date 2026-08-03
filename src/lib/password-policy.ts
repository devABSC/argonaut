import type { RoleKey } from "./roles.ts";

/**
 * Password policy, kept free of Next imports so it can be unit-tested.
 *
 * Passwords last three months. The owner is exempt — locking out the only
 * account that can fix things is worse than the risk it avoids.
 */
export const PASSWORD_MAX_AGE_DAYS = 90;

export function passwordExpired(user: {
  role: RoleKey;
  passwordChangedAt: Date | null;
  createdAt: Date;
}): boolean {
  if (user.role === "SUPER_USER") return false;
  const since = user.passwordChangedAt ?? user.createdAt;
  return Date.now() - since.getTime() > PASSWORD_MAX_AGE_DAYS * 86_400_000;
}

/** Held at the change-password screen: first sign-in, or an expired password. */
export function needsPasswordChange(user: {
  role: RoleKey;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  createdAt: Date;
}): boolean {
  return user.mustChangePassword || passwordExpired(user);
}
