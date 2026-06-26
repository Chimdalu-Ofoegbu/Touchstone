/**
 * Touchstone mark — two forward-leaning rounded bars (a bold stroke + a thinner
 * trailing one), evoking an assayer's streak on the stone. Drawn with
 * `currentColor` so it inherits the wordmark's ink and stays legible on both the
 * dark terminal theme and the light theme (a fixed black mark would vanish on
 * dark). The trailing bar is the same color at reduced opacity for the two-tone
 * look. The standalone favicon (app/icon.svg) carries the brand colors instead.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label="Touchstone"
    >
      <line
        x1="16.5"
        y1="6"
        x2="8.5"
        y2="17"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <line
        x1="17.5"
        y1="11"
        x2="12"
        y2="18.5"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
