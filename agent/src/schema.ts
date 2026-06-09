// agent/src/schema.ts
// Locked ReasoningDocument shape per D-12. Phase 3 hashes this; Phase 4 verifies.
// Any change is a breaking change for downstream phases.
//
// On-chain bound mirrors (T-2-02 mitigation):
//   grade.uint8: 0..9      mirrors GradeEnum.MAX and RatingRegistry.InvalidGrade
//   confidence:  30..100   100 ceiling mirrors RatingRegistry.InvalidConfidence;
//                          30 floor is D-07 (engine-internal missing-fact handling)
//   subject.chain_id: literal 5000  D-05 lock: engine reads from Mantle Mainnet
//   dimensions: length 4   D-08 lock: uniform 25% over 4 dimensions
//   schema_version: literal "1.0.0"  defensive forward-compat (CONTEXT specifics)

import { z } from "zod";

// Citation — every cite must point to either an on-chain address OR the
// versioned static config sentinel "static_config" (RESEARCH §3 note,
// PATTERNS "Static-fact citation source convention").
const Citation = z.object({
  id: z.number().int().min(1),
  label: z.string().min(1),
  value: z.string(),
  source: z.object({
    address: z
      .string()
      .regex(
        /^0x[a-fA-F0-9]{40}$|^static_config$/,
        "must be a 0x address or the literal string 'static_config'",
      ),
    function: z.string().min(1),
    block_number: z.number().int().nonnegative(),
  }),
  evidence: z.string().min(1),
});

const Dimension = z.object({
  key: z.enum([
    "collateral_quality",
    "contract_risk",
    "oracle_integrity",
    "liquidity_stability",
  ]),
  score: z.number().int().min(0).max(100),
  band_hit: z.object({
    max: z.number().nullable(),
    score: z.number().int(),
    label: z.string().min(1),
  }),
  missing_facts: z.array(z.string()),
  rationale: z.string().min(1),
  citations: z.array(Citation),
});

export const ReasoningDoc = z.object({
  schema_version: z.literal("1.0.0"),
  subject: z.object({
    name: z.string().min(1),
    ticker: z.enum(["USDY", "cmETH", "FBTC"]),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    chain_id: z.literal(5000),
  }),
  grade: z.object({
    letter: z.enum(["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"]),
    uint8: z.number().int().min(0).max(9),
  }),
  confidence: z.number().int().min(30).max(100),
  dimensions: z.array(Dimension).length(4),
  overall_rationale: z.string().min(1),
  generated_at: z.string().min(1), // ISO 8601; engine sets, NOT Claude
  claude_model: z.string().min(1),
  ingest_block: z.number().int().nonnegative(),
});

export type ReasoningDocument = z.infer<typeof ReasoningDoc>;

/** Strict parse helper used by claude/synthesize.ts and tests. */
export function parseReasoningDocument(input: unknown): ReasoningDocument {
  return ReasoningDoc.parse(input);
}
