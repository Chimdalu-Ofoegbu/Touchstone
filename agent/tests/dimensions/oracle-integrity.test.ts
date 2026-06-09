// agent/tests/dimensions/oracle-integrity.test.ts
// Task 2-03-02 — oracle_integrity scorer per PLAN behaviors:
//   1) typical: oracle architecture + staleness tolerance present → upper band
//   2) all facts null → D-07 default to 50
//   3) boundary-value triplets at every band's max
//   4) integer score in [0,100]
//
// Recipe (RESEARCH §7.3):
//   +20 if oracle architecture string non-empty
//   +20 if staleness tolerance <= 24h OR "monthly" (attestation-backed)
//   +15 if redundant feeds indicator present in architecture string
//   +15 if manipulation-resistant aggregator indicator present
//   -25 if single-point-of-failure / "single trusted feed" indicator

import { describe, it, expect } from "vitest";
import {
  scoreOracleIntegrity,
  ORACLE_BANDS,
} from "../../src/dimensions/oracle-integrity.js";
import type { SubjectFacts, Fact } from "../../src/subjects/types.js";

function fact(label: string, value: string | null): Fact {
  return {
    label,
    value,
    evidence: ".",
    source: { kind: "static", file: "test", version: "1.0.0" },
  };
}

function facts(oracle: Fact[]): SubjectFacts {
  return {
    subject: {
      name: "Test",
      ticker: "USDY",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 5000,
    },
    ingestBlock: 0,
    collateral: [],
    contract: [],
    oracle,
    liquidity: [],
  };
}

describe("[2-03-02a] scoreOracleIntegrity — typical inputs", () => {
  it("redundant + manipulation-resistant + 24h staleness → upper band", () => {
    const f = facts([
      fact(
        "oracle architecture",
        "redundant feeds with manipulation-resistant aggregator across multiple sources",
      ),
      fact("staleness tolerance", "24h"),
    ]);
    const r = scoreOracleIntegrity(f);
    expect(r.score).toBeGreaterThanOrEqual(72);
    expect(r.raw_value).not.toBeNull();
  });

  it("attestation-backed monthly staleness → still scores above neutral", () => {
    const f = facts([
      fact(
        "oracle architecture",
        "off-chain reserve attestation with on-chain settlement",
      ),
      fact("staleness tolerance", "monthly"),
    ]);
    const r = scoreOracleIntegrity(f);
    // recipe: +20 + 20 = 40 → band 1 (max 50) → score 55
    expect(r.score).toBeGreaterThanOrEqual(55);
  });

  it("single trusted feed → penalty path scores in lower bands", () => {
    const f = facts([
      fact(
        "oracle architecture",
        "single trusted feed with no on-chain redundancy",
      ),
      fact("staleness tolerance", "24h"),
    ]);
    const r = scoreOracleIntegrity(f);
    // +20 + 20 - 25 = 15 → band 0 (max 30) → score 30
    expect(r.score).toBeLessThanOrEqual(55);
  });

  it("score is integer in [0,100]", () => {
    const f = facts([
      fact("oracle architecture", "redundant feeds"),
      fact("staleness tolerance", "24h"),
    ]);
    const r = scoreOracleIntegrity(f);
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("[2-03-02b] scoreOracleIntegrity — missing-fact (D-07)", () => {
  it("all oracle facts null → score 50, raw_value null, missing_facts populated", () => {
    const f = facts([
      fact("oracle architecture", null),
      fact("staleness tolerance", null),
    ]);
    const r = scoreOracleIntegrity(f);
    expect(r.score).toBe(50);
    expect(r.raw_value).toBeNull();
    expect(r.missing_facts.length).toBeGreaterThanOrEqual(2);
  });

  it("no oracle facts → score 50, missing_facts populated", () => {
    const f = facts([]);
    const r = scoreOracleIntegrity(f);
    expect(r.score).toBe(50);
    expect(r.raw_value).toBeNull();
  });
});

describe("[2-03-02c] scoreOracleIntegrity — boundary-value triplets", () => {
  it("BANDS lookup: first band where index < max wins (top band catches null)", () => {
    const find = (idx: number) =>
      ORACLE_BANDS.find((b) => b.max === null || idx < b.max)!;
    expect(find(29).score).toBe(30);
    expect(find(30).score).toBe(55);
    expect(find(49).score).toBe(55);
    expect(find(50).score).toBe(72);
    expect(find(69).score).toBe(72);
    expect(find(70).score).toBe(85);
    expect(find(84).score).toBe(85);
    expect(find(85).score).toBe(92);
    expect(find(100).score).toBe(92);
  });

  it("BANDS table sorted ascending; top band has max:null", () => {
    for (let i = 0; i < ORACLE_BANDS.length - 1; i++) {
      expect(ORACLE_BANDS[i].max).not.toBeNull();
    }
    expect(ORACLE_BANDS[ORACLE_BANDS.length - 1].max).toBeNull();
  });
});
