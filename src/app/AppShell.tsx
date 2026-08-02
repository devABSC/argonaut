"use client";

import { useState } from "react";
import { signOut } from "./actions/auth";
import { createProject } from "./actions/projects";

type Project = { id: string; name: string; status: string; progress: number };

export default function AppShell({ user, projects }: { user: { name: string }; projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(false);
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";

  function toggle() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width:900px)").matches) setOpen((v) => !v);
    else setRail((v) => !v);
  }

  const cls = ["app", rail ? "nav-rail" : "", open ? "nav-open" : ""].filter(Boolean).join(" ");

  return (
    <div className={cls}>
      <div className="backdrop" onClick={() => setOpen(false)} />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand"><span className="mark" /><span className="brandtext">Argonaut</span></div>

        <nav className="nav">
          <a className="active"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="11" width="8" height="10" rx="1.5" /><rect x="3" y="14" width="8" height="7" rx="1.5" /></svg><span className="navtext">Overview</span></a>
          <a><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg><span className="navtext">Projects</span></a>
          <a><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="6" height="16" rx="1.5" /><rect x="11" y="4" width="4" height="16" rx="1.5" /><path d="M17 5l3.5 1-3 14L15 19" /></svg><span className="navtext">Library</span></a>
          <a><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 000-6l-.1-.1a1.6 1.6 0 01-.3-1.8 2 2 0 10-3.4 0 1.6 1.6 0 01-1.8.3H13a1.6 1.6 0 01-1-1.5V5a2 2 0 10-4 0 1.6 1.6 0 01-1 1.5 1.6 1.6 0 01-1.8-.3 2 2 0 10-3.4 0 1.6 1.6 0 01-.3 1.8L1.5 8A2 2 0 103 12a1.6 1.6 0 01.3 1.8L3 14a2 2 0 103.4 0 1.6 1.6 0 011.8-.3H9a1.6 1.6 0 011 1.5V19a2 2 0 104 0 1.6 1.6 0 011-1.5z" /></svg><span className="navtext">Settings</span></a>
        </nav>

        <form action={createProject}>
          <input type="hidden" name="name" value="Untitled project" />
          <button className="newbtn" type="submit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg><span className="navtext">New project</span></button>
        </form>

        <div className="side-foot">
          <span className="avatar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="4.6" rx="5.4" ry="1.5" stroke="#06070B" strokeWidth="1.3" />
              <path d="M12 7.2c-3.5 0-6.1 2.6-6.1 6 0 1.2.3 2.1.9 3 .2.3.5.5.9.5h1.2c.3 0 .6-.2.8-.5.6-.8 1.4-1.3 2.3-1.3s1.7.5 2.3 1.3c.2.3.5.5.8.5h1.2c.4 0 .7-.2.9-.5.6-.9.9-1.8.9-3 0-3.4-2.6-6-6.1-6z" fill="#06070B" />
              <path d="M9.2 12.3c1.7-.8 3.9-.8 5.6 0-.4.9-1.6 1.5-2.8 1.5s-2.4-.6-2.8-1.5z" fill="#38E8FF" />
            </svg>
          </span>
          <div className="u-meta"><b>{user.name}</b></div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button className="hamb" onClick={toggle} aria-label="Toggle navigation">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="crumb">Overview</span>
          <span className="spacer" />
          <form action={signOut}><button className="signout" type="submit">Sign out</button></form>
          <span className="top-avatar">{initial}</span>
        </header>

        <div className="content">
          <p className="eyebrow"><span className="dot" />Session authenticated</p>
          <h1>Welcome back, <span className="grad">{user.name.split(" ")[0]}.</span></h1>
          <p className="lead">You&rsquo;re in. Your workspace is synced and ready — jump back into an active project or spin up something new.</p>

          <form action={createProject} className="cta">
            <input name="name" placeholder="New project name…" required
              style={{ fontFamily: "var(--body)", fontSize: ".94rem", color: "var(--text)", background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", borderRadius: 11, padding: "12px 16px", minWidth: 220 }} />
            <button className="btn" type="submit">＋ Add project</button>
          </form>

          <div className="stats">
            <div className="stat"><div className="k">Projects</div><div className="v">{projects.length}</div></div>
            <div className="stat"><div className="k">In progress</div><div className="v">{projects.filter((p) => p.status === "In progress").length}</div></div>
            <div className="stat"><div className="k">Shared</div><div className="v">{projects.filter((p) => p.status === "Shared").length}</div></div>
          </div>

          <div className="sechead"><h2>Your projects</h2></div>
          {projects.length === 0 ? (
            <div className="empty">No projects yet — add your first one above. It&rsquo;s saved to your database.</div>
          ) : (
            <div className="cards">
              {projects.map((p) => (
                <article className="card" key={p.id}>
                  <p className="kick">{p.status}</p>
                  <h3>{p.name}</h3>
                  <p>{p.progress}% complete</p>
                  <div className="bar"><span style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }} /></div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
