// agent/src/constants/grade-enum.ts
// MIRROR of src/constants/GradeEnum.sol — byte-for-byte. Any change requires
// updating the Solidity file AND this file together. Verified by
// agent/tests/constants/grade-enum.test.ts which round-trips each pair.

export const GRADE_LETTER_TO_UINT8 = {
  AAA: 0,
  AA: 1,
  A: 2,
  BBB: 3,
  BB: 4,
  B: 5,
  CCC: 6,
  CC: 7,
  C: 8,
  D: 9,
} as const;

export type GradeLetter = keyof typeof GRADE_LETTER_TO_UINT8;

export const GRADE_UINT8_TO_LETTER: Record<number, GradeLetter> = {
  0: "AAA",
  1: "AA",
  2: "A",
  3: "BBB",
  4: "BB",
  5: "B",
  6: "CCC",
  7: "CC",
  8: "C",
  9: "D",
};

/** Maximum valid grade value (inclusive). Mirrors GradeEnum.MAX in Solidity. */
export const GRADE_MAX = 9;
