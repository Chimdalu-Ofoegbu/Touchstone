// agent/tests/dimensions/synthesize.test.ts
// Task 2-03-02 — synthesize() combiner per PLAN behaviors:
//   D-08 uniform 25% weighting
//   D-07 confidence floor 30, ceiling 100
//   T-2-02 defense-in-depth: uint8 in [0,9], confidence in [30,100]
//   Letter grade mapping: AAA >= 90, AA >= 80, A >= 70, BBB >= 60, BB >= 50,
//                         B >= 40, CCC >= 30, CC >= 20, C >= 10, D >= 0

import { describe, it, expect } from "vitest";
import {
  synthesize,
  scoreToGrade,
  GRADE_SCORE_TABLE,
} from "../../src/dimensions/synthesize.js";
import type { BandResult } from "../../src/dimensions/types.js";

function band(score: number, missing: string[] = []): BandResult {
  return {
    max: null,
    score,
    label: "test",
    missing_facts: missing,
    raw_value: score,
  };
}

describe("[2-03-02] synthesize() — uniform 25% (D-08)", () => {
  it("overall == round((a+b+c+d)/4)", () => {
    const out = synthesize({
      collateral: band(80),
      contract: band(80),
      oracle: band(80),
      liquidity: band(80),
    });
    expect(out.overall).toBe(80);
  });

  it("uneven mix averages correctly with rounding", () => {
    const out = synthesize({
      collateral: band(85),
      contract: band(72),
      oracle: band(55),
      liquidity: band(50),
    });
    expect(out.overall).toBe(Math.round((85 + 72 + 55 + 50) / 4)); // 65 or 66
  });

  it("totalMissingFacts equals sum across all 4 dimensions", () => {
    const out = synthesize({
      collateral: band(50, ["a", "b"]),
      contract: band(50, ["c"]),
      oracle: band(50, ["d", "e", "f"]),
      liquidity: band(50, []),
    });
    expect(out.totalMissingFacts).toBe(6);
  });
});

describe("[2-03-02] synthesize() — confidence (D-07 floor 30)", () => {
  it("0 missing → confidence 100", () => {
    const out = synthesize({
      collateral: band(70),
      contract: band(70),
      oracle: band(70),
      liquidity: band(70),
    });
    expect(out.confidence).toBe(100);
  });

  it("10 missing → confidence 50", () => {
    const out = synthesize({
      collateral: band(50, ["a", "b", "c"]),
      contract: band(50, ["d", "e", "f"]),
      oracle: band(50, ["g", "h"]),
      liquidity: band(50, ["i", "j"]),
    });
    expect(out.totalMissingFacts).toBe(10);
    expect(out.confidence).toBe(50);
  });

  it("30 missing → confidence floor 30 (NOT lower)", () => {
    const labels = Array.from({ length: 30 }, (_, i) => "fact" + i);
    const out = synthesize({
      collateral: band(50, labels.slice(0, 8)),
      contract: band(50, labels.slice(8, 16)),
      oracle: band(50, labels.slice(16, 23)),
      liquidity: band(50, labels.slice(23, 30)),
    });
    expect(out.totalMissingFacts).toBe(30);
    expect(out.confidence).toBe(30);
  });

  it("14 missing → confidence floor 30 also (100 - 5*14 = 30, exactly the floor)", () => {
    const labels = Array.from({ length: 14 }, (_, i) => "fact" + i);
    const out = synthesize({
      collateral: band(50, labels.slice(0, 4)),
      contract: band(50, labels.slice(4, 8)),
      oracle: band(50, labels.slice(8, 11)),
      liquidity: band(50, labels.slice(11, 14)),
    });
    expect(out.totalMissingFacts).toBe(14);
    expect(out.confidence).toBe(30);
  });

  it("15+ missing → still 30 (floor enforced strictly)", () => {
    const labels = Array.from({ length: 15 }, (_, i) => "fact" + i);
    const out = synthesize({
      collateral: band(50, labels),
      contract: band(50),
      oracle: band(50),
      liquidity: band(50),
    });
    expect(out.confidence).toBe(30);
  });
});

describe("[2-03-02] synthesize() — on-chain bounds (T-2-02)", () => {
  it("all scores 100, 0 missing → uint8 in [0,9], confidence 100, letter AAA", () => {
    const out = synthesize({
      collateral: band(100),
      contract: band(100),
      oracle: band(100),
      liquidity: band(100),
    });
    expect(out.uint8).toBeGreaterThanOrEqual(0);
    expect(out.uint8).toBeLessThanOrEqual(9);
    expect(out.confidence).toBe(100);
    expect(out.letter).toBe("AAA");
  });

  it("all scores 0, 100 missing facts → uint8 in [0,9], confidence 30, letter D", () => {
    const labels = Array.from({ length: 100 }, (_, i) => "f" + i);
    const out = synthesize({
      collateral: band(0, labels.slice(0, 25)),
      contract: band(0, labels.slice(25, 50)),
      oracle: band(0, labels.slice(50, 75)),
      liquidity: band(0, labels.slice(75, 100)),
    });
    expect(out.uint8).toBeGreaterThanOrEqual(0);
    expect(out.uint8).toBeLessThanOrEqual(9);
    expect(out.confidence).toBe(30);
    expect(out.letter).toBe("D");
  });

  it("confidence is integer (no floats from rounding)", () => {
    const out = synthesize({
      collateral: band(50, ["a"]),
      contract: band(50, ["b"]),
      oracle: band(50, ["c"]),
      liquidity: band(50),
    });
    expect(Number.isInteger(out.confidence)).toBe(true);
  });

  it("overall is integer", () => {
    const out = synthesize({
      collateral: band(85),
      contract: band(72),
      oracle: band(55),
      liquidity: band(50),
    });
    expect(Number.isInteger(out.overall)).toBe(true);
  });
});

describe("[2-03-02] scoreToGrade — letter boundaries (every 10 points)", () => {
  it.each([
    [95, "AAA", 0],
    [90, "AAA", 0],
    [89, "AA", 1],
    [80, "AA", 1],
    [79, "A", 2],
    [70, "A", 2],
    [69, "BBB", 3],
    [60, "BBB", 3],
    [59, "BB", 4],
    [50, "BB", 4],
    [49, "B", 5],
    [40, "B", 5],
    [39, "CCC", 6],
    [30, "CCC", 6],
    [29, "CC", 7],
    [20, "CC", 7],
    [19, "C", 8],
    [10, "C", 8],
    [9, "D", 9],
    [0, "D", 9],
  ])("scoreToGrade(%i) === { letter: %s, uint8: %i }", (overall, letter, u8) => {
    const r = scoreToGrade(overall as number);
    expect(r.letter).toBe(letter);
    expect(r.uint8).toBe(u8);
  });

  it("scoreToGrade clamps out-of-range input (101 → AAA, -5 → D)", () => {
    expect(scoreToGrade(101).letter).toBe("AAA");
    expect(scoreToGrade(-5).letter).toBe("D");
  });

  it("GRADE_SCORE_TABLE has 10 entries sorted descending by min", () => {
    expect(GRADE_SCORE_TABLE.length).toBe(10);
    for (let i = 0; i < GRADE_SCORE_TABLE.length - 1; i++) {
      expect(GRADE_SCORE_TABLE[i].min).toBeGreaterThan(
        GRADE_SCORE_TABLE[i + 1].min,
      );
    }
  });
});
