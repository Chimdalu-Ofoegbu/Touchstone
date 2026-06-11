import type { Config } from "tailwindcss";

/**
 * Touchstone design tokens — "rating-agency broadsheet x precision terminal".
 * Theme-driven via CSS variables (see app/globals.css): light + dark share one
 * language (Instrument Serif display / Geist UI / Geist Mono data, electric-violet
 * accent, sharp 0-radius corners, hairline rules).
 *
 * Colors are authored as `R G B` triplets in CSS vars so Tailwind can apply
 * arbitrary opacity: `rgb(var(--ts-ink) / <alpha-value>)`.
 */
const withVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  // Grade-family colors are applied via `text-${family}` etc. (dynamic) — JIT
  // can't see them in source, so safelist them.
  safelist: [
    "text-prime", "text-watch", "text-caution", "text-distress",
    "border-prime", "border-watch", "border-caution", "border-distress",
    "bg-prime", "bg-watch", "bg-caution", "bg-distress",
  ],
  theme: {
    extend: {
      colors: {
        bg: withVar("--ts-bg"),
        surface: withVar("--ts-surface"),
        "surface-2": withVar("--ts-surface-2"),
        ink: withVar("--ts-ink"),
        muted: withVar("--ts-muted"),
        faint: withVar("--ts-faint"),
        line: withVar("--ts-line"),
        accent: {
          DEFAULT: withVar("--ts-accent"),
          hi: withVar("--ts-accent-hi"),
          lo: withVar("--ts-accent-lo"),
        },
        // Grade family colors (legible on both themes; tuned per-theme via vars).
        prime: withVar("--ts-prime"),
        watch: withVar("--ts-watch"),
        caution: withVar("--ts-caution"),
        distress: withVar("--ts-distress"),
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Instrument Serif", "Georgia", "serif"],
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        // Dense terminal scale mirrored from the reference.
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }], // 11
        xs: ["0.75rem", { lineHeight: "1.1rem" }], // 12 base data
        sm: ["0.9375rem", { lineHeight: "1.4rem" }], // 15
        base: ["1rem", { lineHeight: "1.6rem" }],
        lg: ["1.125rem", { lineHeight: "1.6rem" }], // 18
        xl: ["1.25rem", { lineHeight: "1.5rem" }], // 20
        "2xl": ["1.5rem", { lineHeight: "1.7rem" }], // 24
        "4xl": ["2.5rem", { lineHeight: "1.05" }],
        display: ["4.5rem", { lineHeight: "0.98", letterSpacing: "-0.01em" }], // 72 hero
        grade: ["5.5rem", { lineHeight: "0.85", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        // Sharp by signature. `sm` kept minimal for the rare soft edge.
        none: "0",
        sm: "1px",
        DEFAULT: "0",
      },
      letterSpacing: {
        label: "0.12em",
      },
      maxWidth: {
        terminal: "84rem",
      },
    },
  },
  plugins: [],
};

export default config;
