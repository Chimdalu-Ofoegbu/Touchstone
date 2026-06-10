// agent/tests/ipfs.test.ts
// [3-02-02] pin() byte-exactness + the isolated pin->fetch-by-CID->re-hash
// round-trip — the D-02 silent-failure guard, proven BEFORE Plan 04 wires
// pin into the publish pipeline.
//
// Two checks:
//   1. DEFAULT (hermetic, no network): a fake Pinata uploader captures the
//      Blob it receives; the test asserts the uploaded bytes === canonicalizeDoc(doc)
//      (NOT JSON.stringify(doc)) — Pitfall 1 / T-03-05. pin() returns the
//      fake provider's cid unchanged.
//   2. RUN_LIVE-gated standalone round-trip (skipped unless process.env.RUN_LIVE):
//      real pin -> fetch {gateway}/ipfs/{cid} -> assert fetched bytes === canonical
//      (proves RAW-file/direct-CID resolution, NOT a directory listing — T-03-25)
//      AND keccak256(toBytes(fetched)) === computeReasoningHash(doc) (the on-chain
//      hash binding — Assumption A2). Run with: RUN_LIVE=1 pnpm test ipfs.

import { describe, it, expect } from "vitest";
import { keccak256, toBytes } from "viem";
import { pin, __setUploaderForTest, __resetUploaderForTest } from "../src/ipfs.js";
import { canonicalizeDoc, computeReasoningHash } from "../src/hash.js";
import {
  parseReasoningDocument,
  type ReasoningDocument,
} from "../src/schema.js";

// A small valid ReasoningDocument (same shape as tests/hash.test.ts baseDoc).
const doc: ReasoningDocument = parseReasoningDocument({
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
      band_hit: { max: 70, score: 72, label: "x" },
      missing_facts: [],
      rationale: "r [1]",
      citations: [
        {
          id: 1,
          label: "l",
          value: "v",
          source: { address: "static_config", function: "f", block_number: 0 },
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
          source: { address: "static_config", function: "f", block_number: 0 },
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
          source: { address: "static_config", function: "f", block_number: 0 },
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
          source: { address: "static_config", function: "f", block_number: 0 },
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

describe("[3-02-02] pin() byte-exact mock round-trip (Pitfall 1 / T-03-05)", () => {
  it("uploads the EXACT canonicalizeDoc(doc) bytes — never JSON.stringify(doc)", async () => {
    const canonical = canonicalizeDoc(doc);
    // Sanity: canonical (JCS) differs from a plain stringify, so a byte-exact
    // pass proves we pinned the hashed bytes, not a re-serialization.
    expect(canonical).not.toBe(JSON.stringify(doc));

    let capturedBytes: string | undefined;
    __setUploaderForTest(async (blob: Blob) => {
      capturedBytes = await blob.text();
      return { cid: "bafyTESTcidFromFakeProvider" };
    });

    try {
      const cid = await pin(canonical);
      // The bytes handed to the (mocked) upload call equal the hashed bytes.
      expect(capturedBytes).toBe(canonical);
      // pin returns the provider's cid unchanged (bare CID).
      expect(cid).toBe("bafyTESTcidFromFakeProvider");
    } finally {
      __resetUploaderForTest();
    }
  });

  it("passes a Blob (not a string/object) so Pinata gets a RAW file", async () => {
    const canonical = canonicalizeDoc(doc);
    let sawBlob = false;
    __setUploaderForTest(async (blob: Blob) => {
      sawBlob = blob instanceof Blob;
      return { cid: "bafyRAW" };
    });
    try {
      await pin(canonical);
      expect(sawBlob).toBe(true);
    } finally {
      __resetUploaderForTest();
    }
  });
});

describe("[3-02-02] isolated pin->gateway-fetch-by-CID->re-hash round-trip (RUN_LIVE — Assumption A2 / T-03-25)", () => {
  // Gated: stays hermetic unless RUN_LIVE is set, so the default suite never
  // hits the network or needs PINATA_JWT. Run: RUN_LIVE=1 pnpm test ipfs.
  it.skipIf(!process.env.RUN_LIVE)(
    "real pin -> fetch {gateway}/ipfs/{cid} -> bytes===canonical AND keccak256===reasoningHash",
    async () => {
      const canonical = canonicalizeDoc(doc);
      const cid = await pin(canonical); // REAL Pinata upload (raw-file CID)

      const gateway = process.env.PINATA_GATEWAY ?? "gateway.pinata.cloud";
      const url = `https://${gateway}/ipfs/${cid}`;
      const res = await fetch(url);
      expect(res.ok).toBe(true);
      const fetchedText = await res.text();

      // (a) direct-CID resolution: the bare CID returns the EXACT JSON bytes,
      // NOT a directory listing (proves no directory wrap — T-03-25).
      expect(fetchedText).toBe(canonical);

      // (b) on-chain hash binding: re-hashing the fetched bytes reproduces
      // the reasoningHash the contract will store (Assumption A2).
      expect(keccak256(toBytes(fetchedText))).toBe(computeReasoningHash(doc));
    },
    60_000,
  );
});
