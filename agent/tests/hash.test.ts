// agent/tests/hash.test.ts
// [2-04-01a/b] Shape + landmine regression tests for the hash module.
// Per RESEARCH §5 + §8 landmines table. Covers canonicalize output shape,
// keccak256 0x+64-hex format, and the BigInt regression (zod is the
// gatekeeper; canonicalize must throw if BigInt slips through).

import { describe, it, expect } from "vitest";
import { canonicalizeDoc, computeReasoningHash } from "../src/hash.js";
import {
  parseReasoningDocument,
  type ReasoningDocument,
} from "../src/schema.js";

const baseDoc: ReasoningDocument = parseReasoningDocument({
  schema_version: "1.0.0",
  subject: {
    name: "U",
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
      band_hit: { max: 70, score: 72, label: "x" },
      missing_facts: [],
      rationale: "r [1]",
      citations: [
        {
          id: 1,
          label: "l",
          value: "v",
          source: {
            address: "static_config",
            function: "f",
            block_number: 0,
          },
          evidence: "e",
        },
      ],
    },
    {
      key: "contract_risk",
      score: 72,
      band_hit: { max: 70, score: 72, label: "y" },
      missing_facts: [],
      rationale: "r [1]",
      citations: [
        {
          id: 1,
          label: "l",
          value: "v",
          source: {
            address: "static_config",
            function: "f",
            block_number: 0,
          },
          evidence: "e",
        },
      ],
    },
    {
      key: "oracle_integrity",
      score: 55,
      band_hit: { max: 50, score: 55, label: "z" },
      missing_facts: [],
      rationale: "r [1]",
      citations: [
        {
          id: 1,
          label: "l",
          value: "v",
          source: {
            address: "static_config",
            function: "f",
            block_number: 0,
          },
          evidence: "e",
        },
      ],
    },
    {
      key: "liquidity_stability",
      score: 82,
      band_hit: { max: 500_000_000, score: 82, label: "q" },
      missing_facts: [],
      rationale: "r [1]",
      citations: [
        {
          id: 1,
          label: "l",
          value: "v",
          source: {
            address: "static_config",
            function: "f",
            block_number: 0,
          },
          evidence: "e",
        },
      ],
    },
  ],
  overall_rationale: "O",
  generated_at: "2026-06-09T00:00:00Z",
  claude_model: "claude-opus-4-8",
  ingest_block: 75_000_000,
});

describe("[2-04-01a] canonicalizeDoc — RFC 8785 JCS shape", () => {
  it("produces a string with no insignificant whitespace at top level", () => {
    const s = canonicalizeDoc(baseDoc);
    // JCS: no space after structural ':' or ',' outside string values.
    // Proxy check: the canonical form never contains `": "` or `", "`.
    expect(s.includes('": "')).toBe(false);
    expect(s.includes('", "')).toBe(false);
  });

  it("computeReasoningHash returns 0x + 64 hex chars (Solidity bytes32-ready)", () => {
    const h = computeReasoningHash(baseDoc);
    expect(h.startsWith("0x")).toBe(true);
    expect(h.length).toBe(66);
    expect(/^0x[0-9a-f]{64}$/.test(h)).toBe(true);
  });

  it("canonicalize sorts keys lexicographically at every level (JCS contract)", () => {
    // Compare two docs with deliberately different key orders — JCS must
    // emit byte-identical canonical strings.
    const a = canonicalizeDoc(
      parseReasoningDocument({
        ...baseDoc,
        subject: {
          chain_id: 5000,
          name: "U",
          ticker: "USDY",
          address: "0x5be26527e817998A7206475496fDE1E68957c5A6",
        },
      }),
    );
    const b = canonicalizeDoc(
      parseReasoningDocument({
        ...baseDoc,
        subject: {
          name: "U",
          ticker: "USDY",
          chain_id: 5000,
          address: "0x5be26527e817998A7206475496fDE1E68957c5A6",
        },
      }),
    );
    expect(a).toBe(b);
  });
});

describe("[2-04-01b] BigInt + landmine regressions (RESEARCH §8)", () => {
  it("throws if a BigInt sneaks into the doc", () => {
    // Bypass zod by casting — simulates an upstream bug.
    const corrupt = {
      ...baseDoc,
      ingest_block: 75_000_000n as unknown as number,
    };
    expect(() =>
      canonicalizeDoc(corrupt as unknown as ReasoningDocument),
    ).toThrow();
  });

  it("zod parse rejects non-integer confidence (50.5) — gatekeeper before hashing", () => {
    expect(() =>
      parseReasoningDocument({ ...baseDoc, confidence: 50.5 }),
    ).toThrow();
  });

  it("computeReasoningHash is stable across consecutive calls on the same doc", () => {
    const h1 = computeReasoningHash(baseDoc);
    const h2 = computeReasoningHash(baseDoc);
    expect(h1).toBe(h2);
  });
});
