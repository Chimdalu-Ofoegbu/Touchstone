import { letterOf, familyOf, FAMILY_LABEL } from "@/lib/grades";

type Size = "row" | "hero";

const FAMILY_TEXT: Record<string, string> = {
  prime: "text-prime",
  watch: "text-watch",
  caution: "text-caution",
  distress: "text-distress",
};

/**
 * The grade — the largest object in any rating view (REQ). Letter set in
 * Instrument Serif, colored by family; a mono micro-label names the family in
 * plain language for the no-DeFi reader.
 */
export function GradeChip({
  uint8,
  size = "row",
  showLabel = true,
}: {
  uint8: number;
  size?: Size;
  showLabel?: boolean;
}) {
  const fam = familyOf(uint8);
  const letter = letterOf(uint8);
  // Row size shrinks on mobile so a 3-letter grade (e.g. "BBB") can't overflow
  // its column; full 5.5rem `text-grade` returns at md+. Hero is unchanged.
  const sizeClass =
    size === "hero"
      ? "text-[8rem] leading-[0.8]"
      : "text-[3.25rem] leading-none tracking-[-0.02em] md:text-grade";
  return (
    // Stack the family label under the letter until xl — beside an 88px glyph the
    // label only fits without overflowing its table column above ~1200px. Inline
    // (the original broadsheet look) returns at xl+.
    <div className="flex flex-col items-start gap-1 xl:flex-row xl:items-center xl:gap-3">
      <span
        className={`font-serif ${sizeClass} ${FAMILY_TEXT[fam]} tabular-nums`}
        aria-label={`Grade ${letter}`}
      >
        {letter}
      </span>
      {showLabel && (
        <span className="label" style={{ color: `rgb(var(--ts-${fam}))` }}>
          {FAMILY_LABEL[fam]}
        </span>
      )}
    </div>
  );
}

/** Slim inline grade pill (for compact contexts like the track-record timeline). */
export function GradePill({ uint8 }: { uint8: number }) {
  const fam = familyOf(uint8);
  return (
    <span
      className="inline-flex items-center border px-2 py-0.5 font-mono text-xs"
      style={{ color: `rgb(var(--ts-${fam}))`, borderColor: `rgb(var(--ts-${fam}) / 0.5)` }}
    >
      {letterOf(uint8)}
    </span>
  );
}
