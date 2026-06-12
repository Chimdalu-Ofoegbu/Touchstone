// agent/tests/publish.live.test.ts
// [3-04-02] RUN_LIVE anvil-fork END-TO-END: run the REAL publishRatingFor
// pipeline against a Mantle Mainnet fork, then read latestRating(subject) back
// and prove the struct + the re-hash binding (ROADMAP SC-3) — WITHOUT a live
// Mainnet tx, without Anthropic spend (injected deterministic doc), and without
// an IPFS dependency (deterministic stub pin asserted to receive the canonical
// bytes). The on-chain identity gate is REAL on the fork: the agent EOA owns
// token 114 in the forked state, so publishRating passes.
//
// This file is EXCLUDED from the default suite by the vitest config
// (exclude: tests/**/*.live.test.ts) AND skipped unless RUN_LIVE. Run it with a
// Mantle fork on :8545:
//   anvil --fork-url https://rpc.mantle.xyz --chain-id 5000
//   cd agent && pnpm test:fork
// Requires the root .env (loaded by vitest.live.config.ts): PRIVATE_KEY (the
// agent that owns token 114) + RATING_REGISTRY_ADDRESS (the deployed contract,
// present on the fork).

import { describe, it, expect } from "vitest";
import {
  createWalletClient,
  createPublicClient,
  http,
  getAddress,
  keccak256,
  toBytes,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantle } from "viem/chains";
import { publishRatingFor, type PublishDeps } from "../src/publish.js";
import { canonicalizeDoc, computeReasoningHash } from "../src/hash.js";
import { ratingRegistryAbi } from "../src/registry-abi.js";
import {
  parseReasoningDocument,
  type ReasoningDocument,
} from "../src/schema.js";

const ANVIL = "http://127.0.0.1:8545";
const SUBJECT = getAddress("0x5bE26527e817998A7206475496fDE1E68957c5A6"); // USDY (canonical EIP-55)

const doc: ReasoningDocument = parseReasoningDocument({
  schema_version: "1.0.0",
  subject: { name: "Ondo U.S. Dollar Yield", ticker: "USDY", address: SUBJECT, chain_id: 5000 },
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

describe("[3-04-02] anvil-fork end-to-end publish + read-back (RUN_LIVE)", () => {
  it.skipIf(!process.env.RUN_LIVE)(
    "publishRatingFor writes; latestRating returns the struct; canonical bytes re-hash to the on-chain reasoningHash",
    async () => {
      const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
      const registry = process.env.RATING_REGISTRY_ADDRESS as Hex;
      const transport = http(ANVIL);
      const walletClient = createWalletClient({ account, chain: mantle, transport });
      const publicClient = createPublicClient({ chain: mantle, transport });

      const reasoningHash = computeReasoningHash(doc);
      const canonical = canonicalizeDoc(doc);
      const FIXED_CID = "bafkreifu6wo7sseskorodory3lgsjhgpktimadantvbfkhvy7p4o5rh44u";

      const deps: PublishDeps = {
        rate: async () => ({ doc, reasoningHash }),
        pin: async (c) => {
          // the pipeline must pin the EXACT canonical (hashed) bytes
          expect(c).toBe(canonical);
          return FIXED_CID;
        },
        walletClient: walletClient as unknown as PublishDeps["walletClient"],
        publicClient: publicClient as unknown as PublishDeps["publicClient"],
        registry,
      };

      const result = await publishRatingFor("USDY", deps);
      expect(result.reasoningHash).toBe(reasoningHash);
      expect(result.cid).toBe(FIXED_CID);

      // Read the FULL struct back from the forked contract (ROADMAP SC-3).
      const latest = await publicClient.readContract({
        address: registry,
        abi: ratingRegistryAbi,
        functionName: "latestRating",
        args: [SUBJECT],
      });
      expect(latest.reasoningHash).toBe(reasoningHash);
      expect(latest.cid).toBe(FIXED_CID);
      expect(latest.grade).toBe(doc.grade.uint8);
      expect(getAddress(latest.subject)).toBe(SUBJECT);

      // Hash binding: re-hashing the canonical bytes reproduces the on-chain hash.
      expect(keccak256(toBytes(canonical))).toBe(latest.reasoningHash);
    },
    120_000,
  );
});
