import { notFound } from "next/navigation";
import AppShell from "../AppShell";
import { NAV } from "@/lib/nav";

/**
 * A no-auth harness for checking the shell at every width. Not linked from
 * anywhere and carries no real data — it exists so responsive behaviour can be
 * seen without signing in.
 */
export default function UiTest() {
  // Local only. It renders the shell without signing in, which is exactly why
  // it must not exist in production.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <AppShell
      user={{ name: "Test User", roleLabel: "Super User" }}
      nav={NAV}
      activeSection="recruitment"
      activeTab="candidates"
    >
      <div className="viewbar">
        <span className="viewtoggle">← Back to candidates</span>
        <span className="spacer" />
        <span className="tree-meta">Vicente Santelices</span>
        <span className="pill s-PENDING">Applied</span>
      </div>

      <div className="subtabs" role="tablist">
        {["Personal Info","CV","Work Experience","Skills","Char Ref","PreJO Docs","Other AI Data","Assessment","Salary","Notes"].map((t, i) => (
          <span key={t} className={i === 4 ? "subtab on" : "subtab"}>{t}</span>
        ))}
      </div>

      <div className="panel">
        <div className="cat-head">
          <h2>Character References <span className="count">0</span></h2>
        </div>
        <form className="addrow crrow">
          <input placeholder="Name" />
          <input placeholder="Relationship" />
          <input placeholder="Company" />
          <input placeholder="Position" />
          <input placeholder="Contact no." />
          <input placeholder="Email" />
          <button className="save icon" type="button">+</button>
        </form>
        <p style={{ marginTop: 14 }}>No references on file.</p>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h2>A wide table</h2>
        <div className="tablewrap">
          <table className="utable stacked">
            <thead><tr><th className="numcol">No.</th><th>Name</th><th>Position</th><th>Email</th><th>Mobile</th><th>Stage</th><th>Applied</th></tr></thead>
            <tbody>
              <tr>
                <td className="numcol" data-label="No.">1</td>
                <td data-label="Name"><b>Santelices, Vicente</b></td>
                <td data-label="Position">Full-Stack Developer</td>
                <td className="muted" data-label="Email">vicente.santelices1789@gmail.com</td>
                <td className="muted nowrap" data-label="Mobile">0949 735 6111</td>
                <td data-label="Stage"><span className="pill s-PENDING">Applied</span></td>
                <td className="muted nowrap" data-label="Applied">03 Aug 2026</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
