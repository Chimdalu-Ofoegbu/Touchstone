// web/lib/grades.ts
// Grade model mirrored from DEC-grade-encoding-uint8 (shared by contract + agent):
// uint8 0..9 -> AAA..D. Plus the family classification + plain-language labels
// the UI needs (a first-time, no-DeFi user must grasp what a grade means).

export type GradeLetter =
  | "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC" | "CC" | "C" | "D";

export const LETTERS: readonly GradeLetter[] = [
  "AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D",
] as const;

export type GradeFamily = "prime" | "watch" | "caution" | "distress";

/** Family (and its token color name) for a uint8 grade. */
export function familyOf(uint8: number): GradeFamily {
  if (uint8 <= 2) return "prime"; // AAA, AA, A
  if (uint8 <= 4) return "watch"; // BBB, BB
  if (uint8 <= 6) return "caution"; // B, CCC
  return "distress"; // CC, C, D
}

/** Short, human label for the family — for the no-jargon reader. */
export const FAMILY_LABEL: Record<GradeFamily, string> = {
  prime: "Investment grade",
  watch: "Watch",
  caution: "Speculative",
  distress: "Distressed",
};

/** One-line plain-language meaning of a grade. */
export const FAMILY_MEANING: Record<GradeFamily, string> = {
  prime: "Strong fundamentals; low expected risk of failure.",
  watch: "Adequate now, but with weaknesses worth watching.",
  caution: "Material risk; vulnerable to adverse conditions.",
  distress: "Severe risk or active deterioration.",
};

export function letterOf(uint8: number): GradeLetter {
  return LETTERS[Math.max(0, Math.min(9, uint8))];
}

/**
 * Composite-score floor (0..100) for each letter — mirrors the agent's
 * GRADE_SCORE_TABLE (agent/src/dimensions/synthesize.ts) and GradeEnum.sol.
 * A composite >= the floor (and below the next letter's) earns that grade.
 */
export const GRADE_MIN_SCORE: Record<GradeLetter, number> = {
  AAA: 90, AA: 80, A: 70, BBB: 60, BB: 50, B: 40, CCC: 30, CC: 20, C: 10, D: 0,
};

/** Tailwind text/border/bg color class for a grade's family. */
export function familyColorClass(uint8: number): {
  text: string;
  border: string;
  bg: string;
} {
  const f = familyOf(uint8);
  return {
    text: `text-${f}`,
    border: `border-${f}`,
    bg: `bg-${f}`,
  };
}

export const CONFIDENCE_LABEL = (c: number) =>
  c >= 80 ? "High" : c >= 55 ? "Moderate" : "Low";
