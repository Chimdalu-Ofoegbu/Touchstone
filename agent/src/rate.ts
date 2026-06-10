// agent/src/rate.ts
// Wave 4 orchestrator: rate(SubjectId, RateOptions?) returns
// { doc, reasoningHash, outPath? }. This is the locked Phase 3 import
// surface — Phase 3's RatingRequested listener will import rate() to
// drive the off-chain pipeline.
//
// Pipeline:
//   getAdapter(id)(blockNumber)
//     -> SubjectFacts
//     -> 4 deterministic dimension scorers (scoreCollateral / scoreContractRisk
//        / scoreOracleIntegrity / scoreLiquidityStability)
//     -> synthesize() (uniform 25% combine + GRADE_SCORE_TABLE + confidence floor)
//     -> synthesizeRating() (single-shot Claude with forced submit_rating tool)
//     -> validateCitations() (T-2-07 defense-in-depth — every citation
//        source.address must be in SubjectFacts or "static_config")
//     -> computeReasoningHash() (RFC 8785 JCS + viem.keccak256)
//     -> (optional) write canonical bytes to agent/out/{subject}/{block}.json
//
// Engine-side overrides (Wave 3): generated_at / claude_model / ingest_block
// (T-2-06) plus grade / confidence (defense-in-depth) are pinned by the
// engine, never by Claude. See agent/src/claude/synthesize.ts for the
// override discipline.
//
// --mock mode injects a deterministic Claude mock (single hand-authored
// tool_use payload via fixtureToolUseResponse) and a fixed block timestamp
// so the hash is reproducible without any network calls. Used by the CLI
// smoke test and Phase 2 integration tests.
//
// CLAUDE.md absent — Phase 2 binds only the PROJECT.md / CONTEXT.md /
// RESEARCH.md / PATTERNS.md constraints. The deterministic-vs-LLM seam
// (CON-deterministic-vs-llm-separation) is preserved: rate() composes
// the deterministic adapters + scorers + synthesize, calls the LLM step
// exactly ONCE via synthesizeRating, then runs the post-hoc citation
// check + canonicalize+hash chain — all of which are deterministic.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SubjectId, SubjectFacts } from "./subjects/types.js";
import { getAdapter } from "./subjects/registry.js";
import { scoreCollateral } from "./dimensions/collateral-quality.js";
import { scoreContractRisk } from "./dimensions/contract-risk.js";
import { scoreOracleIntegrity } from "./dimensions/oracle-integrity.js";
import { scoreLiquidityStability } from "./dimensions/liquidity-stability.js";
import { synthesize } from "./dimensions/synthesize.js";
import {
  synthesizeRating,
  type AnthropicClientLike,
} from "./claude/synthesize.js";
import { computeReasoningHash, canonicalizeDoc } from "./hash.js";
import { parseReasoningDocument, type ReasoningDocument } from "./schema.js";
import { publicClient, redactRpcError } from "./rpc.js";
// W2 fix: import from production-safe src location (no test-framework deps).
// tests/helpers/mock-anthropic.ts re-exports from this file for backward compat.
import { fixtureToolUseResponse, mockAnthropicClient } from "./claude/mock.js";

export type RateOptions = {
  blockNumber?: bigint;
  /**
   * Injects a deterministic Claude mock + a fixed block timestamp so the
   * hash is reproducible without any network calls. Used by the CLI smoke
   * test and Phase 2 integration tests.
   */
  mock?: boolean;
  /** CLI sets true; library callers default to false. */
  writeToFs?: boolean;
  /** Override the on-disk output directory (test injection). */
  outDir?: string;
  /** Inject a custom Anthropic client (overrides --mock if both provided). */
  client?: AnthropicClientLike;
};

export type RateResult = {
  doc: ReasoningDocument;
  reasoningHash: `0x${string}`;
  outPath?: string;
};

/**
 * T-2-07 mitigation: every citation must point at an address that appears
 * in the ingested SubjectFacts OR is the "static_config" sentinel. Claude
 * is instructed not to fabricate addresses in the system prompt; this
 * check is the defense-in-depth post-hoc validator.
 *
 * Throws if a fabricated address is found. The error includes the dimension
 * key, citation id, and offending address so the caller can log a precise
 * failure mode.
 */
export function validateCitations(
  doc: ReasoningDocument,
  facts: SubjectFacts,
): void {
  const allowedAddresses = new Set<string>(["static_config"]);
  for (const bucket of [
    facts.collateral,
    facts.contract,
    facts.oracle,
    facts.liquidity,
  ]) {
    for (const f of bucket) {
      if (f.source.kind === "onchain") {
        allowedAddresses.add(f.source.address.toLowerCase());
      }
      if (f.source.kind === "static") {
        allowedAddresses.add("static_config");
      }
    }
  }
  for (const dim of doc.dimensions) {
    for (const c of dim.citations) {
      const addr =
        c.source.address === "static_config"
          ? "static_config"
          : c.source.address.toLowerCase();
      if (!allowedAddresses.has(addr)) {
        throw new Error(
          "fabricated address in citation (T-2-07): dim=" +
            dim.key +
            " cite=[" +
            String(c.id) +
            "] addr=" +
            c.source.address,
        );
      }
    }
  }
}

/**
 * Resolve the unix-seconds timestamp for the ingest block. In --mock mode,
 * pin to a deterministic value so the hash is reproducible without a live
 * RPC call. In live mode, fetch the EXACT ingest block via viem and read its
 * timestamp.
 *
 * CR-04: the caller MUST pass the concrete ingest block (facts.ingestBlock),
 * not undefined. Reading `getBlock({})` (latest) here would sample a second,
 * independent chain-head snapshot for generated_at — racing the fact reads and
 * making the rating non-reproducible. Pinning to the ingest block ties
 * generated_at to the same state the dimensions were scored from.
 */
async function getBlockTimestampSeconds(
  blockNumber: bigint,
  mock: boolean,
): Promise<number> {
  if (mock) return 1_717_804_800; // 2024-06-08T00:00:00Z — fixed for hash determinism in --mock
  // CR-03 / T-2-03: scrub the keyed RPC URL from any transport error.
  let block;
  try {
    block = await publicClient.getBlock({ blockNumber });
  } catch (e) {
    throw redactRpcError(e);
  }
  return Number(block.timestamp);
}

/**
 * Build a deterministic mock Anthropic client for --mock mode. The mock
 * returns ONE hand-authored tool_use payload shaped to match the locked
 * ReasoningDocument schema, with engine-overrideable fields deliberately
 * wrong so the override discipline (Wave 3) is observable.
 */
function buildMockClient(
  detLetter: ReasoningDocument["grade"]["letter"],
  detU8: number,
  detConfidence: number,
  ticker: SubjectId,
  address: `0x${string}`,
): AnthropicClientLike {
  const args = {
    schema_version: "1.0.0" as const,
    subject: { name: ticker, ticker, address, chain_id: 5000 as const },
    grade: { letter: detLetter, uint8: detU8 },
    confidence: detConfidence,
    dimensions: [
      "collateral_quality",
      "contract_risk",
      "oracle_integrity",
      "liquidity_stability",
    ].map((key) => ({
      key: key as
        | "collateral_quality"
        | "contract_risk"
        | "oracle_integrity"
        | "liquidity_stability",
      score: 70,
      band_hit: { max: 70, score: 70, label: "mock band" },
      missing_facts: [],
      rationale:
        "Per fact [1] the indicator is solid; per fact [2] this is corroborated.",
      citations: [
        {
          id: 1,
          label: "static a",
          value: "v1",
          source: {
            address: "static_config",
            function: "static.ts@1.0.0",
            block_number: 0,
          },
          evidence: "e1",
        },
        {
          id: 2,
          label: "static b",
          value: "v2",
          source: {
            address: "static_config",
            function: "static.ts@1.0.0",
            block_number: 0,
          },
          evidence: "e2",
        },
      ],
    })),
    overall_rationale:
      "Mock overall rationale across all four dimensions for " + ticker + ".",
  };
  return mockAnthropicClient([
    { kind: "ok", response: fixtureToolUseResponse(args) },
  ]);
}

/**
 * Pipeline orchestrator. Returns the full ReasoningDocument plus the
 * 0x+64hex bytes32-ready reasoningHash. If `writeToFs` is true, writes
 * the canonical bytes (no trailing newline) to
 * `<outDir or agent/out/<ticker>>/<ingest_block>.json` and returns the
 * path in `outPath`.
 *
 * The on-disk bytes ARE the canonical bytes — Phase 4 can re-canonicalize
 * the JSON.parse'd document and reproduce the hash exactly. Trailing
 * newlines from file-write are NOT added.
 */
export async function rate(
  subject: SubjectId,
  opts: RateOptions = {},
): Promise<RateResult> {
  const adapter = getAdapter(subject);
  const facts = await adapter(opts.blockNumber);

  // Deterministic 4-dimension score + uniform 25% combine + grade + confidence.
  const collateral = scoreCollateral(facts);
  const contract = scoreContractRisk(facts);
  const oracle = scoreOracleIntegrity(facts);
  const liquidity = scoreLiquidityStability(facts);
  const det = synthesize({ collateral, contract, oracle, liquidity });

  // CR-04: pin generated_at to the SAME block the adapter resolved + read
  // (facts.ingestBlock), not a fresh `latest`. After CR-02 facts.ingestBlock
  // is always a concrete resolved block.
  const blockTimestampSeconds = await getBlockTimestampSeconds(
    BigInt(facts.ingestBlock),
    !!opts.mock,
  );

  // Client precedence: explicit opts.client > --mock mock > live Anthropic default
  const client =
    opts.client ??
    (opts.mock
      ? buildMockClient(
          det.letter,
          det.uint8,
          det.confidence,
          subject,
          facts.subject.address,
        )
      : undefined);

  const doc = await synthesizeRating({
    subject: facts,
    scores: { collateral, contract, oracle, liquidity },
    missingFacts: [
      ...collateral.missing_facts,
      ...contract.missing_facts,
      ...oracle.missing_facts,
      ...liquidity.missing_facts,
    ],
    preComputedGrade: { letter: det.letter, uint8: det.uint8 },
    preComputedConfidence: det.confidence,
    blockTimestampSeconds,
    client,
  });

  // T-2-07: post-hoc — Claude MUST NOT cite an address it invented.
  validateCitations(doc, facts);

  const reasoningHash = computeReasoningHash(doc);

  let outPath: string | undefined;
  if (opts.writeToFs) {
    // Default output dir: <cwd>/out/<SUBJECT>/. The CLI is launched from
    // inside agent/ (per `pnpm rate` script), so the on-disk path is
    // agent/out/<SUBJECT>/<block>.json — matching the README documented path.
    // Tests inject `outDir` to control the location precisely.
    const dir = opts.outDir ?? resolve(process.cwd(), "out", subject);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    outPath = resolve(dir, String(doc.ingest_block) + ".json");
    // Write the canonical string so the on-disk bytes match what was hashed.
    // No trailing newline — the bytes ARE the canonical form.
    writeFileSync(outPath, canonicalizeDoc(doc), { encoding: "utf8" });
  }

  // Final defensive parse — proves doc is schema-valid post-validation.
  parseReasoningDocument(doc);
  return { doc, reasoningHash, outPath };
}
