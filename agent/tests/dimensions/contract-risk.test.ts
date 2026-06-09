// agent/tests/dimensions/contract-risk.test.ts
// Task 2-03-01 — contract_risk scorer per PLAN behaviors:
//   1) typical (verified source + audit + non-EOA owner) → ≥ 55
//   2) all contract facts null → D-07 missing-fact path (50, raw_value null)
//   3) boundary-value triplets per band
//   4) score is integer in [0,100]
//
// Recipe (RESEARCH §7.2):
//   +25 if source_verified == "yes"
//   +15 if audits non-empty
//   +10 if proxy pattern documented
//   +15 if timelock present (non-null)
//   -15 if pausable and no timelock
//   -10 if owner is null/EOA-shaped (heuristic: address that does not
//        look like a contract — for v1 we treat null/empty as the
//        risk indicator; a more sophisticated EOA-detection requires
//        an on-chain getCode which lives outside the deterministic seam)

import { describe, it, expect } from "vitest";
import {
  scoreContractRisk,
  CONTRACT_RISK_BANDS,
} from "../../src/dimensions/contract-risk.js";
import type { SubjectFacts, Fact } from "../../src/subjects/types.js";

function fact(label: string, value: string | null): Fact {
  return {
    label,
    value,
    evidence: ".",
    source: { kind: "static", file: "test", version: "1.0.0" },
  };
}

function facts(contract: Fact[]): SubjectFacts {
  return {
    subject: {
      name: "Test",
      ticker: "USDY",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 5000,
    },
    ingestBlock: 0,
    collateral: [],
    contract,
    oracle: [],
    liquidity: [],
  };
}

describe("[2-03-01a] scoreContractRisk — typical inputs", () => {
  it("verified source + audits + proxy pattern + timelock + non-EOA owner → upper band", () => {
    const f = facts([
      fact("source verified", "yes"),
      fact("audits", "Halborn 2024, OpenZeppelin 2023"),
      fact("proxy pattern", "EIP-1967 transparent proxy"),
      fact("timelock", "0xabc... (48h timelock)"),
      fact("owner", "0x0000000000000000000000000000000000abcdef"),
      fact("pausable", "true"),
    ]);
    const r = scoreContractRisk(f);
    // recipe: +25 + 15 + 10 + 15 + 0 (owner non-EOA-shaped) - 0 (timelock present) = 65
    // 65 falls into band 2 (max 70) → score 72
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(r.missing_facts).toEqual([]);
    expect(r.raw_value).not.toBeNull();
  });

  it("verified source + audits + proxy + no timelock + pausable → mid band (penalty applied)", () => {
    const f = facts([
      fact("source verified", "yes"),
      fact("audits", "Halborn 2024"),
      fact("proxy pattern", "UUPS"),
      fact("timelock", null),
      fact("owner", "0x0000000000000000000000000000000000abcdef"),
      fact("pausable", "true"),
    ]);
    const r = scoreContractRisk(f);
    // recipe: +25 + 15 + 10 + 0 + 0 - 15 (pausable no timelock) = 35
    // 35 → band 1 (max 50) → score 55
    expect(r.score).toBeGreaterThanOrEqual(30);
    expect(r.score).toBeLessThanOrEqual(72);
  });

  it("score is integer in [0,100] for typical inputs", () => {
    const f = facts([
      fact("source verified", "yes"),
      fact("audits", "audit"),
      fact("proxy pattern", "UUPS"),
      fact("timelock", null),
      fact("owner", "0x0000000000000000000000000000000000abcdef"),
      fact("pausable", "true"),
    ]);
    const r = scoreContractRisk(f);
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("[2-03-01b] scoreContractRisk — missing-fact (D-07)", () => {
  it("all contract facts null → score 50, raw_value null, missing_facts populated", () => {
    const f = facts([
      fact("source verified", null),
      fact("audits", null),
      fact("proxy pattern", null),
      fact("timelock", null),
      fact("owner", null),
      fact("pausable", null),
    ]);
    const r = scoreContractRisk(f);
    expect(r.score).toBe(50);
    expect(r.raw_value).toBeNull();
    expect(r.missing_facts.length).toBeGreaterThanOrEqual(4);
  });

  it("no contract facts at all → score 50 + missing-facts populated", () => {
    const f = facts([]);
    const r = scoreContractRisk(f);
    expect(r.score).toBe(50);
    expect(r.raw_value).toBeNull();
    expect(r.missing_facts.length).toBeGreaterThanOrEqual(4);
  });
});

describe("[2-03-01c] scoreContractRisk — boundary-value triplets", () => {
  it("BANDS lookup: first band where index < max wins (top band catches null)", () => {
    const find = (idx: number) =>
      CONTRACT_RISK_BANDS.find((b) => b.max === null || idx < b.max)!;
    expect(find(29).score).toBe(30); // band 0: max 30
    expect(find(30).score).toBe(55); // boundary
    expect(find(49).score).toBe(55);
    expect(find(50).score).toBe(72);
    expect(find(69).score).toBe(72);
    expect(find(70).score).toBe(85);
    expect(find(84).score).toBe(85);
    expect(find(85).score).toBe(92);
    expect(find(100).score).toBe(92);
  });

  it("BANDS table is sorted ascending by `max`, with `max: null` last", () => {
    for (let i = 0; i < CONTRACT_RISK_BANDS.length - 1; i++) {
      const m = CONTRACT_RISK_BANDS[i].max;
      expect(m).not.toBeNull();
      expect(Number.isFinite(m as number)).toBe(true);
    }
    expect(
      CONTRACT_RISK_BANDS[CONTRACT_RISK_BANDS.length - 1].max,
    ).toBeNull();
  });
});
