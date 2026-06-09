// agent/tests/goldens/usdy.golden.test.ts
// [2-04-03 USDY] End-to-end pipeline golden test:
//   adapter (mocked multicall) -> 4 dimension scorers -> synthesize ->
//   synthesizeRating (mocked Claude) -> computeReasoningHash.
//
// Asserts:
//   - ReasoningDocument is schema-valid
//   - subject.ticker matches USDY
//   - every dimension's rationale contains an [N] citation marker
//   - hash format 0x + 64 hex
//   - hash determinism (T-2-06): re-running the same pipeline twice
//     produces a BYTE-IDENTICAL hash.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { usdyMulticallSuccess } from "../fixtures/usdy.fixture.js";

vi.mock("../../src/multicall.js", () => ({ multiread: vi.fn() }));
import { multiread } from "../../src/multicall.js";

import { fetchUsdy } from "../../src/subjects/usdy.js";
import { scoreCollateral } from "../../src/dimensions/collateral-quality.js";
import { scoreContractRisk } from "../../src/dimensions/contract-risk.js";
import { scoreOracleIntegrity } from "../../src/dimensions/oracle-integrity.js";
import { scoreLiquidityStability } from "../../src/dimensions/liquidity-stability.js";
import { synthesize } from "../../src/dimensions/synthesize.js";
import { synthesizeRating } from "../../src/claude/synthesize.js";
import { computeReasoningHash } from "../../src/hash.js";
import { parseReasoningDocument } from "../../src/schema.js";
import type { GradeLetter } from "../../src/constants/grade-enum.js";
import {
  mockAnthropicClient,
  fixtureToolUseResponse,
} from "../helpers/mock-anthropic.js";

function makeClient(
  ticker: "USDY" | "cmETH" | "FBTC",
  letter: GradeLetter,
  uint8: number,
) {
  const args = {
    schema_version: "1.0.0" as const,
    subject: {
      name: ticker,
      ticker,
      address: "0x5be26527e817998A7206475496fDE1E68957c5A6" as `0x${string}`,
      chain_id: 5000 as const,
    },
    grade: { letter, uint8 },
    confidence: 90,
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
      score: 72,
      band_hit: { max: 70, score: 72, label: "x" },
      missing_facts: [],
      rationale: "Per fact [1] the indicator is solid and per fact [2] confirms.",
      citations: [
        {
          id: 1,
          label: "l1",
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
          label: "l2",
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
      "Overall solid across all four dimensions for " + ticker + ".",
  };
  return mockAnthropicClient([
    { kind: "ok", response: fixtureToolUseResponse(args) },
  ]);
}

describe("[2-04-03 USDY] golden ReasoningDocument", () => {
  beforeEach(() => {
    vi.mocked(multiread).mockReset();
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
  });

  async function runPipeline() {
    const facts = await fetchUsdy(75_000_000n);
    const collateral = scoreCollateral(facts);
    const contract = scoreContractRisk(facts);
    const oracle = scoreOracleIntegrity(facts);
    const liquidity = scoreLiquidityStability(facts);
    const detSyn = synthesize({ collateral, contract, oracle, liquidity });
    const doc = await synthesizeRating({
      subject: facts,
      scores: { collateral, contract, oracle, liquidity },
      missingFacts: [
        ...collateral.missing_facts,
        ...contract.missing_facts,
        ...oracle.missing_facts,
        ...liquidity.missing_facts,
      ],
      preComputedGrade: { letter: detSyn.letter, uint8: detSyn.uint8 },
      preComputedConfidence: detSyn.confidence,
      blockTimestampSeconds: 1_717_804_800,
      client: makeClient("USDY", detSyn.letter, detSyn.uint8),
    });
    return { doc, hash: computeReasoningHash(doc) };
  }

  it("produces a schema-valid ReasoningDocument with hash format 0x+64 hex", async () => {
    const { doc, hash } = await runPipeline();
    expect(() => parseReasoningDocument(doc)).not.toThrow();
    expect(doc.subject.ticker).toBe("USDY");
    expect(/^0x[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("every dimension has at least one [N] citation marker in rationale", async () => {
    const { doc } = await runPipeline();
    for (const dim of doc.dimensions) {
      expect(dim.rationale).toMatch(/\[\d+\]/);
    }
  });

  it("hash determinism: same fixtures + same mock -> byte-identical hash (T-2-06)", async () => {
    const a = await runPipeline();
    const b = await runPipeline();
    expect(a.hash).toBe(b.hash);
  });

  it("ingest_block, claude_model, generated_at are engine-overridden (T-2-06)", async () => {
    const { doc } = await runPipeline();
    expect(doc.ingest_block).toBe(75_000_000);
    expect(doc.claude_model).toBe(
      process.env.CLAUDE_MODEL ?? "claude-opus-4-8",
    );
    // 1_717_804_800 unix seconds = 2024-06-08T00:00:00Z (a real ISO 8601 second-precision string)
    expect(doc.generated_at).toBe("2024-06-08T00:00:00Z");
  });
});
