// agent/src/dimensions/collateral-quality.ts
// D-06 (bands-as-data) + D-07 (missing-fact default to 50) for the
// collateral_quality dimension. Pure function over SubjectFacts; no RPC,
// no LLM, no external lookups — judge-inspectable boundary
// (CON-deterministic-vs-llm-separation).
//
// Bands are sorted ascending by `max` (exclusive upper bound on the
// derived quality index). Lookup rule:
//     for (const b of BANDS) if (b.max === null || idx < b.max) return b;
// Top band uses `max: null` as the catch-all. (RESEARCH §7.1)

import type { Band, BandResult } from "./types.js";
import type { SubjectFacts } from "../subjects/types.js";

/**
 * Threshold bands over a quality_index ∈ [0, 100] derived from the
 * collateral facts (see qualityIndex() below). Source rationale: RESEARCH §7.1.
 */
export const COLLATERAL_BANDS: Band[] = [
  { max: 30, score: 35, label: "thin collateral disclosure" },
  {
    max: 50,
    score: 55,
    label: "moderate collateral, single custodian or sparse audit",
  },
  {
    max: 70,
    score: 72,
    label: "strong collateral, recent audit, multi-attestation",
  },
  {
    max: 85,
    score: 85,
    label: "institutional collateral with regular proof-of-reserves",
  },
  { max: null, score: 92, label: "tokenized treasury-grade collateral" },
];

// Required fact labels for the collateral_quality dimension. The adapter
// emits all four (see agent/src/subjects/usdy.ts collateral bucket). If
// the fact is present but value === null, it counts as missing.
const REQUIRED_LABELS = [
  "issuer + collateral",
  "audits",
  "reserve attestation",
  "custodian",
] as const;

/**
 * Recipe (every point traceable to a named fact label — CON-llm-prompt-evidence-citation):
 *   +25 if issuer mentions "treasury"/"treasuries" (treasury-grade collateral)
 *   +20 if audits non-empty                else -10 (no audit penalty)
 *   +20 if reserve attestation non-empty   else -15 (no PoR penalty)
 *   +15 if custodian non-empty
 * Clamped to [0, 100].
 *
 * Returns `{ index: null }` when ALL required facts are missing → the
 * scorer applies D-07 (default to 50, raw_value null, missing_facts populated).
 */
function qualityIndex(facts: SubjectFacts): {
  index: number | null;
  missing: string[];
} {
  const missing: string[] = [];
  const get = (label: string): string | null => {
    const f = facts.collateral.find((x) => x.label === label);
    if (!f || f.value === null) {
      missing.push(label);
      return null;
    }
    return f.value;
  };

  const issuer = get("issuer + collateral");
  const audits = get("audits");
  const reserve = get("reserve attestation");
  const custodian = get("custodian");

  // D-07: if ALL required facts are missing, the dimension defaults.
  if (missing.length === REQUIRED_LABELS.length) {
    return { index: null, missing };
  }

  let idx = 0;
  if (issuer && /treasur(y|ies)|treasury bills/i.test(issuer)) idx += 25;
  if (audits) idx += 20;
  else idx -= 10;
  if (reserve) idx += 20;
  else idx -= 15;
  if (custodian) idx += 15;

  // Clamp to [0, 100] — score lookup expects a bounded index.
  idx = Math.max(0, Math.min(100, idx));
  return { index: idx, missing };
}

/**
 * Pure function: SubjectFacts → BandResult. NEVER throws. The score is
 * always an integer in [0, 100]; missing-fact path defaults to 50.
 */
export function scoreCollateral(facts: SubjectFacts): BandResult {
  const { index, missing } = qualityIndex(facts);
  if (index === null) {
    // D-07: dimension defaults to 50 when all required facts are missing.
    return {
      max: null,
      score: 50,
      label: "missing data — default neutral",
      missing_facts: missing,
      raw_value: null,
    };
  }
  const band = COLLATERAL_BANDS.find(
    (b) => b.max === null || index < b.max,
  )!;
  return {
    max: band.max,
    score: band.score,
    label: band.label,
    missing_facts: missing,
    raw_value: index,
  };
}
