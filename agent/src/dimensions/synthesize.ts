// agent/src/dimensions/synthesize.ts
// Combiner over the 4 dimension BandResults. Applies:
//   - D-08: uniform 25% weighting → overall = round((sum)/4)
//   - D-07: confidence = clamp(100 - 5 * totalMissingFacts, 30, 100)
//   - GRADE_SCORE_TABLE → letter + uint8 (mirrors GradeEnum.sol via GRADE_LETTER_TO_UINT8)
//   - T-2-02 defense-in-depth: synthesize THROWS if it would emit uint8 > GRADE_MAX
//     or confidence ∉ [30, 100]. The synthesizer is the last line of defense
//     before Phase 3 publish; RatingRegistry would revert on out-of-bound values.

import type { BandResult } from "./types.js";
import {
  GRADE_LETTER_TO_UINT8,
  GRADE_MAX,
  type GradeLetter,
} from "../constants/grade-enum.js";

/**
 * Locked letter-grade boundaries. overall ∈ [0,100] → letter mapping.
 *
 *   AAA  >= 90    (best)
 *   AA   >= 80
 *   A    >= 70
 *   BBB  >= 60
 *   BB   >= 50
 *   B    >= 40
 *   CCC  >= 30
 *   CC   >= 20
 *   C    >= 10
 *   D    >= 0
 */
export const GRADE_SCORE_TABLE: ReadonlyArray<{
  min: number;
  letter: GradeLetter;
}> = [
  { min: 90, letter: "AAA" },
  { min: 80, letter: "AA" },
  { min: 70, letter: "A" },
  { min: 60, letter: "BBB" },
  { min: 50, letter: "BB" },
  { min: 40, letter: "B" },
  { min: 30, letter: "CCC" },
  { min: 20, letter: "CC" },
  { min: 10, letter: "C" },
  { min: 0, letter: "D" },
];

export function scoreToGrade(overall: number): {
  letter: GradeLetter;
  uint8: number;
} {
  // Clamp to [0, 100] so out-of-range input still produces a defined result.
  const clamped = Math.max(0, Math.min(100, overall));
  const entry = GRADE_SCORE_TABLE.find((e) => clamped >= e.min)!;
  return { letter: entry.letter, uint8: GRADE_LETTER_TO_UINT8[entry.letter] };
}

export type SynthesizeInput = {
  collateral: BandResult;
  contract: BandResult;
  oracle: BandResult;
  liquidity: BandResult;
};

export type SynthesizeOutput = {
  overall: number; // 0..100
  letter: GradeLetter;
  uint8: number; // 0..9
  confidence: number; // 30..100
  totalMissingFacts: number;
};

/**
 * D-08 uniform 25% weighting + D-07 confidence floor + T-2-02 bounds check.
 *
 * The throws below should NEVER fire under correct upstream logic; they are
 * defense-in-depth so a future change to scoreToGrade() or band recipes that
 * accidentally violates the on-chain contract bounds will fail loudly here
 * BEFORE the document is published.
 */
export function synthesize(input: SynthesizeInput): SynthesizeOutput {
  const { collateral, contract, oracle, liquidity } = input;
  const overall = Math.round(
    (collateral.score + contract.score + oracle.score + liquidity.score) / 4,
  );
  const grade = scoreToGrade(overall);

  const totalMissingFacts =
    collateral.missing_facts.length +
    contract.missing_facts.length +
    oracle.missing_facts.length +
    liquidity.missing_facts.length;

  const confidenceRaw = 100 - 5 * totalMissingFacts;
  const confidence = Math.max(30, Math.min(100, confidenceRaw));

  // T-2-02 invariant — these MUST hold or Phase 3 publishRating would revert.
  if (grade.uint8 < 0 || grade.uint8 > GRADE_MAX) {
    throw new Error(
      "synthesize produced out-of-bounds grade.uint8: " + String(grade.uint8),
    );
  }
  if (confidence < 30 || confidence > 100) {
    throw new Error(
      "synthesize produced out-of-bounds confidence: " + String(confidence),
    );
  }

  return {
    overall,
    letter: grade.letter,
    uint8: grade.uint8,
    confidence,
    totalMissingFacts,
  };
}
