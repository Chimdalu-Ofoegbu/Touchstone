"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Light/dark toggle. Both themes share one design language (serif/mono/violet,
 * sharp corners) — this is a deliberate mode switch, not a generic palette flip.
 * Persists to localStorage; the no-flash script in layout applies it before paint.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = (document.documentElement.getAttribute("data-theme") as Theme) ?? "dark";
    setTheme(current);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ts-theme", next);
    } catch {}
  }

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex items-center border rule"
    >
      {(["dark", "light"] as Theme[]).map((t) => {
        const active = mounted && theme === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            onClick={() => apply(t)}
            className={[
              "px-2.5 py-1 font-mono text-2xs uppercase tracking-label transition-colors",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
              active
                ? "bg-accent text-bg"
                : "text-muted hover:text-ink",
            ].join(" ")}
          >
            {t === "dark" ? "Terminal" : "Paper"}
          </button>
        );
      })}
    </div>
  );
}
