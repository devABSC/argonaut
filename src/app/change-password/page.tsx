import { redirect } from "next/navigation";
import { getCurrentUser, needsPasswordChange, passwordExpired, PASSWORD_MAX_AGE_DAYS } from "@/lib/auth";
import ChangePasswordForm from "./ChangePasswordForm";

/**
 * Where anyone with a first-time or expired password is held. Deliberately
 * outside the app shell — there is nothing else to do until it is done.
 */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Reachable voluntarily, but if nothing is owed there is no reason to linger.
  const forced = needsPasswordChange(user);
  const expired = passwordExpired(user);

  return (
    <main className="login-page">
      <div className="console" style={{ minHeight: "100vh" }}>
        <div className="console__bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
        <div className="card">
          <p className="eyebrow"><span className="live" />Account security</p>
          <h1>{forced ? "Choose a new password" : "Change password"}</h1>

          <p style={{ marginTop: 12, color: "var(--muted)", fontSize: ".92rem", lineHeight: 1.5 }}>
            {expired
              ? `Passwords are changed every ${PASSWORD_MAX_AGE_DAYS} days. Pick a new one to carry on.`
              : forced
                ? "This is your first sign-in, so pick a password only you know."
                : "Set a new password for your account."}
          </p>

          <ChangePasswordForm forced={forced} name={user.name} />
        </div>
      </div>
    </main>
  );
}
