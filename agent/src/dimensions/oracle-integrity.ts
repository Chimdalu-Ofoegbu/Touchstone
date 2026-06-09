// agent/src/dimensions/oracle-integrity.ts
// D-06 + D-07 for the oracle_integrity dimension. Pure function over
// SubjectFacts. Recipe documented per-fact-label so the Wave 3 Claude
// prompt can cite the same evidence (CON-llm-prompt-evidence-citation).
//
// Note on subject diversity: the 3 subjects use very different oracle
// architectures (USDY internal-accrual, cmETH off-chain prover, FBTC
// reserve attestation / Chainlink PoR-where-available). The recipe
// matches keywords in the architecture string so each subject's design
// can score on its own merits, including attestation-backed flows.

import type { Band, BandResult } from "./types.js";
import type { SubjectFacts } from "../subjects/types.js";

export const ORACLE_BANDS: Band[] = [
  {
    max: 30,
    score: 30,
    label: "single trusted feed or no on-chain settlement",
  },
  {
    max: 50,
    score: 55,
    label: "single oracle with documented staleness guard",
  },
  { max: 70, score: 72, label: "redundant feeds with aggregation" },
  {
    max: 85,
    score: 85,
    label:
      "multi-source aggregator with fresh data and manipulation resistance",
  },
  {
    max: null,
    score: 92,
    label:
      "battle-tested oracle stack with hardened deviation thresholds",
  },
];

const REQUIRED_LABELS = ["oracle architecture", "staleness tolerance"] as const;

/**
 * Recipe (RESEARCH §7.3):
 *   +20 if oracle architecture string non-empty
 *   +20 if staleness tolerance documented as either "<= 24h" pattern OR "monthly" (attestation-backed)
 *   +15 if architecture mentions "redundan" (redundant/redundancy) or "multi-source" / "multiple"
 *   +15 if architecture mentions "manipulation-resistant" or "aggregator" or "deviation threshold"
 *   -25 if architecture mentions "single trusted feed" / "single point of failure" / "no redundancy"
 */
function oracleIndex(facts: SubjectFacts): {
  index: number | null;
  missing: string[];
} {
  const missing: string[] = [];
  const get = (label: string): string | null => {
    const f = facts.oracle.find((x) => x.label === label);
    if (!f || f.value === null) {
      missing.push(label);
      return null;
    }
    return f.value;
  };

  const architecture = get("oracle architecture");
  const staleness = get("staleness tolerance");

  if (missing.length === REQUIRED_LABELS.length) {
    return { index: null, missing };
  }

  let idx = 0;
  if (architecture) idx += 20;
  if (staleness && /\b(24h|12h|6h|1h|monthly|hourly|daily)\b/i.test(staleness))
    idx += 20;
  if (architecture && /redundan|multi-source|multiple/i.test(architecture))
    idx += 15;
  if (
    architecture &&
    /manipulation-resistant|aggregator|deviation threshold|deviation thresholds/i.test(
      architecture,
    )
  )
    idx += 15;
  if (
    architecture &&
    /single trusted feed|single point of failure|no redundancy|no on-chain redundancy/i.test(
      architecture,
    )
  )
    idx -= 25;

  idx = Math.max(0, Math.min(100, idx));
  return { index: idx, missing };
}

export function scoreOracleIntegrity(facts: SubjectFacts): BandResult {
  const { index, missing } = oracleIndex(facts);
  if (index === null) {
    return {
      max: null,
      score: 50,
      label: "missing data — default neutral",
      missing_facts: missing,
      raw_value: null,
    };
  }
  const band = ORACLE_BANDS.find((b) => b.max === null || index < b.max)!;
  return {
    max: band.max,
    score: band.score,
    label: band.label,
    missing_facts: missing,
    raw_value: index,
  };
}
