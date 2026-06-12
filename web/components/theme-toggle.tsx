"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className="h-2.5 w-2.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  );
}

/**
 * Light/dark switch. A single sliding toggle (not two buttons): the violet knob
 * sits left in Terminal (dark) and right in Paper (light), carrying the icon of
 * the active mode. Persists to localStorage; the no-flash script in layout
 * applies the stored theme before first paint.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = (document.documentElement.getAttribute("data-theme") as Theme) ?? "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ts-theme", next);
    } catch {}
  }

  const isLight = mounted && theme === "light";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label="Light mode"
      title={isLight ? "Switch to Terminal (dark)" : "Switch to Paper (light)"}
      onClick={toggle}
      className="relative inline-block h-6 w-12 border rule bg-surface align-middle transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      {/* sliding knob — carries the active mode's icon */}
      <span
        className="absolute left-[3px] top-[3px] flex h-4 w-4 items-center justify-center bg-accent text-bg transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${isLight ? 24 : 0}px)` }}
      >
        {isLight ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
