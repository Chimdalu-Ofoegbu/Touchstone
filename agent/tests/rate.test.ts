// agent/tests/rate.test.ts
// [2-05-01] Pipeline integration test for rate() orchestrator.
//
// Asserts (REQ-01 + REQ-05):
//   - rate(SubjectId, { mock: true, blockNumber }) returns { doc, reasoningHash }
//     for all three locked subjects
//   - hash format 0x + 64 lowercase hex
//   - two consecutive runs at same block produce byte-identical hash (T-2-06)
//   - validateCitations throws on a fabricated address (T-2-07)
//   - validateCitations accepts addresses present in SubjectFacts (case-insensitive)
//   - writeToFs writes the canonical string whose hash matches result.reasoningHash

import { describe, it, expect, vi, beforeEach } from "vitest";
import { rate, validateCitations } from "../src/rate.js";
import { parseReasoningDocument } from "../src/schema.js";
import { usdyMulticallSuccess } from "./fixtures/usdy.fixture.js";
import { cmethMulticallSuccess } from "./fixtures/cmeth.fixture.js";
import { fbtcMulticallSuccess } from "./fixtures/fbtc.fixture.js";

vi.mock("../src/multicall.js", () => ({ multiread: vi.fn() }));
import { multiread } from "../src/multicall.js";

// Stub live upgrade-authority resolution with a fixed Gnosis Safe so rate()
// runs hermetically; authorityToOwnerFact stays real via importOriginal.
vi.mock("../src/admin.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/admin.js")>()),
  resolveUpgradeAuthority: vi.fn(async () => ({
    address: "0xC8A7870fFe41054612F7f3433E173D8b5bFcA8E3",
    kind: "safe" as const,
    threshold: 4,
    ownerCount: 7,
    label: "Gnosis Safe 4-of-7 multisig",
    via: "owner()",
  })),
}));

describe("[2-05-01a] rate() orchestrator — happy path", () => {
  beforeEach(() => {
    vi.mocked(multiread).mockReset();
  });

  it.each([
    ["USDY", () => usdyMulticallSuccess],
    ["cmETH", () => cmethMulticallSuccess],
    ["FBTC", () => fbtcMulticallSuccess],
  ] as const)(
    "rate(%s) returns valid doc + 0x66-char hash",
    async (subject, fixture) => {
      vi.mocked(multiread).mockResolvedValue(fixture());
      const result = await rate(subject, {
        mock: true,
        blockNumber: 75_000_000n,
      });
      expect(() => parseReasoningDocument(result.doc)).not.toThrow();
      expect(result.doc.subject.ticker).toBe(subject);
      expect(result.doc.ingest_block).toBe(75_000_000);
      expect(/^0x[0-9a-f]{64}$/.test(result.reasoningHash)).toBe(true);
    },
  );

  it("two consecutive runs at same block produce byte-identical hash (T-2-06)", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    const a = await rate("USDY", { mock: true, blockNumber: 75_000_000n });
    const b = await rate("USDY", { mock: true, blockNumber: 75_000_000n });
    expect(a.reasoningHash).toBe(b.reasoningHash);
  });
});

describe("[2-05-01b] validateCitations — T-2-07 post-hoc fabrication check", () => {
  it("throws when a citation references an address not in SubjectFacts", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facts: any = {
      subject: {
        name: "u",
        ticker: "USDY",
        address: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
        chainId: 5000,
      },
      ingestBlock: 0,
      collateral: [],
      contract: [],
      oracle: [],
      liquidity: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = {
      schema_version: "1.0.0",
      subject: {
        name: "u",
        ticker: "USDY",
        address: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
        chain_id: 5000,
      },
      grade: { letter: "A", uint8: 2 },
      confidence: 80,
      dimensions: [
        {
          key: "collateral_quality",
          score: 70,
          band_hit: { max: 70, score: 70, label: "x" },
          missing_facts: [],
          rationale: "r [1]",
          citations: [
            {
              id: 1,
              label: "fab",
              value: "v",
              source: {
                address: "0xdEadBeefdEadBeEfDeadBEefDEadBeefDeAdbEef",
                function: "f",
                block_number: 0,
              },
              evidence: "e",
            },
          ],
        },
        {
          key: "contract_risk",
          score: 70,
          band_hit: { max: 70, score: 70, label: "x" },
          missing_facts: [],
          rationale: "r [1]",
          citations: [
            {
              id: 1,
              label: "static",
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
          score: 70,
          band_hit: { max: 70, score: 70, label: "x" },
          missing_facts: [],
          rationale: "r [1]",
          citations: [
            {
              id: 1,
              label: "static",
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
          score: 70,
          band_hit: { max: 70, score: 70, label: "x" },
          missing_facts: [],
          rationale: "r [1]",
          citations: [
            {
              id: 1,
              label: "static",
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
      overall_rationale: "x",
      generated_at: "2026-06-09T00:00:00Z",
      claude_model: "claude-opus-4-8",
      ingest_block: 0,
    };
    expect(() => validateCitations(doc, facts)).toThrow(/fabricated address/);
  });

  it("accepts citations pointing at addresses present in SubjectFacts (case-insensitive)", () => {
    const addr =
      "0x5bE26527e817998A7206475496fDE1E68957c5A6" as `0x${string}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facts: any = {
      subject: {
        name: "u",
        ticker: "USDY",
        address: addr,
        chainId: 5000,
      },
      ingestBlock: 0,
      collateral: [
        {
          label: "l",
          value: "v",
          evidence: "e",
          source: {
            kind: "onchain",
            address: addr,
            function: "f",
            blockNumber: 0,
          },
        },
      ],
      contract: [],
      oracle: [],
      liquidity: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = {
      schema_version: "1.0.0",
      subject: {
        name: "u",
        ticker: "USDY",
        address: addr,
        chain_id: 5000,
      },
      grade: { letter: "A", uint8: 2 },
      confidence: 80,
      dimensions: [
        "collateral_quality",
        "contract_risk",
        "oracle_integrity",
        "liquidity_stability",
      ].map((k) => ({
        key: k,
        score: 70,
        band_hit: { max: 70, score: 70, label: "x" },
        missing_facts: [],
        rationale: "r [1]",
        citations: [
          {
            id: 1,
            label: "l",
            value: "v",
            source: {
              address:
                k === "collateral_quality" ? addr.toLowerCase() : "static_config",
              function: "f",
              block_number: 0,
            },
            evidence: "e",
          },
        ],
      })),
      overall_rationale: "x",
      generated_at: "x",
      claude_model: "x",
      ingest_block: 0,
    };
    expect(() => validateCitations(doc, facts)).not.toThrow();
  });
});

describe("[2-05-01c] rate() — writeToFs writes canonical string", () => {
  it("writes canonical JSON whose hash matches result.reasoningHash", async () => {
    const { readFileSync, rmSync, existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { computeReasoningHash, canonicalizeDoc } = await import(
      "../src/hash.js"
    );
    const { parseReasoningDocument: parseDoc } = await import(
      "../src/schema.js"
    );

    vi.mocked(multiread).mockReset();
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    const outDir = resolve(process.cwd(), "agent", ".test-out", "USDY");
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });

    const result = await rate("USDY", {
      mock: true,
      blockNumber: 75_000_000n,
      writeToFs: true,
      outDir,
    });
    expect(result.outPath).toBeDefined();
    const onDisk = readFileSync(result.outPath!, "utf8");
    // The on-disk bytes ARE the canonical bytes (no trailing newline added).
    const parsed = parseDoc(JSON.parse(onDisk));
    expect(canonicalizeDoc(parsed)).toBe(onDisk);
    expect(computeReasoningHash(parsed)).toBe(result.reasoningHash);

    rmSync(outDir, { recursive: true, force: true });
  });
});
