// agent/tests/hash-determinism.test.ts
// [2-04-01c] Hash determinism (T-2-06). Two structurally-identical docs
// authored with different key orders MUST produce identical canonical
// strings AND identical keccak256 hashes. Phase 4 verifier depends on
// this being byte-for-byte. Also asserts mutation sensitivity (changing
// any field changes the hash).

import { describe, it, expect } from "vitest";
import { canonicalizeDoc, computeReasoningHash } from "../src/hash.js";
import {
  parseReasoningDocument,
  type ReasoningDocument,
} from "../src/schema.js";

const dimensionsForA = [
  {
    key: "collateral_quality",
    citations: [
      {
        id: 1,
        label: "l",
        value: "v",
        source: {
          block_number: 0,
          address: "static_config",
          function: "f",
        },
        evidence: "e",
      },
    ],
    rationale: "r [1]",
    missing_facts: [],
    band_hit: { label: "x", max: 70, score: 72 },
    score: 72,
  },
  {
    key: "contract_risk",
    citations: [
      {
        id: 1,
        label: "l",
        value: "v",
        source: {
          block_number: 0,
          address: "static_config",
          function: "f",
        },
        evidence: "e",
      },
    ],
    rationale: "r [1]",
    missing_facts: [],
    band_hit: { label: "y", max: 70, score: 72 },
    score: 72,
  },
  {
    key: "oracle_integrity",
    citations: [
      {
        id: 1,
        label: "l",
        value: "v",
        source: {
          block_number: 0,
          address: "static_config",
          function: "f",
        },
        evidence: "e",
      },
    ],
    rationale: "r [1]",
    missing_facts: [],
    band_hit: { label: "z", max: 50, score: 55 },
    score: 55,
  },
  {
    key: "liquidity_stability",
    citations: [
      {
        id: 1,
        label: "l",
        value: "v",
        source: {
          block_number: 0,
          address: "static_config",
          function: "f",
        },
        evidence: "e",
      },
    ],
    rationale: "r [1]",
    missing_facts: [],
    band_hit: { label: "q", max: 500_000_000, score: 82 },
    score: 82,
  },
];

// docA: keys in deliberately weird top-level order, dimensions inner-key
// order also shuffled. JCS must sort all of it before hashing.
const docA: ReasoningDocument = parseReasoningDocument(
  JSON.parse(
    JSON.stringify({
      schema_version: "1.0.0",
      ingest_block: 75_000_000,
      generated_at: "2026-06-09T00:00:00Z",
      grade: { uint8: 2, letter: "A" },
      claude_model: "claude-opus-4-8",
      overall_rationale: "O",
      confidence: 85,
      dimensions: dimensionsForA,
      subject: {
        chain_id: 5000,
        name: "U",
        ticker: "USDY",
        address: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
      },
    }),
  ),
);

// docB: same content, top-level keys in canonical order, inner keys also
// shuffled differently from docA. Result must be byte-identical after JCS.
const docB: ReasoningDocument = parseReasoningDocument(
  JSON.parse(
    JSON.stringify({
      schema_version: "1.0.0",
      subject: {
        name: "U",
        ticker: "USDY",
        address: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
        chain_id: 5000,
      },
      grade: { letter: "A", uint8: 2 },
      confidence: 85,
      dimensions: docA.dimensions,
      overall_rationale: "O",
      generated_at: "2026-06-09T00:00:00Z",
      claude_model: "claude-opus-4-8",
      ingest_block: 75_000_000,
    }),
  ),
);

describe("[2-04-01c] hash determinism (T-2-06 — Phase 4 verifier contract)", () => {
  it("canonicalizeDoc is key-order independent (JCS lex sort at every level)", () => {
    expect(canonicalizeDoc(docA)).toBe(canonicalizeDoc(docB));
  });

  it("computeReasoningHash matches across two structurally-equal docs", () => {
    expect(computeReasoningHash(docA)).toBe(computeReasoningHash(docB));
  });

  it("computeReasoningHash is stable across two consecutive calls", () => {
    const h1 = computeReasoningHash(docA);
    const h2 = computeReasoningHash(docA);
    expect(h1).toBe(h2);
  });

  it("changing ANY field changes the hash (mutation sensitivity)", () => {
    const h1 = computeReasoningHash(docA);
    const mutated = parseReasoningDocument({ ...docA, confidence: 84 });
    const h2 = computeReasoningHash(mutated);
    expect(h1).not.toBe(h2);
  });

  it("re-parsing through zod then re-hashing yields the same hash", () => {
    const h1 = computeReasoningHash(docA);
    const roundTripped = parseReasoningDocument(
      JSON.parse(JSON.stringify(docA)),
    );
    expect(computeReasoningHash(roundTripped)).toBe(h1);
  });
});
