"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  // Starts as dark to match the server-rendered attribute; the effect below
  // syncs it to whatever the pre-paint script already applied.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const applied = document.documentElement.dataset.theme;
    if (applied === "light" || applied === "dark") setTheme(applied);
  }, []);

  function choose(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("argonaut-theme", next);
    } catch {
      // Private browsing with storage blocked — the theme still applies for this page.
    }
    setTheme(next);
  }

  return (
    <div className="themetoggle navtext" role="group" aria-label="Colour theme">
      <button
        type="button"
        className={theme === "dark" ? "on" : undefined}
        aria-pressed={theme === "dark"}
        onClick={() => choose("dark")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M20 14.2A8.2 8.2 0 019.8 4 8.4 8.4 0 1020 14.2z" />
        </svg>
        Night
      </button>
      <button
        type="button"
        className={theme === "light" ? "on" : undefined}
        aria-pressed={theme === "light"}
        onClick={() => choose("light")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.6v2.2M12 19.2v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
        </svg>
        Day
      </button>
    </div>
  );
}
