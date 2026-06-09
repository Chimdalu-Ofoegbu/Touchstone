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

// Wave 1 (Plan 2-02) — subject adapters + static facts.
export { STATIC, STATIC_VERSION, staticFact } from "./subjects/static.js";
export type { StaticSubject } from "./subjects/static.js";
export { fetchUsdy } from "./subjects/usdy.js";
export { fetchCmeth } from "./subjects/cmeth.js";
export { fetchFbtc } from "./subjects/fbtc.js";
export { ADAPTERS, getAdapter } from "./subjects/registry.js";

// Wave 2 (Plan 2-03) — deterministic dimension scorers + synthesize combiner.
export {
  COLLATERAL_BANDS,
  scoreCollateral,
} from "./dimensions/collateral-quality.js";
export {
  CONTRACT_RISK_BANDS,
  scoreContractRisk,
} from "./dimensions/contract-risk.js";
export {
  ORACLE_BANDS,
  scoreOracleIntegrity,
} from "./dimensions/oracle-integrity.js";
export {
  LIQUIDITY_BANDS,
  scoreLiquidityStability,
} from "./dimensions/liquidity-stability.js";
export {
  GRADE_SCORE_TABLE,
  scoreToGrade,
  synthesize,
} from "./dimensions/synthesize.js";
export type {
  SynthesizeInput,
  SynthesizeOutput,
} from "./dimensions/synthesize.js";

// Wave 3 (Plan 2-04) — Claude single-shot synthesizer + JCS hash chain.
export { canonicalizeDoc, computeReasoningHash } from "./hash.js";
export { submitRatingTool } from "./claude/tool-schema.js";
export { buildPromptFromFacts } from "./claude/prompt.js";
export type { BuildPromptInput } from "./claude/prompt.js";
export { synthesizeRating, MODEL } from "./claude/synthesize.js";
export type {
  AnthropicClientLike,
  SynthesizeRatingInput,
} from "./claude/synthesize.js";
