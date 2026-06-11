"use client";

import { useId, useState } from "react";
import type { Dimension } from "@/lib/reasoning";
import { DIMENSION_META } from "@/lib/reasoning";
import { EXPLORER } from "@/lib/touchstone";

function tier(score: number): "prime" | "watch" | "caution" | "distress" {
  if (score >= 67) return "prime";
  if (score >= 50) return "watch";
  if (score >= 34) return "caution";
  return "distress";
}

/**
 * One risk dimension: a scored bar + one-line band summary, expandable to the
 * cited rationale where every claim links to its on-chain data source (REQ).
 */
export function DimensionBar({ dim }: { dim: Dimension }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const meta = DIMENSION_META[dim.key];
  const color = `rgb(var(--ts-${tier(dim.score)}))`;

  return (
    <div className="border-b rule py-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="block w-full text-left"
      >
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm">{meta.label}</span>
            <span className="label">{dim.band_hit.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-base tnum" style={{ color }}>
              {dim.score}
              <span className="text-faint">/100</span>
            </span>
            <span className="label w-3 text-center" aria-hidden="true">
              {open ? "−" : "+"}
            </span>
          </div>
        </div>
        <div
          className="mt-2.5 h-[6px] w-full overflow-hidden bg-surface-2"
          role="meter"
          aria-valuenow={dim.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${meta.label} score`}
        >
          <div className="h-full transition-[width] duration-500" style={{ width: `${dim.score}%`, background: color }} />
        </div>
      </button>

      {open && (
        <div id={panelId} className="mt-4">
          <p className="mb-3 text-xs text-muted">{meta.blurb}</p>
          <p className="mb-4 max-w-2xl text-sm leading-relaxed">{dim.rationale}</p>
          {dim.citations.length > 0 && (
            <ul className="space-y-3">
              {dim.citations.map((c) => (
                <li key={c.id} className="border-l rule-strong pl-3">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="label">[{c.id}]</span>
                    <span className="text-xs">
                      {c.label}: <span className="font-mono text-ink">{c.value}</span>
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{c.evidence}</div>
                  <div className="mt-1">
                    {c.source.address === "static_config" ? (
                      <span className="label">source · static config</span>
                    ) : (
                      <a
                        href={`${EXPLORER}/address/${c.source.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="label inline-flex min-h-6 items-center hover:text-ink"
                      >
                        source · {c.source.function} ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {dim.missing_facts.length > 0 && (
            <p className="mt-3 text-2xs text-faint">
              Missing inputs: {dim.missing_facts.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
