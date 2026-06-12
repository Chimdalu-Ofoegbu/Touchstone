// agent/tests/publish.test.ts
// [3-04-01] publishRatingFor() — the single shared publish pipeline (D-03),
// proven deterministically against injected mocks (no network, no Anthropic, no gas).
//
// Guards (T-03-15 / T-03-16 / D-02):
//   1. writeContract receives [subject, grade, reasoningHash, confidence, cid]
//      with reasoningHash === computeReasoningHash(doc) and cid === the BARE pin
//      cid (not a gateway URL).
//   2. the string handed to pin === canonicalizeDoc(doc) — the pinned bytes ARE
//      the hashed bytes (no re-serialization, no JSON.stringify(doc)).
//   3. the in-pipeline parsed-event assertion throws "diverged" when the on-chain
//      RatingPublished log carries a different hash or cid.

import { describe, it, expect } from "vitest";
import { encodeEventTopics, encodeAbiParameters, getAddress, type Hex } from "viem";
import { publishRatingFor, type PublishDeps } from "../src/publish.js";
import { canonicalizeDoc, computeReasoningHash } from "../src/hash.js";
import { ratingRegistryAbi } from "../src/registry-abi.js";
import { parseReasoningDocument, type ReasoningDocument } from "../src/schema.js";

const REGISTRY = "0xF16d03965E1870Fc3235198468C56dEC65E5606D" as const;
const FAKE_CID = "bafkreifu6wo7sseskorodory3lgsjhgpktimadantvbfkhvy7p4o5rh44u";
const TX_HASH = ("0x" + "ab".repeat(32)) as Hex;

// A valid ReasoningDocument (same shape as tests/ipfs.test.ts).
const doc: ReasoningDocument = parseReasoningDocument({
  schema_version: "1.0.0",
  subject: {
    name: "Ondo U.S. Dollar Yield",
    ticker: "USDY",
    address: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
    chain_id: 5000,
  },
  grade: { letter: "BBB", uint8: 3 },
  confidence: 80,
  dimensions: [
    "collateral_quality",
    "contract_risk",
    "oracle_integrity",
    "liquidity_stability",
  ].map((key) => ({
    key: key as ReasoningDocument["dimensions"][number]["key"],
    score: 70,
    band_hit: { max: 70, score: 70, label: "b" },
    missing_facts: [],
    rationale: "per fact [1] solid",
    citations: [
      {
        id: 1,
        label: "l",
        value: "v",
        source: { address: "static_config", function: "f", block_number: 0 },
        evidence: "e",
      },
    ],
  })),
  overall_rationale: "overall",
  generated_at: "2026-06-11T00:00:00Z",
  claude_model: "claude-opus-4-8",
  ingest_block: 96_506_775,
});

const reasoningHash = computeReasoningHash(doc);

/** Build a real, decodable RatingPublished log (topics + abi-encoded data). */
function ratingPublishedLog(hash: Hex, cid: string) {
  const topics = encodeEventTopics({
    abi: ratingRegistryAbi,
    eventName: "RatingPublished",
    args: { subject: getAddress(doc.subject.address) },
  });
  const data = encodeAbiParameters(
    [
      { type: "uint8" }, // grade
      { type: "bytes32" }, // reasoningHash
      { type: "uint8" }, // confidence
      { type: "uint256" }, // timestamp
      { type: "string" }, // cid
    ],
    [doc.grade.uint8, hash, doc.confidence, 0n, cid],
  );
  return {
    address: REGISTRY,
    topics,
    data,
    blockHash: ("0x" + "00".repeat(32)) as Hex,
    blockNumber: 1n,
    logIndex: 0,
    transactionHash: TX_HASH,
    transactionIndex: 0,
    removed: false,
  };
}

type Captured = { pinInput?: string; writeArgs?: { args: readonly unknown[]; functionName: string } };

/** Assemble injected deps + a capture sink. The receipt log carries `logHash`/`logCid`. */
function makeDeps(logHash: Hex, logCid: string): { deps: PublishDeps; captured: Captured } {
  const captured: Captured = {};
  const deps = {
    rate: async () => ({ doc, reasoningHash }),
    pin: async (canonical: string) => {
      captured.pinInput = canonical;
      return FAKE_CID;
    },
    walletClient: {
      writeContract: async (args: { args: readonly unknown[]; functionName: string }) => {
        captured.writeArgs = args;
        return TX_HASH;
      },
    },
    publicClient: {
      waitForTransactionReceipt: async (_: { hash: Hex }) => ({
        logs: [ratingPublishedLog(logHash, logCid)],
      }),
    },
    registry: REGISTRY,
  } as unknown as PublishDeps;
  return { deps, captured };
}

describe("[3-04-01] publishRatingFor — shared pipeline, mock path", () => {
  it("sends the engine hash + bare pin cid in one publishRating tx, and pins the EXACT canonical bytes", async () => {
    const { deps, captured } = makeDeps(reasoningHash, FAKE_CID);
    const result = await publishRatingFor("USDY", deps);

    // pinned bytes === hashed bytes (no re-serialization) — checker warning #2 / Pitfall 1
    expect(captured.pinInput).toBe(canonicalizeDoc(doc));

    const a = captured.writeArgs!;
    expect(a.functionName).toBe("publishRating");
    expect(a.args[0]).toBe(getAddress(doc.subject.address)); // subject (normalized EIP-55)
    expect(a.args[1]).toBe(doc.grade.uint8); // grade
    expect(a.args[2]).toBe(computeReasoningHash(doc)); // reasoningHash
    expect(a.args[3]).toBe(doc.confidence); // confidence
    expect(a.args[4]).toBe(FAKE_CID); // cid — BARE, not a gateway URL

    expect(result).toEqual({ cid: FAKE_CID, reasoningHash, txHash: TX_HASH });
  });

  it("throws 'diverged' when the on-chain log carries a DIFFERENT reasoningHash", async () => {
    const wrongHash = ("0x" + "de".repeat(32)) as Hex;
    const { deps } = makeDeps(wrongHash, FAKE_CID);
    await expect(publishRatingFor("USDY", deps)).rejects.toThrow(/diverged/);
  });

  it("throws 'diverged' when the on-chain log carries a DIFFERENT cid", async () => {
    const { deps } = makeDeps(reasoningHash, "bafyDIFFERENTcid");
    await expect(publishRatingFor("USDY", deps)).rejects.toThrow(/diverged/);
  });
});
