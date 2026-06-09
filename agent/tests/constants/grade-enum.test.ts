import { describe, it, expect } from "vitest";
import {
  GRADE_LETTER_TO_UINT8,
  GRADE_UINT8_TO_LETTER,
  GRADE_MAX,
  type GradeLetter,
} from "../../src/constants/grade-enum";

describe("[2-01-02] GradeEnum TS mirror of src/constants/GradeEnum.sol", () => {
  // Hard-assert each pair literally — if anyone renumbers without thinking,
  // this test fails noisily. Mirrors PATTERNS §1 discipline.
  it("AAA=0", () => expect(GRADE_LETTER_TO_UINT8.AAA).toBe(0));
  it("AA=1", () => expect(GRADE_LETTER_TO_UINT8.AA).toBe(1));
  it("A=2", () => expect(GRADE_LETTER_TO_UINT8.A).toBe(2));
  it("BBB=3", () => expect(GRADE_LETTER_TO_UINT8.BBB).toBe(3));
  it("BB=4", () => expect(GRADE_LETTER_TO_UINT8.BB).toBe(4));
  it("B=5", () => expect(GRADE_LETTER_TO_UINT8.B).toBe(5));
  it("CCC=6", () => expect(GRADE_LETTER_TO_UINT8.CCC).toBe(6));
  it("CC=7", () => expect(GRADE_LETTER_TO_UINT8.CC).toBe(7));
  it("C=8", () => expect(GRADE_LETTER_TO_UINT8.C).toBe(8));
  it("D=9", () => expect(GRADE_LETTER_TO_UINT8.D).toBe(9));

  it("MAX is 9 — mirrors GradeEnum.MAX in Solidity (RatingRegistry reverts InvalidGrade if > MAX)", () => {
    expect(GRADE_MAX).toBe(9);
  });

  it("contains exactly 10 letters", () => {
    expect(Object.keys(GRADE_LETTER_TO_UINT8)).toHaveLength(10);
  });

  it("round-trips letter → uint8 → letter for every entry", () => {
    for (const [letter, u8] of Object.entries(GRADE_LETTER_TO_UINT8)) {
      expect(GRADE_UINT8_TO_LETTER[u8]).toBe(letter as GradeLetter);
    }
  });
});
