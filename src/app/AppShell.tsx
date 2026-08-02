"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { signOut } from "./actions/auth";
import ThemeToggle from "./ThemeToggle";
import type { NavSection } from "@/lib/nav";

const ICONS: Record<string, ReactNode> = {
  hris: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.4 19.2c.6-3 2.9-4.7 5.6-4.7s5 1.7 5.6 4.7" />
      <path d="M16.5 6.6a2.9 2.9 0 010 5.6M18.4 19.2c-.3-1.7-1-3-2.1-3.9" />
    </svg>
  ),
  "service-desk": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 12a8 8 0 0116 0" />
      <rect x="2.6" y="12" width="4" height="6" rx="1.6" />
      <rect x="17.4" y="12" width="4" height="6" rx="1.6" />
      <path d="M19.4 18v.7a2.6 2.6 0 01-2.6 2.6H13" />
    </svg>
  ),
  workflow: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3.4" width="6.6" height="5" rx="1.5" />
      <rect x="14.4" y="15.6" width="6.6" height="5" rx="1.5" />
      <rect x="3" y="15.6" width="6.6" height="5" rx="1.5" />
      <path d="M6.3 8.4v7.2M9.6 5.9h5.1a3 3 0 013 3v6.7" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.1 14.5a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2.4a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H8.5a1.7 1.7 0 001-1.5V2.4a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.5 1h.2a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  ),
  finance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="2.6" y="6" width="18.8" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.6v4.8M18 9.6v4.8" />
    </svg>
  ),
};

export default function AppShell({
  user,
  nav,
  activeSection,
  activeTab,
  children,
}: {
  user: { name: string; roleLabel: string };
  nav: NavSection[];
  activeSection: string;
  activeTab: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(false);
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";
  const section = nav.find((s) => s.key === activeSection);

  function toggle() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width:900px)").matches) setOpen((v) => !v);
    else setRail((v) => !v);
  }

  const cls = ["app", rail ? "nav-rail" : "", open ? "nav-open" : ""].filter(Boolean).join(" ");

  return (
    <div className={cls}>
      <div className="backdrop" onClick={() => setOpen(false)} />

      <aside className="sidebar">
        <div className="brand"><span className="mark" /><span className="brandtext">Argonaut</span></div>

        <nav className="nav">
          {nav.map((s) => (
            <div key={s.key}>
              <Link
                href={`/${s.key}/${s.tabs[0].slug}`}
                className={s.key === activeSection ? "active" : undefined}
                onClick={() => setOpen(false)}
              >
                {ICONS[s.key]}
                <span className="navtext">{s.label}</span>
              </Link>

              {/* Sublinks in the rail — only for sections that use a submenu. */}
              {s.key === activeSection && s.children === "submenu" && s.tabs.length > 1 && (
                <div className="subnav navtext">
                  {s.tabs.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/${s.key}/${t.slug}`}
                      className={t.slug === activeTab ? "subactive" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <ThemeToggle />

        <div className="side-foot">
          <span className="avatar">{initial}</span>
          <div className="u-meta">
            <b>{user.name}</b>
            <span className="u-role">{user.roleLabel}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="hamb" onClick={toggle} aria-label="Toggle navigation">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="crumb">{section?.label ?? "Argonaut"}</span>
          <span className="spacer" />
          <form action={signOut}><button className="signout" type="submit">Sign out</button></form>
          <span className="top-avatar">{initial}</span>
        </header>

        {section && section.children !== "submenu" && section.tabs.length > 1 && (
          <div className="tabs" role="tablist">
            {section.tabs.map((t) => (
              <Link
                key={t.slug}
                href={`/${section.key}/${t.slug}`}
                role="tab"
                aria-selected={t.slug === activeTab}
                className={t.slug === activeTab ? "tab active" : "tab"}
              >
                {t.label}
              </Link>
            ))}
          </div>
        )}

        <div className="content">{children}</div>
      </div>
    </div>
  );
}
