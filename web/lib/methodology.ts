// web/lib/methodology.ts
// Human-facing mirror of the agent's deterministic scoring model, for the
// /methodology page. The numbers here are NOT a second source of truth — they
// reflect the locked agent constants:
//   - dimension bands  -> agent/src/dimensions/{collateral,contract,oracle,liquidity}.ts
//   - composite combine -> agent/src/dimensions/synthesize.ts (uniform 25%)
//   - confidence floor  -> synthesize.ts (100 - 5 * missingFacts, clamped 30..100)
// If a band recipe changes in the engine, update it here too.

export type ScoreBand = { score: number; label: string };

export type DimensionInfo = {
  key: string;
  label: string;
  question: string; // the plain-language question the dimension answers
  summary: string; // what the engine actually reads on-chain
  bands: ScoreBand[]; // worst -> best, exactly mirroring the agent BANDS
};

/** The four deterministic dimensions, each weighted 25%. */
export const DIMENSIONS: DimensionInfo[] = [
  {
    key: "collateral_quality",
    label: "Collateral quality",
    question: "What actually backs the token — and how well is it proven?",
    summary:
      "Disclosure depth, custodian count, audit recency and proof-of-reserves cadence behind the asset.",
    bands: [
      { score: 35, label: "thin collateral disclosure" },
      { score: 55, label: "moderate collateral, single custodian or sparse audit" },
      { score: 72, label: "strong collateral, recent audit, multi-attestation" },
      { score: 85, label: "institutional collateral with regular proof-of-reserves" },
      { score: 92, label: "tokenized treasury-grade collateral" },
    ],
  },
  {
    key: "contract_risk",
    label: "Contract risk",
    question: "Who can change or halt the token, and how hardened is the code?",
    summary:
      "Source verification, admin/owner concentration, timelocks, pausability, audit history and holder distribution.",
    bands: [
      { score: 30, label: "unverified or pausable-by-EOA with no timelock" },
      { score: 55, label: "verified source, owner concentrated, partial mitigation" },
      { score: 72, label: "verified, audited, proxy admin documented" },
      { score: 85, label: "timelocked admin, distributed holders, multiple audits" },
      { score: 92, label: "battle-tested, multi-sig timelocked admin, no central pause" },
    ],
  },
  {
    key: "oracle_integrity",
    label: "Oracle integrity",
    question: "How is the token's value sourced, and can it be manipulated?",
    summary:
      "Feed redundancy, staleness guards, aggregation, deviation thresholds and on-chain settlement design.",
    bands: [
      { score: 30, label: "single trusted feed or no on-chain settlement" },
      { score: 55, label: "single oracle with documented staleness guard" },
      { score: 72, label: "redundant feeds with aggregation" },
      { score: 85, label: "multi-source aggregator, fresh data, manipulation resistance" },
      { score: 92, label: "battle-tested oracle stack with hardened deviation thresholds" },
    ],
  },
  {
    key: "liquidity_stability",
    label: "Liquidity stability",
    question: "How deep and resilient is the redemption and market liquidity?",
    summary:
      "TVL on Mantle and across the parent redemption rail — the larger of the two drives the band.",
    bands: [
      { score: 25, label: "very thin liquidity (< $1M)" },
      { score: 50, label: "limited liquidity (< $10M)" },
      { score: 70, label: "healthy liquidity (< $100M)" },
      { score: 82, label: "deep liquidity (< $500M)" },
      { score: 92, label: "anchor-level liquidity (≥ $500M)" },
    ],
  },
];

/** The best a single dimension can score (its top band) — caps the composite. */
export const MAX_DIMENSION_SCORE = 92;

/** Confidence model (mirrors synthesize.ts). */
export const CONFIDENCE = {
  base: 100,
  penaltyPerMissingFact: 5,
  floor: 30,
  ceiling: 100,
} as const;
