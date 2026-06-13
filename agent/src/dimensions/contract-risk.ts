// agent/src/dimensions/contract-risk.ts
// D-06 (bands-as-data) + D-07 (missing-fact default to 50) for the
// contract_risk dimension. Pure function over SubjectFacts.
//
// Bands sorted ascending by `max` (exclusive upper bound on the derived
// risk-quality index). Top band uses `max: null` as the catch-all.
// (RESEARCH §7.2)

import type { Band, BandResult } from "./types.js";
import type { SubjectFacts } from "../subjects/types.js";

export const CONTRACT_RISK_BANDS: Band[] = [
  {
    max: 30,
    score: 30,
    label: "unverified or pausable-by-EOA with no timelock",
  },
  {
    max: 50,
    score: 55,
    label: "verified source, owner concentrated, partial mitigation",
  },
  {
    max: 70,
    score: 72,
    label: "verified, audited, proxy admin documented",
  },
  {
    max: 85,
    score: 85,
    label: "timelocked admin, distributed holders, multiple audits",
  },
  {
    max: null,
    score: 92,
    label:
      "battle-tested with multi-sig timelocked admin and no central pause",
  },
];

// Required labels for the contract bucket. The adapter emits all six (see
// agent/src/subjects/usdy.ts contract bucket). When all values are null,
// the dimension defaults to 50 per D-07.
const REQUIRED_LABELS = [
  "source verified",
  "audits",
  "proxy pattern",
  "timelock",
  "owner",
  "pausable",
] as const;

/**
 * Recipe (every point traceable to a fact label):
 *   +25 if source_verified == "yes"
 *   +15 if audits non-empty
 *   +10 if proxy pattern documented
 *   +15 if timelock present (non-empty value)
 *   -15 if pausable=="true" AND timelock missing/empty   (concentrated kill switch)
 *   -10 if owner missing (null value) — EOA/no-admin heuristic
 * Clamped to [0, 100].
 *
 * Inputs (audits / pausable / timelock) are emitted by each subject adapter
 * from static governance config (subjects/*.ts contract bucket). NOTE the
 * -15 penalty keys on pausable AND no-timelock — it is NOT a penalty for
 * being pausable (a pause switch is a standard RWA safety feature). It fires
 * only when a privileged role can pause WITHOUT a timelock delay, i.e.
 * undelayed unilateral admin control. That is a deliberate, defensible
 * methodology stance: an audited, source-verified token that is pausable with
 * no timelock nets +15 (audits) -15 (undelayed pause) and settles mid-band —
 * the rationale should say exactly that ("audited & verified, but admin can
 * pause without a timelock delay").
 *
 * Returns `{ index: null }` when ALL required facts are missing → D-07
 * (default to 50, raw_value null).
 *
 * Note on "EOA-shaped" owner: a true EOA detection requires an on-chain
 * `getCode` call which lives outside this deterministic seam. For v1 we
 * treat a missing owner value as the risk indicator; a static-config
 * timelock field is the positive signal.
 */
function riskQualityIndex(facts: SubjectFacts): {
  index: number | null;
  missing: string[];
} {
  const missing: string[] = [];
  const get = (label: string): string | null => {
    const f = facts.contract.find((x) => x.label === label);
    if (!f || f.value === null) {
      missing.push(label);
      return null;
    }
    return f.value;
  };

  const sourceVerified = get("source verified");
  const audits = get("audits");
  const proxyPattern = get("proxy pattern");
  const timelock = get("timelock");
  const owner = get("owner");
  const pausable = get("pausable");

  if (missing.length === REQUIRED_LABELS.length) {
    return { index: null, missing };
  }

  let idx = 0;
  if (sourceVerified && /^yes$|^true$/i.test(sourceVerified)) idx += 25;
  if (audits) idx += 15;
  if (proxyPattern) idx += 10;
  if (timelock) idx += 15;
  if (pausable && /^true$/i.test(pausable) && !timelock) idx -= 15;
  if (owner === null) idx -= 10;

  idx = Math.max(0, Math.min(100, idx));
  return { index: idx, missing };
}

export function scoreContractRisk(facts: SubjectFacts): BandResult {
  const { index, missing } = riskQualityIndex(facts);
  if (index === null) {
    return {
      max: null,
      score: 50,
      label: "missing data — default neutral",
      missing_facts: missing,
      raw_value: null,
    };
  }
  const band = CONTRACT_RISK_BANDS.find(
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
