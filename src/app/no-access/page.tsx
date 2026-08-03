import { signOut } from "../actions/auth";

/** Shown when an account exists but has been granted no menus at all. */
export default function NoAccess() {
  return (
    <main className="login-page">
      <div className="console" style={{ minHeight: "100vh" }}>
        <div className="card">
          <p className="eyebrow"><span className="live" />No access</p>
          <h1>Nothing assigned yet</h1>
          <p style={{ marginTop: 14, color: "var(--muted)", fontSize: ".94rem" }}>
            Your account is active, but no menus have been granted to it. Ask an
            administrator to assign your access under Settings → RBAC.
          </p>
          <form action={signOut}>
            <button className="btn" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </main>
  );
}
