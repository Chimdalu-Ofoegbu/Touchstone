// agent/src/index.ts — barrel re-exports for downstream waves.
// Wave 0 (Plan 2-01) version. Waves 1-4 extend with subject adapters,
// dimension scorers, claude synthesizer, hash, and CLI entrypoints.

export {
  GRADE_LETTER_TO_UINT8,
  GRADE_UINT8_TO_LETTER,
  GRADE_MAX,
} from "./constants/grade-enum.js";
export type { GradeLetter } from "./constants/grade-enum.js";

export { ReasoningDoc, parseReasoningDocument } from "./schema.js";
export type { ReasoningDocument } from "./schema.js";

export type { SubjectId, Fact, SubjectFacts } from "./subjects/types.js";
export type { Band, BandResult } from "./dimensions/types.js";
