"use client";

import { Fragment, Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { signOut } from "./actions/auth";
import ThemeToggle from "./ThemeToggle";
import Flash from "./Flash";
import type { NavSection } from "@/lib/nav";

const ICONS: Record<string, ReactNode> = {
  "my-space": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3.6 10.6L12 4l8.4 6.6" />
      <path d="M5.6 12.2v7.2h12.8v-7.2" />
      <path d="M9.9 19.4v-4.6h4.2v4.6" />
    </svg>
  ),
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
  crm: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3.2 19.5c.5-3.1 2.7-5 5.3-5s4.8 1.9 5.3 5" />
      <circle cx="8.5" cy="8.6" r="3.1" />
      <path d="M16.2 12.2l1.9 1.9 3.6-3.9" />
    </svg>
  ),
  marketing: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 10.5l17-6.2-3 16-4.6-4.2z" />
      <path d="M12.4 16.1L8.6 19v-5.3L20 4.3" />
    </svg>
  ),
  "reports-analytics": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3.5 20.5h17" />
      <rect x="5" y="11" width="3.4" height="7" rx="1" />
      <rect x="10.3" y="6.5" width="3.4" height="11.5" rx="1" />
      <rect x="15.6" y="9" width="3.4" height="9" rx="1" />
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
  recruitment: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="10" cy="8" r="3.2" />
      <path d="M3.8 19.4c.6-3 2.9-4.8 6.2-4.8 1.1 0 2.1.2 3 .6" />
      <path d="M18 14.4v5.4M15.3 17.1h5.4" />
    </svg>
  ),
  edoc: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14 3v5h5M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M8.6 13h6.8M8.6 16.4h4.4" />
    </svg>
  ),
  project: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="5.4" width="18" height="14.2" rx="2" />
      <path d="M3 9.6h18M8 3.4v3.6M16 3.4v3.6" />
      <path d="M7.4 13.4h4M7.4 16.4h7" />
    </svg>
  ),
  car: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3.2l8.4 3.5v5c0 4.6-3.4 8-8.4 9.1-5-1.1-8.4-4.5-8.4-9.1v-5z" />
      <path d="M12 8.4v4.2M12 15.6v.1" />
    </svg>
  ),
};

export type TopTab = { href: string; label: string; on: boolean; title?: string };

/**
 * Below this the nav is a drawer, above it a fixed column. Must match the
 * breakpoint in globals.css — if the two drift, the button toggles the rail on
 * a width where the CSS is showing a drawer, and nothing appears to happen.
 */
const DRAWER = "(max-width:1024px)";

export default function AppShell({
  user,
  nav,
  activeSection,
  activeTab,
  topTabs,
  wide,
  children,
}: {
  user: { name: string; roleLabel: string };
  nav: NavSection[];
  activeSection: string;
  activeTab: string;
  /** Tab strip above the content. Supplied by the page, since a single section
   *  can show different strips on different sublinks. */
  topTabs?: TopTab[];
  /** Lets a table-heavy page use the full window instead of the reading width. */
  wide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(false);
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";
  const section = nav.find((s) => s.key === activeSection);

  // Sections whose children are sublinks name the page after the open sublink
  // (Service Forms, Routes…); tab sections keep the section name.
  const crumb =
    (section?.children === "submenu"
      ? section.tabs.find((t) => t.slug === activeTab)?.label
      : section?.label) ?? section?.label ?? "Argonaut";

  // Sections that declare plain tabs (HRIS, Service Desk) get a strip derived
  // from their own children; anything else supplies one explicitly.
  const strip: TopTab[] =
    topTabs ??
    (section && section.children !== "submenu" && section.tabs.length > 1
      ? section.tabs.map((t) => ({
          href: `/${section.key}/${t.slug}`,
          label: t.label,
          on: t.slug === activeTab,
        }))
      : []);

  function toggle() {
    if (typeof window !== "undefined" && window.matchMedia(DRAWER).matches) setOpen((v) => !v);
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
                  {s.tabs.filter((t) => !t.hideInSubmenu && !t.parent).map((t) => (
                    <Fragment key={t.slug}>
                      <Link
                        href={`/${s.key}/${t.slug}`}
                        className={t.slug === activeTab ? "subactive" : undefined}
                        title={t.title}
                        onClick={() => setOpen(false)}
                      >
                        {t.label}
                      </Link>
                      {/* Pages that belong to this one, nested a level in. */}
                      {s.tabs
                        .filter((c) => c.parent === t.slug && !c.hideInSubmenu)
                        .map((c) => (
                          <Link
                            key={c.slug}
                            href={`/${s.key}/${c.slug}`}
                            className={c.slug === activeTab ? "subchild subactive" : "subchild"}
                            title={c.title}
                            onClick={() => setOpen(false)}
                          >
                            {c.label}
                          </Link>
                        ))}
                    </Fragment>
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
          <span className="crumb">{crumb}</span>
          <span className="spacer" />
          <form action={signOut}><button className="signout" type="submit">Sign out</button></form>
          <span className="top-avatar">{initial}</span>
        </header>

        {strip.length > 0 && (
          <div className="tabs" role="tablist">
            {strip.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                role="tab"
                aria-selected={t.on}
                className={t.on ? "tab active" : "tab"}
                title={t.title}
              >
                {t.label}
              </Link>
            ))}
          </div>
        )}

        <div className={wide ? "content wide" : "content"}>
          {/* Confirmation of the last write, wherever it happened. */}
          <Suspense fallback={null}><Flash /></Suspense>
          {children}
        </div>
      </div>
    </div>
  );
}
