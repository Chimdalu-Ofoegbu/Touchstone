// agent/src/dimensions/types.ts
// Band contract per D-06 (threshold-banded scoring). Dimension scorers
// declare a top-of-file BANDS constant and look up via a 3-line loop:
//   for (const b of BANDS) if (value < b.max) return b;

export type Band = {
  /** Upper bound (exclusive) on the dimension's quality index. `null` is the catch-all top band. */
  max: number | null;
  score: number;
  label: string;
};

export type BandResult = Band & {
  /** Labels of facts that were unreadable; drives D-07 confidence drop. */
  missing_facts: string[];
  /** The quality index that landed in this band (or null if dimension defaulted to 50 per D-07). */
  raw_value: number | null;
};
