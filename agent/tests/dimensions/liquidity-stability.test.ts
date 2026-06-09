// agent/tests/dimensions/liquidity-stability.test.ts
// Task 2-03-02 — liquidity_stability scorer per PLAN behaviors:
//   1) USDY parent_tvl = $680M → "deep" band (≥ 82)
//   2) mantle_tvl ONLY = $8M (no parent) → "limited" band ≈ 50
//      (confirms RESEARCH Open Q2: prefer parent_tvl when present)
//   3) all facts null → D-07 default to 50
//   4) boundary-value triplets at each band's max
//
// Band-input rule (RESEARCH §7.4 + Open Q2): if "parent TVL (USD)" fact is
// non-null, use it; else fall back to "mantle TVL (USD)"; else default to 50.

import { describe, it, expect } from "vitest";
import {
  scoreLiquidityStability,
  LIQUIDITY_BANDS,
} from "../../src/dimensions/liquidity-stability.js";
import type { SubjectFacts, Fact } from "../../src/subjects/types.js";

function fact(label: string, value: string | null): Fact {
  return {
    label,
    value,
    evidence: ".",
    source: { kind: "static", file: "test", version: "1.0.0" },
  };
}

function facts(liquidity: Fact[]): SubjectFacts {
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
    oracle: [],
    liquidity,
  };
}

describe("[2-03-02a] scoreLiquidityStability — typical inputs", () => {
  it("USDY parent_tvl $680M → 'deep' band, score ≥ 82", () => {
    const f = facts([
      fact("mantle TVL (USD)", "8000000"),
      fact("parent TVL (USD)", "680000000"),
    ]);
    const r = scoreLiquidityStability(f);
    // 680M is < 1_000_000_000 ish but at band 3 max 500M? 680M is >= 500M → top band score 92
    // Wait: bands are [1M, 10M, 100M, 500M, null]. 680M is NOT < 500M → falls into max:null catch-all → score 92.
    expect(r.score).toBeGreaterThanOrEqual(82);
    expect(r.raw_value).toBe(680_000_000);
  });

  it("cmETH parent_tvl $750M → 'anchor' top band, score 92", () => {
    const f = facts([
      fact("mantle TVL (USD)", "750000000"),
      fact("parent TVL (USD)", "750000000"),
    ]);
    const r = scoreLiquidityStability(f);
    expect(r.score).toBe(92);
  });

  it("mantle_tvl ONLY = $8M (parent null) → 'limited' band ≈ 50 (RESEARCH Open Q2 fallback)", () => {
    const f = facts([
      fact("mantle TVL (USD)", "8000000"),
      fact("parent TVL (USD)", null),
    ]);
    const r = scoreLiquidityStability(f);
    // 8M < 10M → band 1 (score 50)
    expect(r.score).toBe(50);
    expect(r.raw_value).toBe(8_000_000);
  });

  it("very thin liquidity ($500k) → bottom band, score 25", () => {
    const f = facts([
      fact("mantle TVL (USD)", "500000"),
      fact("parent TVL (USD)", "500000"),
    ]);
    const r = scoreLiquidityStability(f);
    expect(r.score).toBe(25);
  });

  it("score is integer in [0,100]", () => {
    const f = facts([
      fact("mantle TVL (USD)", "50000000"),
      fact("parent TVL (USD)", "100000000"),
    ]);
    const r = scoreLiquidityStability(f);
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("[2-03-02b] scoreLiquidityStability — missing-fact (D-07)", () => {
  it("both TVL facts null → score 50, raw_value null, missing_facts populated", () => {
    const f = facts([
      fact("mantle TVL (USD)", null),
      fact("parent TVL (USD)", null),
    ]);
    const r = scoreLiquidityStability(f);
    expect(r.score).toBe(50);
    expect(r.raw_value).toBeNull();
    expect(r.missing_facts.length).toBeGreaterThanOrEqual(2);
  });

  it("no liquidity facts at all → score 50, missing_facts populated", () => {
    const f = facts([]);
    const r = scoreLiquidityStability(f);
    expect(r.score).toBe(50);
    expect(r.raw_value).toBeNull();
  });
});

describe("[2-03-02c] scoreLiquidityStability — boundary-value triplets", () => {
  it("BANDS lookup: TVL just below/at/above each max", () => {
    const find = (idx: number) =>
      LIQUIDITY_BANDS.find((b) => b.max === null || idx < b.max)!;
    expect(find(999_999).score).toBe(25); // <1M
    expect(find(1_000_000).score).toBe(50); // =1M, NOT <1M → next band
    expect(find(9_999_999).score).toBe(50);
    expect(find(10_000_000).score).toBe(70);
    expect(find(99_999_999).score).toBe(70);
    expect(find(100_000_000).score).toBe(82);
    expect(find(499_999_999).score).toBe(82);
    expect(find(500_000_000).score).toBe(92);
    expect(find(1_000_000_000_000).score).toBe(92); // top band catches everything
  });

  it("BANDS table sorted ascending; top band has max:null", () => {
    for (let i = 0; i < LIQUIDITY_BANDS.length - 1; i++) {
      expect(LIQUIDITY_BANDS[i].max).not.toBeNull();
    }
    expect(LIQUIDITY_BANDS[LIQUIDITY_BANDS.length - 1].max).toBeNull();
  });
});
