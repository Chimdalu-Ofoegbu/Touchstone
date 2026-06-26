/**
 * Touchstone mark — the brand "streak" icon (icon-streak-ink): a bold ink bar
 * with a lighter trailing bar, on the cream brand tile with rounded corners.
 * Geometry + colors are taken verbatim from the brand asset
 * (brand-assets/svg/icon-streak-ink.svg) so this is the exact logo, as vector
 * (crisp at any size). The same artwork is used for the favicon (app/icon.svg).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Touchstone"
    >
      <rect width="200" height="200" rx="46" fill="#EAE6DA" />
      <g transform="rotate(-45 100 100)">
        <line
          x1="46"
          y1="100"
          x2="154"
          y2="100"
          stroke="#1C1810"
          strokeWidth="25"
          strokeLinecap="round"
        />
        <line
          x1="70"
          y1="128"
          x2="148"
          y2="128"
          stroke="#1C1810"
          strokeOpacity="0.7"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
