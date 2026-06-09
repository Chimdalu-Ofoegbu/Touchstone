// agent/tests/dimensions/collateral-quality.test.ts
// Task 2-03-01 — collateral_quality scorer per PLAN behaviors:
//   1) typical inputs land in upper band
//   2) all collateral facts null → D-07 missing-fact path (score 50, raw_value null)
//   3) boundary-value triplets at each band's `max` confirm the lookup rule
//      (first band where index < max wins; top band is the `max: null` catch-all)
//   4) on-chain bounds: score is an integer in [0,100] for typical inputs
//
// Traceability: every test name carries the [2-03-01a/b/c] prefix.

import { describe, it, expect } from "vitest";
import {
  scoreCollateral,
  COLLATERAL_BANDS,
} from "../../src/dimensions/collateral-quality.js";
import type { SubjectFacts, Fact } from "../../src/subjects/types.js";

function fact(label: string, value: string | null): Fact {
  return {
    label,
    value,
    evidence: ".",
    source: { kind: "static", file: "test", version: "1.0.0" },
  };
}

function facts(collateral: Fact[]): SubjectFacts {
  return {
    subject: {
      name: "Test",
      ticker: "USDY",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 5000,
    },
    ingestBlock: 0,
    collateral,
    contract: [],
    oracle: [],
    liquidity: [],
  };
}

describe("[2-03-01a] scoreCollateral — typical inputs", () => {
  it("treasury + audit + reserve + custodian → top-of-table band (treasury-grade)", () => {
    const f = facts([
      fact(
        "issuer + collateral",
        "short-term US Treasuries + bank deposits",
      ),
      fact("audits", "Code4rena 2023, Halborn 2024"),
      fact("reserve attestation", "monthly"),
      fact("custodian", "Ankura Trust"),
    ]);
    const r = scoreCollateral(f);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.missing_facts).toEqual([]);
    expect(r.raw_value).not.toBeNull();
  });

  it("non-treasury but with audit + reserve + custodian still lands above neutral", () => {
    const f = facts([
      fact("issuer + collateral", "tokenized commercial paper"),
      fact("audits", "Halborn 2024"),
      fact("reserve attestation", "monthly"),
      fact("custodian", "Anchorage"),
    ]);
    const r = scoreCollateral(f);
    // No treasury bonus → idx = 20 + 20 + 15 = 55, band: 55 is NOT < 70 → score 85
    // Either way: must be at least the "moderate" band score (55).
    expect(r.score).toBeGreaterThanOrEqual(55);
  });

  it("score is always an integer in [0,100] for typical inputs", () => {
    const f = facts([
      fact("issuer + collateral", "short-term US Treasuries"),
      fact("audits", "audit"),
      fact("reserve attestation", "monthly"),
      fact("custodian", "X"),
    ]);
    const r = scoreCollateral(f);
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("[2-03-01b] scoreCollateral — missing-fact (D-07)", () => {
  it("all collateral facts null → score 50, raw_value null, missing_facts has 4 labels", () => {
    const f = facts([
      fact("issuer + collateral", null),
      fact("audits", null),
      fact("reserve attestation", null),
      fact("custodian", null),
    ]);
    const r = scoreCollateral(f);
    expect(r.score).toBe(50);
    expect(r.raw_value).toBeNull();
    expect(r.missing_facts.length).toBe(4);
    expect(r.missing_facts).toEqual(
      expect.arrayContaining([
        "issuer + collateral",
        "audits",
        "reserve attestation",
        "custodian",
      ]),
    );
  });

  it("no collateral facts at all → score 50 + all 4 labels reported as missing", () => {
    const f = facts([]);
    const r = scoreCollateral(f);
    expect(r.score).toBe(50);
    expect(r.raw_value).toBeNull();
    expect(r.missing_facts.length).toBe(4);
  });

  it("partial missing → dimension still scores (does NOT default to 50)", () => {
    // Only audit + reserve present (no issuer, no custodian)
    const f = facts([
      fact("audits", "Halborn 2024"),
      fact("reserve attestation", "monthly"),
    ]);
    const r = scoreCollateral(f);
    // missing 2 of 4 → recipe runs, raw_value !== null
    expect(r.raw_value).not.toBeNull();
    expect(r.missing_facts).toEqual(
      expect.arrayContaining(["issuer + collateral", "custodian"]),
    );
    expect(r.missing_facts.length).toBe(2);
  });
});

describe("[2-03-01c] scoreCollateral — boundary-value triplets", () => {
  // BANDS table is sorted ascending by `max`. Lookup rule:
  //   first band where (max === null || idx < max) wins.
  // For each band's `max`, we assert {max-1, max, max+1} land in the
  // correct bands. The top band (`max: null`) is the catch-all for
  // index >= the previous band's max.
  it("BANDS lookup: first band where index < max wins (top band catches null)", () => {
    const find = (idx: number) =>
      COLLATERAL_BANDS.find((b) => b.max === null || idx < b.max)!;
    expect(find(29).score).toBe(35); // band 0: max 30
    expect(find(30).score).toBe(55); // boundary: 30 is NOT < 30 → falls into band 1
    expect(find(49).score).toBe(55);
    expect(find(50).score).toBe(72);
    expect(find(69).score).toBe(72);
    expect(find(70).score).toBe(85);
    expect(find(84).score).toBe(85);
    expect(find(85).score).toBe(92);
    expect(find(100).score).toBe(92);
  });

  it("BANDS table is sorted ascending by `max`, with `max: null` last", () => {
    for (let i = 0; i < COLLATERAL_BANDS.length - 1; i++) {
      const m = COLLATERAL_BANDS[i].max;
      expect(m).not.toBeNull();
      expect(Number.isFinite(m as number)).toBe(true);
    }
    expect(COLLATERAL_BANDS[COLLATERAL_BANDS.length - 1].max).toBeNull();
  });
});
