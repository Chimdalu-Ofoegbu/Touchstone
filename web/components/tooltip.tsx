import type { ReactNode } from "react";

/**
 * Hairline tooltip in the terminal language (mono, uppercase, sharp). Pure CSS —
 * reveals on hover AND keyboard focus (focus-within), so it is accessible. The
 * trigger must be focusable (give it tabIndex / be a button) for the focus path.
 */
export function Tooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: ReactNode;
  side?: "bottom" | "top";
}) {
  const pos =
    side === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap",
          pos,
          "border rule-strong bg-surface-2 px-2 py-1 font-mono text-2xs uppercase tracking-label text-ink",
          "opacity-0 translate-y-0.5 transition-all duration-150",
          "group-hover:opacity-100 group-hover:translate-y-0",
          "group-focus-within:opacity-100 group-focus-within:translate-y-0",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}
