import { describe, it, expect } from "vitest";
import { parseReasoningDocument } from "../src/schema.js";

const validDoc = {
  schema_version: "1.0.0",
  subject: {
    name: "Ondo U.S. Dollar Yield",
    ticker: "USDY",
    address: "0x5be26527e817998A7206475496fDE1E68957c5A6",
    chain_id: 5000,
  },
  grade: { letter: "A", uint8: 2 },
  confidence: 85,
  dimensions: [
    {
      key: "collateral_quality",
      score: 72,
      band_hit: { max: 70, score: 72, label: "strong collateral" },
      missing_facts: [],
      rationale: "Tokenized treasuries with monthly attestation [1].",
      citations: [
        {
          id: 1,
          label: "issuer",
          value: "Ondo Finance",
          // W4 fix: seed uses a real 0x address so the static_config test below is a meaningful mutation.
          source: {
            address: "0x5be26527e817998A7206475496fDE1E68957c5A6",
            function: "issuer()",
            block_number: 75000000,
          },
          evidence: "Ondo Finance is the issuer (on-chain reference).",
        },
      ],
    },
    {
      key: "contract_risk",
      score: 72,
      band_hit: { max: 70, score: 72, label: "verified, audited" },
      missing_facts: [],
      rationale: "Verified source on Mantlescan [1].",
      citations: [
        {
          id: 1,
          label: "implementation",
          value: "0x3b355A7A25E75A320f631F9736afB3Dcc9F3Ef66",
          source: {
            address: "0x5be26527e817998A7206475496fDE1E68957c5A6",
            function: "implementation()",
            block_number: 75000000,
          },
          evidence: "EIP-1967 implementation slot points to a verified contract.",
        },
      ],
    },
    {
      key: "oracle_integrity",
      score: 55,
      band_hit: { max: 50, score: 55, label: "single oracle with documented staleness guard" },
      missing_facts: [],
      rationale: "Internal accrual model [1].",
      citations: [
        {
          id: 1,
          label: "oracle architecture",
          value: "internal-accrual, daily settler",
          source: { address: "static_config", function: "static.ts@1.0.0", block_number: 0 },
          evidence: "USDY accrues price internally.",
        },
      ],
    },
    {
      key: "liquidity_stability",
      score: 82,
      band_hit: { max: 500_000_000, score: 82, label: "deep parent liquidity" },
      missing_facts: [],
      rationale: "Parent supply $680M [1].",
      citations: [
        {
          id: 1,
          label: "parent TVL",
          value: "$680,000,000",
          source: { address: "static_config", function: "static.ts@1.0.0", block_number: 0 },
          evidence: "Parent TVL recorded in static config.",
        },
      ],
    },
  ],
  overall_rationale: "USDY presents low risk across all four dimensions.",
  generated_at: "2026-06-09T00:00:00Z",
  claude_model: "claude-opus-4-8",
  ingest_block: 75000000,
};

describe("[2-01-03] ReasoningDocument zod schema", () => {
  it("accepts a valid document", () => {
    expect(() => parseReasoningDocument(validDoc)).not.toThrow();
  });

  it("rejects grade.uint8 > 9 (T-2-02: mirrors GradeEnum.MAX = 9)", () => {
    expect(() =>
      parseReasoningDocument({ ...validDoc, grade: { letter: "AAA", uint8: 10 } }),
    ).toThrow();
  });

  it("rejects grade.uint8 < 0 (lower bound)", () => {
    expect(() =>
      parseReasoningDocument({ ...validDoc, grade: { letter: "AAA", uint8: -1 } }),
    ).toThrow();
  });

  it("rejects confidence > 100 (T-2-02: mirrors RatingRegistry.InvalidConfidence)", () => {
    expect(() => parseReasoningDocument({ ...validDoc, confidence: 101 })).toThrow();
  });

  it("rejects confidence < 30 (D-07: floor)", () => {
    expect(() => parseReasoningDocument({ ...validDoc, confidence: 29 })).toThrow();
  });

  it("rejects fractional confidence (.int() enforced)", () => {
    expect(() => parseReasoningDocument({ ...validDoc, confidence: 85.5 })).toThrow();
  });

  it("rejects subject.chain_id != 5000 (D-05 lock)", () => {
    expect(() =>
      parseReasoningDocument({
        ...validDoc,
        subject: { ...validDoc.subject, chain_id: 5003 },
      }),
    ).toThrow();
  });

  it("rejects dimensions.length != 4 (D-08 uniform 25% requires exactly 4)", () => {
    expect(() =>
      parseReasoningDocument({
        ...validDoc,
        dimensions: validDoc.dimensions.slice(0, 3),
      }),
    ).toThrow();
  });

  it("accepts citation with source.address == 'static_config'", () => {
    // W4 fix: deep-clone via JSON.parse(JSON.stringify(...)) to avoid mutating validDoc.
    const doc = JSON.parse(JSON.stringify(validDoc));
    doc.dimensions[0].citations[0].source.address = "static_config";
    expect(() => parseReasoningDocument(doc)).not.toThrow();
  });

  it("rejects citation with malformed source.address", () => {
    const doc = JSON.parse(JSON.stringify(validDoc));
    doc.dimensions[0].citations[0].source.address = "not_a_hex";
    expect(() => parseReasoningDocument(doc)).toThrow();
  });

  it("schema_version is locked to '1.0.0'", () => {
    expect(() =>
      parseReasoningDocument({ ...validDoc, schema_version: "2.0.0" }),
    ).toThrow();
  });
});
