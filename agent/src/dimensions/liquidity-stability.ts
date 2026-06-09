// agent/src/dimensions/liquidity-stability.ts
// D-06 + D-07 for the liquidity_stability dimension. Pure function over
// SubjectFacts. Band input is the larger of parent_tvl_USD vs mantle_tvl_USD
// when both are present (RESEARCH §7.4 Open Q2: USDY's $680M parent supply
// should dominate its $8M Mantle slice for the band lookup, since the
// liquidity risk is functionally borne by the parent redemption rail).
// When parent is missing, fall back to mantle_tvl_USD. When both are null,
// the dimension defaults to 50 per D-07.

import type { Band, BandResult } from "./types.js";
import type { SubjectFacts } from "../subjects/types.js";

/**
 * `max` is TVL in USD (exclusive upper bound for the band). Top band is
 * the `max: null` catch-all for "anchor-level" liquidity.
 */
export const LIQUIDITY_BANDS: Band[] = [
  { max: 1_000_000, score: 25, label: "very thin liquidity" },
  { max: 10_000_000, score: 50, label: "limited liquidity" },
  { max: 100_000_000, score: 70, label: "healthy liquidity" },
  { max: 500_000_000, score: 82, label: "deep liquidity" },
  { max: null, score: 92, label: "anchor-level liquidity" },
];

const REQUIRED_LABELS = [
  "mantle TVL (USD)",
  "parent TVL (USD)",
] as const;

/**
 * Band-input selection (RESEARCH §7.4 + Open Q2):
 *   1) Prefer parent_tvl when non-null (USDY $8M Mantle / $680M parent ≈ deep)
 *   2) Else fall back to mantle_tvl
 *   3) Else null → D-07 default to 50
 *
 * Returns the numeric TVL that drove the band lookup, plus the list of
 * missing labels so the engine's confidence drops accordingly.
 */
function liquidityTvl(facts: SubjectFacts): {
  tvl: number | null;
  missing: string[];
} {
  const missing: string[] = [];
  const get = (label: string): string | null => {
    const f = facts.liquidity.find((x) => x.label === label);
    if (!f || f.value === null) {
      missing.push(label);
      return null;
    }
    return f.value;
  };

  const mantle = get("mantle TVL (USD)");
  const parent = get("parent TVL (USD)");

  if (missing.length === REQUIRED_LABELS.length) {
    return { tvl: null, missing };
  }

  // Prefer parent when available; else fall back to mantle.
  const raw = parent ?? mantle;
  if (raw === null) return { tvl: null, missing };
  const tvl = Number(raw);
  if (!Number.isFinite(tvl)) return { tvl: null, missing };
  return { tvl, missing };
}

export function scoreLiquidityStability(facts: SubjectFacts): BandResult {
  const { tvl, missing } = liquidityTvl(facts);
  if (tvl === null) {
    return {
      max: null,
      score: 50,
      label: "missing data — default neutral",
      missing_facts: missing,
      raw_value: null,
    };
  }
  const band = LIQUIDITY_BANDS.find((b) => b.max === null || tvl < b.max)!;
  return {
    max: band.max,
    score: band.score,
    label: band.label,
    missing_facts: missing,
    raw_value: tvl,
  };
}
