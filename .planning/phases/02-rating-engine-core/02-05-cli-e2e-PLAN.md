---
phase: 02
plan: 05
plan_id: 02-05-cli-e2e
type: execute
wave: 4
depends_on: [02-01-scaffold, 02-02-subjects, 02-03-dimensions, 02-04-claude-hash]
files_modified:
  - agent/src/rate.ts
  - agent/src/cli.ts
  - agent/src/index.ts
  - agent/src/claude/mock.ts
  - agent/tests/helpers/mock-anthropic.ts
  - agent/tests/rate.test.ts
  - agent/tests/env-safety.test.ts
  - agent/tests/cli.test.ts
  - agent/README.md
autonomous: true
requirements:
  - REQ-01
  - REQ-05
objective: |
  `rate(SubjectId, blockNumber?)` library orchestrator + `pnpm rate <SUBJECT>` CLI.
  Wires the full pipeline: adapter → 4 scorers → synthesize → Claude → hash, plus
  the post-hoc citation-source validation (T-2-07) that rejects any Claude-fabricated
  address. CLI accepts ONLY the three locked SubjectId values, supports `--mock`
  and `--block N` flags, writes JSON to `agent/out/{subject}/{block}.json`, and
  surfaces redacted error messages. A README documents env setup and demonstrates
  `pnpm rate USDY --mock`.

must_haves:
  truths:
    - "`rate(SubjectId, blockNumber?)` returns a ReasoningDocument and a reasoningHash"
    - "`pnpm rate USDY --mock` produces a valid JSON file under agent/out/USDY/{block}.json"
    - "`pnpm rate cmETH --mock` and `pnpm rate FBTC --mock` succeed end-to-end"
    - "`pnpm rate NotARealSubject` exits non-zero with a clear error (T-2-07: CLI rejects arbitrary identifiers)"
    - "Post-hoc validation rejects a ReasoningDocument whose citation.source.address is not in SubjectFacts AND not 'static_config'"
    - "No file in the repo (excluding .env and .env.local — gitignored) contains a literal ANTHROPIC_API_KEY value"
    - "README.md documents the 3 env keys and the `pnpm rate` invocation"
  artifacts:
    - path: "agent/src/rate.ts"
      provides: "rate() library entrypoint (Phase 3 imports this)"
      exports: ["rate", "validateCitations"]
    - path: "agent/src/cli.ts"
      provides: "pnpm rate <SUBJECT> [--block N] [--out -] [--mock]"
    - path: "agent/README.md"
      provides: "Setup + invocation documentation"
      contains: "pnpm rate"
    - path: "agent/tests/rate.test.ts"
      provides: "Pipeline integration test (mocked RPC + mocked Claude)"
    - path: "agent/tests/env-safety.test.ts"
      provides: "T-2-01 mitigation proof — no ANTHROPIC_API_KEY in committed files"
    - path: "agent/tests/cli.test.ts"
      provides: "CLI smoke for all 3 subjects in --mock mode + unknown-subject rejection"
  key_links:
    - from: "agent/src/rate.ts"
      to: "all prior waves"
      via: "orchestrator: getAdapter → scoreXxx → synthesize → synthesizeRating → computeReasoningHash"
      pattern: "getAdapter|scoreCollateral|synthesize|synthesizeRating|computeReasoningHash"
    - from: "agent/src/cli.ts"
      to: "agent/src/rate.ts"
      via: "rate(SubjectId, blockNumber?)"
      pattern: "rate\\("
    - from: "agent/src/rate.ts"
      to: "T-2-07 citation validation"
      via: "validateCitations(doc, facts)"
      pattern: "validateCitations"
---

<objective>
Wave 4 closes the engine. `rate(SubjectId, blockNumber?)` is the library entrypoint Phase 3 will import; `pnpm rate USDY` is the CLI judges can run live. Post-hoc citation-source validation rejects Claude-fabricated addresses (T-2-07). A small README documents env setup so the next phase boots straight into Phase 3 wiring.

Purpose: this wave demonstrates REQ-01's end-to-end execution (Ingest → Score → Reason → output JSON) and proves REQ-05 (all 3 subjects produce a complete reasoning JSON). Phase 3 picks up by adding IPFS pin + `publishRating`; Phase 4 picks up by importing `computeReasoningHash` for verification.

Output: rate.ts orchestrator + cli.ts + 3 integration tests + env-safety test + README.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02-rating-engine-core/02-CONTEXT.md (D-01..D-14 — all locked)
@.planning/phases/02-rating-engine-core/02-RESEARCH.md (§6 CLI shape, §11 export contract, §10 T-2-07 + post-hoc citation validation)
@.planning/phases/02-rating-engine-core/02-PATTERNS.md (Secrets handling section, atomic-commit convention)
@.planning/phases/02-rating-engine-core/02-VALIDATION.md (tasks 2-05-01..2-05-03)
@.planning/phases/02-rating-engine-core/02-01-SUMMARY.md
@.planning/phases/02-rating-engine-core/02-02-SUMMARY.md
@.planning/phases/02-rating-engine-core/02-03-SUMMARY.md
@.planning/phases/02-rating-engine-core/02-04-SUMMARY.md
@agent/src/subjects/registry.ts
@agent/src/dimensions/synthesize.ts
@agent/src/claude/synthesize.ts
@agent/src/hash.ts
@agent/src/schema.ts
@agent/src/index.ts

<interfaces>
<!-- Already produced -->

From prior waves:
```ts
// Adapter dispatch
export function getAdapter(id: SubjectId): (block?: bigint) => Promise<SubjectFacts>;
// Dimension scorers
export function scoreCollateral(facts: SubjectFacts): BandResult;
export function scoreContractRisk(facts: SubjectFacts): BandResult;
export function scoreOracleIntegrity(facts: SubjectFacts): BandResult;
export function scoreLiquidityStability(facts: SubjectFacts): BandResult;
// Combine
export function synthesize(input: SynthesizeInput): SynthesizeOutput;
// Claude
export async function synthesizeRating(input: SynthesizeRatingInput): Promise<ReasoningDocument>;
// Hash
export function computeReasoningHash(doc: ReasoningDocument): `0x${string}`;
// Schema
export function parseReasoningDocument(input: unknown): ReasoningDocument;
```

<!-- This wave PRODUCES -->

agent/src/rate.ts:
```ts
export type RateOptions = {
  blockNumber?: bigint;
  mock?: boolean;            // for tests / CLI smoke; injects a deterministic Claude mock + stubbed multiread fixture
  writeToFs?: boolean;       // CLI sets true; library callers default to false
};
export type RateResult = { doc: ReasoningDocument; reasoningHash: `0x${string}`; outPath?: string };
export async function rate(subject: SubjectId, opts?: RateOptions): Promise<RateResult>;

/** T-2-07 post-hoc check: every citation source.address must be in SubjectFacts OR "static_config". */
export function validateCitations(doc: ReasoningDocument, facts: SubjectFacts): void;
```
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 2-05-01: rate() orchestrator with post-hoc citation validation (T-2-07) + pipeline integration test</name>
  <files>agent/src/rate.ts, agent/tests/rate.test.ts</files>
  <read_first>
    - .planning/phases/02-rating-engine-core/02-RESEARCH.md (§6 rate.ts orchestrator role, §10 T-2-07 post-hoc citation check, §11 export contract Phase 3 surface)
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (canonical_refs Integration Points — Phase 3 imports this)
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (Engine-side overrides + Block-pinning thread-through)
    - All prior wave files imported below
  </read_first>
  <behavior>
    - Test 1: `rate("USDY", { mock: true })` returns { doc, reasoningHash } with valid schema
    - Test 2: `rate("USDY", { mock: true, blockNumber: 75_000_000n })` returns doc.ingest_block === 75_000_000
    - Test 3: `rate("USDY", { mock: true, writeToFs: true })` creates a file at `agent/out/USDY/{block}.json` whose content (after canonicalize) hashes to `result.reasoningHash`
    - Test 4 (T-2-07): a mock Claude that returns a citation with `source.address = "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF"` (not in the fact list) triggers `validateCitations` to throw "fabricated address"
    - Test 5: `rate("cmETH", { mock: true })` and `rate("FBTC", { mock: true })` both succeed
    - Test 6: re-running `rate("USDY", { mock: true })` twice produces byte-identical `reasoningHash` (mock returns same args; engine overrides produce same generated_at)
  </behavior>
  <action>
    Create `agent/src/rate.ts`:
    ```ts
    import { existsSync, mkdirSync, writeFileSync } from "node:fs";
    import { resolve, dirname } from "node:path";
    import type { SubjectId, SubjectFacts } from "./subjects/types";
    import { getAdapter } from "./subjects/registry";
    import { scoreCollateral } from "./dimensions/collateral-quality";
    import { scoreContractRisk } from "./dimensions/contract-risk";
    import { scoreOracleIntegrity } from "./dimensions/oracle-integrity";
    import { scoreLiquidityStability } from "./dimensions/liquidity-stability";
    import { synthesize } from "./dimensions/synthesize";
    import { synthesizeRating, MODEL, type AnthropicClientLike } from "./claude/synthesize";
    import { computeReasoningHash, canonicalizeDoc } from "./hash";
    import { parseReasoningDocument, type ReasoningDocument } from "./schema";
    import { publicClient } from "./rpc";
    // W2 fix: import from production-safe src location (no test-framework deps).
    // tests/helpers/mock-anthropic.ts re-exports from this file for backward compat.
    import { fixtureToolUseResponse, mockAnthropicClient } from "./claude/mock";

    export type RateOptions = {
      blockNumber?: bigint;
      mock?: boolean;
      writeToFs?: boolean;
      outDir?: string;
      client?: AnthropicClientLike;
    };
    export type RateResult = {
      doc: ReasoningDocument;
      reasoningHash: `0x${string}`;
      outPath?: string;
    };

    /**
     * T-2-07 mitigation: every citation must point at an address that appears in
     * the ingested SubjectFacts OR is the "static_config" sentinel. Claude is
     * instructed not to fabricate; this check is the defense-in-depth.
     */
    export function validateCitations(doc: ReasoningDocument, facts: SubjectFacts): void {
      const allowedAddresses = new Set<string>(["static_config"]);
      for (const bucket of [facts.collateral, facts.contract, facts.oracle, facts.liquidity]) {
        for (const f of bucket) {
          if (f.source.kind === "onchain") allowedAddresses.add(f.source.address.toLowerCase());
          if (f.source.kind === "static") allowedAddresses.add("static_config");
        }
      }
      for (const dim of doc.dimensions) {
        for (const c of dim.citations) {
          const addr = c.source.address === "static_config" ? "static_config" : c.source.address.toLowerCase();
          if (!allowedAddresses.has(addr)) {
            throw new Error("fabricated address in citation (T-2-07): dim=" + dim.key + " cite=[" + String(c.id) + "] addr=" + c.source.address);
          }
        }
      }
    }

    async function getBlockTimestampSeconds(blockNumber: bigint | undefined, mock: boolean): Promise<number> {
      if (mock) return 1717804800; // fixed for hash determinism in --mock
      const block = await publicClient.getBlock(blockNumber !== undefined ? { blockNumber } : {});
      return Number(block.timestamp);
    }

    function buildMockClient(detLetter: ReasoningDocument["grade"]["letter"], detU8: number, detConfidence: number, ticker: SubjectId, address: `0x${string}`) {
      const args = {
        schema_version: "1.0.0",
        subject: { name: ticker, ticker, address, chain_id: 5000 },
        grade: { letter: detLetter, uint8: detU8 },
        confidence: detConfidence,
        dimensions: ["collateral_quality","contract_risk","oracle_integrity","liquidity_stability"].map(key => ({
          key, score: 70, band_hit: { max: 70, score: 70, label: "mock band" }, missing_facts: [],
          rationale: "Per fact [1] the indicator is solid; per fact [2] this is corroborated.",
          citations: [
            { id: 1, label: "static a", value: "v1", source: { address: "static_config", function: "static.ts@1.0.0", block_number: 0 }, evidence: "e1" },
            { id: 2, label: "static b", value: "v2", source: { address: "static_config", function: "static.ts@1.0.0", block_number: 0 }, evidence: "e2" },
          ],
        })),
        overall_rationale: "Mock overall rationale across all four dimensions.",
      };
      return mockAnthropicClient([{ kind: "ok", response: fixtureToolUseResponse(args as any) }]);
    }

    export async function rate(subject: SubjectId, opts: RateOptions = {}): Promise<RateResult> {
      const adapter = getAdapter(subject);
      const facts = await adapter(opts.blockNumber);

      const collateral = scoreCollateral(facts);
      const contract   = scoreContractRisk(facts);
      const oracle     = scoreOracleIntegrity(facts);
      const liquidity  = scoreLiquidityStability(facts);
      const det        = synthesize({ collateral, contract, oracle, liquidity });

      const blockTimestampSeconds = await getBlockTimestampSeconds(opts.blockNumber, !!opts.mock);

      const client = opts.client ?? (opts.mock
        ? buildMockClient(det.letter, det.uint8, det.confidence, subject, facts.subject.address)
        : undefined);

      const doc = await synthesizeRating({
        subject: facts,
        scores: { collateral, contract, oracle, liquidity },
        missingFacts: [...collateral.missing_facts, ...contract.missing_facts, ...oracle.missing_facts, ...liquidity.missing_facts],
        preComputedGrade: { letter: det.letter, uint8: det.uint8 },
        preComputedConfidence: det.confidence,
        blockTimestampSeconds,
        client,
      });

      validateCitations(doc, facts);

      const reasoningHash = computeReasoningHash(doc);

      let outPath: string | undefined;
      if (opts.writeToFs) {
        const dir = opts.outDir ?? resolve(process.cwd(), "agent", "out", subject);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        outPath = resolve(dir, String(doc.ingest_block) + ".json");
        // Write the canonical string so the on-disk bytes match what was hashed.
        writeFileSync(outPath, canonicalizeDoc(doc), { encoding: "utf8" });
      }

      // Final defensive parse — proves doc is schema-valid post-validation.
      parseReasoningDocument(doc);
      return { doc, reasoningHash, outPath };
    }
    ```

    Per W2 fix: create `agent/src/claude/mock.ts` as the production-safe home for `fixtureToolUseResponse` and `mockAnthropicClient` (no vitest / test-framework imports allowed). Re-export from `agent/tests/helpers/mock-anthropic.ts` so existing tests keep importing from their current path:

    ```ts
    // agent/src/claude/mock.ts
    import type { AnthropicClientLike } from "./synthesize";
    import type { ReasoningDocument } from "../schema";

    export function fixtureToolUseResponse(args: Omit<ReasoningDocument, "generated_at" | "claude_model" | "ingest_block"> & { generated_at?: string; claude_model?: string; ingest_block?: number }) {
      return {
        content: [
          { type: "tool_use", name: "submit_rating", input: {
            ...args,
            generated_at: args.generated_at ?? "9999-12-31T23:59:59Z",
            claude_model: args.claude_model ?? "claude-imaginary-99",
            ingest_block: args.ingest_block ?? 0,
          }},
        ],
      };
    }

    export type MockBehavior =
      | { kind: "ok"; response: any }
      | { kind: "schema-mismatch"; response: any }
      | { kind: "no-tool"; response: any };

    export function mockAnthropicClient(behaviors: MockBehavior[]): AnthropicClientLike {
      const queue = [...behaviors];
      return {
        messages: {
          create: async () => {
            if (queue.length === 0) throw new Error("mock anthropic: no more behaviors queued");
            const next = queue.shift()!;
            return next.response;
          },
        },
      };
    }
    ```

    Then rewrite `agent/tests/helpers/mock-anthropic.ts` (created in Wave 3) to a thin re-export:

    ```ts
    // agent/tests/helpers/mock-anthropic.ts — backward-compat re-export per W2 fix.
    export { fixtureToolUseResponse, mockAnthropicClient } from "../../src/claude/mock";
    export type { MockBehavior } from "../../src/claude/mock";
    ```

    Phase 3 will import `rate()` from `agent/src/rate.ts`; the import surface stays clean — no test-only paths leak in.

    Create `agent/tests/rate.test.ts`:
    ```ts
    import { describe, it, expect, vi, beforeEach } from "vitest";
    import { rate, validateCitations } from "../src/rate";
    import { parseReasoningDocument } from "../src/schema";
    import { usdyMulticallSuccess } from "./fixtures/usdy.fixture";
    import { cmethMulticallSuccess } from "./fixtures/cmeth.fixture";
    import { fbtcMulticallSuccess } from "./fixtures/fbtc.fixture";

    vi.mock("../src/multicall", () => ({ multiread: vi.fn() }));
    import { multiread } from "../src/multicall";

    describe("[2-05-01a] rate() orchestrator — happy path", () => {
      beforeEach(() => { vi.mocked(multiread).mockReset(); });

      it.each([
        ["USDY", () => usdyMulticallSuccess],
        ["cmETH", () => cmethMulticallSuccess],
        ["FBTC", () => fbtcMulticallSuccess],
      ] as const)("rate(%s) returns valid doc + 0x66-char hash", async (subject, fixture) => {
        vi.mocked(multiread).mockResolvedValue(fixture());
        const result = await rate(subject as any, { mock: true, blockNumber: 75_000_000n });
        expect(() => parseReasoningDocument(result.doc)).not.toThrow();
        expect(result.doc.subject.ticker).toBe(subject);
        expect(result.doc.ingest_block).toBe(75_000_000);
        expect(/^0x[0-9a-f]{64}$/.test(result.reasoningHash)).toBe(true);
      });

      it("two consecutive runs at same block produce byte-identical hash (T-2-06)", async () => {
        vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
        const a = await rate("USDY", { mock: true, blockNumber: 75_000_000n });
        const b = await rate("USDY", { mock: true, blockNumber: 75_000_000n });
        expect(a.reasoningHash).toBe(b.reasoningHash);
      });
    });

    describe("[2-05-01b] validateCitations — T-2-07 post-hoc fabrication check", () => {
      it("throws when a citation references an address not in SubjectFacts", () => {
        const facts: any = {
          subject: { name: "u", ticker: "USDY", address: "0x5be26527e817998A7206475496fDE1E68957c5A6", chainId: 5000 },
          ingestBlock: 0, collateral: [], contract: [], oracle: [], liquidity: [],
        };
        const doc: any = {
          schema_version: "1.0.0",
          subject: { name: "u", ticker: "USDY", address: "0x5be26527e817998A7206475496fDE1E68957c5A6", chain_id: 5000 },
          grade: { letter: "A", uint8: 2 },
          confidence: 80,
          dimensions: [{
            key: "collateral_quality", score: 70, band_hit: { max: 70, score: 70, label: "x" }, missing_facts: [],
            rationale: "r [1]",
            citations: [{ id: 1, label: "fab", value: "v", source: { address: "0xdEadBeefdEadBeEfDeadBEefDEadBeefDeAdbEef", function: "f", block_number: 0 }, evidence: "e" }],
          }, {
            key: "contract_risk", score: 70, band_hit: { max: 70, score: 70, label: "x" }, missing_facts: [],
            rationale: "r [1]", citations: [{ id: 1, label: "static", value: "v", source: { address: "static_config", function: "f", block_number: 0 }, evidence: "e" }],
          }, {
            key: "oracle_integrity", score: 70, band_hit: { max: 70, score: 70, label: "x" }, missing_facts: [],
            rationale: "r [1]", citations: [{ id: 1, label: "static", value: "v", source: { address: "static_config", function: "f", block_number: 0 }, evidence: "e" }],
          }, {
            key: "liquidity_stability", score: 70, band_hit: { max: 70, score: 70, label: "x" }, missing_facts: [],
            rationale: "r [1]", citations: [{ id: 1, label: "static", value: "v", source: { address: "static_config", function: "f", block_number: 0 }, evidence: "e" }],
          }],
          overall_rationale: "x",
          generated_at: "2026-06-09T00:00:00Z", claude_model: "claude-opus-4-7", ingest_block: 0,
        };
        expect(() => validateCitations(doc, facts)).toThrow(/fabricated address/);
      });

      it("accepts citations pointing at addresses present in SubjectFacts (case-insensitive)", () => {
        const addr = "0x5be26527e817998A7206475496fDE1E68957c5A6" as `0x${string}`;
        const facts: any = {
          subject: { name: "u", ticker: "USDY", address: addr, chainId: 5000 },
          ingestBlock: 0,
          collateral: [{ label: "l", value: "v", evidence: "e", source: { kind: "onchain", address: addr, function: "f", blockNumber: 0 } }],
          contract: [], oracle: [], liquidity: [],
        };
        const doc: any = {
          schema_version: "1.0.0",
          subject: { name: "u", ticker: "USDY", address: addr, chain_id: 5000 },
          grade: { letter: "A", uint8: 2 }, confidence: 80,
          dimensions: ["collateral_quality","contract_risk","oracle_integrity","liquidity_stability"].map(k => ({
            key: k, score: 70, band_hit: { max: 70, score: 70, label: "x" }, missing_facts: [],
            rationale: "r [1]",
            citations: [{ id: 1, label: "l", value: "v", source: { address: k === "collateral_quality" ? addr.toLowerCase() : "static_config", function: "f", block_number: 0 }, evidence: "e" }],
          })),
          overall_rationale: "x", generated_at: "x", claude_model: "x", ingest_block: 0,
        };
        expect(() => validateCitations(doc, facts)).not.toThrow();
      });
    });

    describe("[2-05-01c] rate() — writeToFs writes canonical string", async () => {
      it("writes canonical JSON whose hash matches result.reasoningHash", async () => {
        const { readFileSync, rmSync, existsSync } = await import("node:fs");
        const { resolve } = await import("node:path");
        const { computeReasoningHash, canonicalizeDoc } = await import("../src/hash");
        const { parseReasoningDocument } = await import("../src/schema");

        vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
        const outDir = resolve(process.cwd(), "agent", ".test-out", "USDY");
        if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });

        const result = await rate("USDY", { mock: true, blockNumber: 75_000_000n, writeToFs: true, outDir });
        expect(result.outPath).toBeDefined();
        const onDisk = readFileSync(result.outPath!, "utf8");
        // The on-disk bytes ARE the canonical bytes (no trailing newline added).
        const parsed = parseReasoningDocument(JSON.parse(onDisk));
        expect(canonicalizeDoc(parsed)).toBe(onDisk);
        expect(computeReasoningHash(parsed)).toBe(result.reasoningHash);

        rmSync(outDir, { recursive: true, force: true });
      });
    });
    ```
  </action>
  <verify>
    <automated>cd agent && pnpm test -- tests/rate.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/src/rate.ts` returns 0
    - `grep -c 'export async function rate' agent/src/rate.ts` returns 1
    - `grep -c 'export function validateCitations' agent/src/rate.ts` returns 1
    - `grep -cE 'from "\.\./tests/' agent/src/rate.ts` returns 0 (W2: src must not import from tests/)
    - `test -f agent/src/claude/mock.ts` returns 0 (W2: production-safe mock home)
    - `grep -c 'fabricated address' agent/src/rate.ts` returns ≥ 1 (T-2-07)
    - `cd agent && pnpm test -- tests/rate.test.ts` exits 0
    - `cd agent && pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>rate() orchestrates all prior waves, post-hoc validateCitations rejects fabricated addresses, --mock mode is hash-deterministic, writeToFs produces an on-disk canonical string whose hash matches the returned reasoningHash.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2-05-02: CLI (pnpm rate <SUBJECT>) + per-subject smoke + unknown-subject rejection + env-safety test (T-2-01) + README</name>
  <files>agent/src/cli.ts, agent/src/index.ts, agent/tests/cli.test.ts, agent/tests/env-safety.test.ts, agent/README.md</files>
  <read_first>
    - .planning/phases/02-rating-engine-core/02-RESEARCH.md (§6 CLI shape, §11 export contract)
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (Claude's Discretion section: CLI shape)
    - .planning/phases/02-rating-engine-core/02-VALIDATION.md (tasks 2-05-01..2-05-03)
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (Secrets handling)
    - agent/src/subjects/types.ts (SubjectId union literal)
    - agent/src/rate.ts (rate signature)
  </read_first>
  <behavior>
    - Test 1: CLI invocation `pnpm rate USDY --mock` exits 0, writes `agent/out/USDY/{block}.json`, prints hash to stdout
    - Test 2: CLI invocation `pnpm rate cmETH --mock` and `pnpm rate FBTC --mock` exit 0 (3 subjects pass)
    - Test 3: CLI invocation `pnpm rate NotASubject --mock` exits non-zero with message containing "Unknown subject" (T-2-07)
    - Test 4: CLI invocation `pnpm rate USDY --block 75000000 --mock` honors the block flag (doc.ingest_block === 75000000)
    - Test 5: `--out -` writes the canonical JSON to stdout AND does NOT write a file
    - Test 6 (env-safety, T-2-01): grep the repo (excluding `.env*`, `agent/node_modules`, `agent/out`, `agent/.test-out`) for `sk-ant-`-prefixed strings — must find 0
    - Test 7 (env-safety): grep for `ANTHROPIC_API_KEY\s*=\s*sk-` — must find 0 in committed files
    - Test 8: README.md contains the literal strings `pnpm rate`, `ANTHROPIC_API_KEY`, `MANTLE_RPC_URL`, `CLAUDE_MODEL`
  </behavior>
  <action>
    Create `agent/src/cli.ts`:
    ```ts
    #!/usr/bin/env node
    import { rate } from "./rate";
    import { canonicalizeDoc } from "./hash";
    import type { SubjectId } from "./subjects/types";

    const SUBJECT_IDS: ReadonlySet<SubjectId> = new Set(["USDY", "cmETH", "FBTC"] as const);

    function parseArgs(argv: string[]): { subject: string; block?: bigint; out?: string; mock: boolean } {
      const positional: string[] = [];
      const flags: Record<string, string | true> = {};
      for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--")) {
          const key = a.slice(2);
          const next = argv[i + 1];
          if (next && !next.startsWith("--")) { flags[key] = next; i++; }
          else { flags[key] = true; }
        } else {
          positional.push(a);
        }
      }
      const subject = positional[0];
      const block = flags["block"] && typeof flags["block"] === "string" ? BigInt(flags["block"]) : undefined;
      const out = typeof flags["out"] === "string" ? flags["out"] : undefined;
      const mock = flags["mock"] === true;
      return { subject, block, out, mock };
    }

    async function main() {
      const args = parseArgs(process.argv.slice(2));
      if (!args.subject) {
        process.stderr.write("Usage: pnpm rate <SUBJECT> [--block N] [--out -|<path>] [--mock]\n");
        process.stderr.write("  SUBJECT one of: USDY, cmETH, FBTC\n");
        process.exit(2);
      }
      if (!SUBJECT_IDS.has(args.subject as SubjectId)) {
        process.stderr.write("Unknown subject: " + args.subject + "\n");
        process.stderr.write("Allowed: USDY, cmETH, FBTC\n");
        process.exit(2);
      }
      try {
        const writeToFs = args.out !== "-"; // --out - means stdout only
        const result = await rate(args.subject as SubjectId, { blockNumber: args.block, mock: args.mock, writeToFs });
        if (args.out === "-") {
          process.stdout.write(canonicalizeDoc(result.doc) + "\n");
        }
        process.stdout.write("reasoningHash=" + result.reasoningHash + "\n");
        if (result.outPath) process.stdout.write("outPath=" + result.outPath + "\n");
      } catch (e: any) {
        // Error message has already been scrubbed of ANTHROPIC_API_KEY by synthesize.ts.
        process.stderr.write("ERROR: " + (e?.message ?? String(e)) + "\n");
        process.exit(1);
      }
    }

    main();
    ```

    Update `agent/src/index.ts` to add `export { rate, validateCitations } from "./rate";`.

    Create `agent/tests/cli.test.ts`:
    ```ts
    import { describe, it, expect } from "vitest";
    import { spawnSync } from "node:child_process";
    import { resolve } from "node:path";
    import { existsSync, rmSync } from "node:fs";

    const CLI = resolve(__dirname, "../src/cli.ts");
    const OUT_DIR = resolve(__dirname, "../out");

    function run(args: string[]) {
      return spawnSync("npx", ["tsx", CLI, ...args], { encoding: "utf8", cwd: resolve(__dirname, "..") });
    }

    describe("[2-05-02] CLI smoke — all 3 subjects in --mock mode", () => {
      it.each(["USDY", "cmETH", "FBTC"])("pnpm rate %s --mock exits 0 and prints reasoningHash", (subject) => {
        if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
        const r = run([subject, "--mock", "--block", "75000000"]);
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/reasoningHash=0x[0-9a-f]{64}/);
      });

      it("pnpm rate UNKNOWN --mock exits non-zero (T-2-07)", () => {
        const r = run(["NotASubject", "--mock"]);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/Unknown subject/);
      });

      it("pnpm rate USDY --mock --out - writes canonical JSON to stdout (no file)", () => {
        if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
        const r = run(["USDY", "--mock", "--out", "-", "--block", "75000000"]);
        expect(r.status).toBe(0);
        // Output: canonical JSON on the first line(s), then "reasoningHash=0x..." line.
        // W1 fix: split on the reasoningHash boundary and verify each part independently.
        const [jsonPart, hashLine] = r.stdout.split(/\n(?=reasoningHash=)/);
        expect(() => JSON.parse(jsonPart)).not.toThrow();
        expect(hashLine).toMatch(/^reasoningHash=0x[0-9a-f]{64}/);
      });
    });
    ```

    Create `agent/tests/env-safety.test.ts`:
    ```ts
    import { describe, it, expect } from "vitest";
    import { execSync } from "node:child_process";
    import { resolve } from "node:path";

    function gitTrackedSearch(pattern: string): string {
      // Search only git-tracked files so .env / node_modules / out are excluded automatically.
      const repoRoot = resolve(__dirname, "../..");
      try {
        return execSync("git grep -nI -- " + JSON.stringify(pattern), { cwd: repoRoot, encoding: "utf8" });
      } catch (e: any) {
        // git grep exits 1 when no match — that's the success case.
        if (e.status === 1) return "";
        throw e;
      }
    }

    describe("[2-05-02 env-safety] T-2-01 — no API keys in committed files", () => {
      it("no sk-ant- prefixed strings in tracked files", () => {
        const matches = gitTrackedSearch("sk-ant-");
        expect(matches).toBe("");
      });
      it("no ANTHROPIC_API_KEY=sk- pattern in tracked files (template assignments only)", () => {
        const matches = gitTrackedSearch("ANTHROPIC_API_KEY=sk-");
        expect(matches).toBe("");
      });
      it("agent/.env.example does not contain PRIVATE_KEY (T-2-01)", () => {
        const matches = gitTrackedSearch("PRIVATE_KEY");
        // PRIVATE_KEY MAY appear in foundry .env conventions but MUST NOT appear in agent/.env.example.
        const lines = matches.split("\n").filter(l => l.includes("agent/.env.example"));
        expect(lines).toEqual([]);
      });
    });
    ```

    Create `agent/README.md`:
    ```markdown
    # @touchstone/agent

    Off-chain TypeScript rating engine for Mantle RWA subjects. Phase 2 deliverable.

    ## Setup

    1. From the repository root, `cd agent`.
    2. `pnpm install` (or `npm install`).
    3. Copy `.env.example` to `.env` and fill in your `ANTHROPIC_API_KEY`.

    ## Environment variables

    | Variable | Required | Default | Purpose |
    |----------|----------|---------|---------|
    | `ANTHROPIC_API_KEY` | yes (live runs) | — | Anthropic Messages API; needed for non-`--mock` invocations. |
    | `MANTLE_RPC_URL` | no | `https://rpc.mantle.xyz` | viem publicClient RPC. Set this to a private RPC (Alchemy/Infura on Mantle) for production. |
    | `CLAUDE_MODEL` | no | `claude-opus-4-7` | Model alias (locked per D-11 user override 2026-06-09). Swap to `claude-opus-4-8`, `claude-sonnet-4-6`, or `claude-opus-4-7` if you want different speed/cost/quality. |

    > Do NOT add `PRIVATE_KEY` to `agent/.env`. The engine never signs in Phase 2.

    ## Usage

    ```
    pnpm rate USDY                       # rate USDY at latest Mantle Mainnet block
    pnpm rate cmETH --block 75000000     # rate at a pinned historical block (Phase 3 replay hook)
    pnpm rate FBTC --mock                # deterministic mock (no live Anthropic / RPC) — used by tests
    pnpm rate USDY --out -               # write canonical JSON to stdout instead of agent/out/
    ```

    Output JSON lives at `agent/out/<SUBJECT>/<block>.json` (file is the canonical-bytes form — its keccak256 IS the `reasoningHash` printed by the CLI).

    ## Testing

    ```
    pnpm test                            # full vitest suite (no live RPC / Anthropic required)
    pnpm test:live                       # gated by RUN_LIVE=1; uses real Mantle RPC + Anthropic
    pnpm typecheck                       # tsc --noEmit
    ```

    ## Architecture

    - `src/subjects/{usdy,cmeth,fbtc}.ts` — viem + Multicall3 adapters (D-01..D-04)
    - `src/dimensions/*.ts` — 4 threshold-banded scorers (D-06)
    - `src/dimensions/synthesize.ts` — uniform 25% combine (D-08) + grade letter mapping
    - `src/claude/synthesize.ts` — single-shot Anthropic tool-use (D-09, D-10, D-11)
    - `src/hash.ts` — RFC 8785 JCS + viem.keccak256 (D-13, D-14)
    - `src/rate.ts` — orchestrator; Phase 3 imports this
    - `src/cli.ts` — `pnpm rate` entrypoint

    Deterministic code (`subjects/*`, `dimensions/*`, `hash.ts`) is strictly separated from the LLM step (`claude/*`) per CON-deterministic-vs-llm-separation.

    ## Phase contracts

    - Phase 3 imports `rate()` to handle `RatingRequested` events.
    - Phase 4 imports `computeReasoningHash()` to verify on-chain hash against IPFS-fetched JSON.
    ```
  </action>
  <verify>
    <automated>cd agent && pnpm test -- tests/cli.test.ts tests/env-safety.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/src/cli.ts` returns 0
    - `test -f agent/README.md` returns 0
    - `grep -c 'pnpm rate' agent/README.md` returns ≥ 1
    - `grep -c 'ANTHROPIC_API_KEY' agent/README.md` returns ≥ 1
    - `grep -c 'MANTLE_RPC_URL' agent/README.md` returns ≥ 1
    - `grep -c 'CLAUDE_MODEL' agent/README.md` returns ≥ 1
    - `grep -c 'Unknown subject' agent/src/cli.ts` returns ≥ 1 (T-2-07)
    - `grep -cE 'SUBJECT_IDS.*=.*new Set\(\["USDY"' agent/src/cli.ts` returns 1 (locked allow-list)
    - `cd agent && pnpm test -- tests/cli.test.ts tests/env-safety.test.ts` exits 0
    - `cd agent && pnpm rate USDY --mock --block 75000000` exits 0 from inside agent/
    - `cd agent && pnpm rate cmETH --mock --block 75000000` exits 0
    - `cd agent && pnpm rate FBTC --mock --block 75000000` exits 0
    - `cd agent && pnpm rate NotASubject --mock` exits non-zero
  </acceptance_criteria>
  <done>CLI accepts only the locked 3 subjects, smoke-tests all 3 in --mock mode, rejects unknown identifiers, env-safety grep proves no key leaks, README documents env + usage + phase contracts.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2-05-03: Human-verify live rating produces a citation-grounded ReasoningDocument</name>
  <what-built>
    The engine end-to-end:
    - Wave 0: agent/ scaffolding, GradeEnum TS mirror, ReasoningDocument zod schema
    - Wave 1: viem + Multicall3 + 3 subject adapters + versioned static facts
    - Wave 2: 4 banded scorers + synthesize() combiner
    - Wave 3: forced-tool-use Anthropic synthesis + RFC 8785 JCS hash
    - Wave 4: rate() orchestrator + `pnpm rate` CLI + env-safety proofs + README
  </what-built>
  <how-to-verify>
    Two checks the human performs after `pnpm test` is green:

    1. **Live RPC + live Anthropic — one live rating per subject.**
       Set `ANTHROPIC_API_KEY` (real key) in `agent/.env`.
       From inside `agent/`:
       ```
       pnpm rate USDY
       pnpm rate cmETH
       pnpm rate FBTC
       ```
       Each should:
       - Exit 0 within ~30 seconds.
       - Print `reasoningHash=0x<64 hex>` and `outPath=agent/out/<SUBJECT>/<block>.json`.
       - The on-disk JSON should validate against the schema (open it; confirm structure matches D-12).
       - Each `dimensions[*].rationale` should contain at least one `[N]` citation marker, and the corresponding `citations[N]` entry should reference a real fact label.

    2. **Eyeball one rationale for citation rigor (CON-llm-prompt-evidence-citation).**
       Open `agent/out/USDY/<block>.json`. For each of the 4 dimensions, confirm:
       - The rationale contains `[1]`, `[2]`, etc. markers.
       - Each `[N]` maps to a `citations[N]` entry.
       - The citation `source.address` is either `static_config` or matches a real Mantle address (compare against the USDY address `0x5be26527e817998A7206475496fDE1E68957c5A6` or other addresses the adapter actually read).
       - The rationale is NOT generic ("the contract is verified") — it names specific values ("verified at implementation `0x3b355A7A25E75A320f631F9736afB3Dcc9F3Ef66`").

    If the rationale reads as generic, surface it as Phase 3 prompt-tuning work — not a Phase 2 blocker.
  </how-to-verify>
  <resume-signal>Type "approved" if all 3 subjects produced citation-grounded ReasoningDocuments. Type "issues: <description>" otherwise to redirect.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries (Wave 4 scope)

| Boundary | Description |
|----------|-------------|
| CLI argv → engine | Untrusted: subject id must be in locked allow-list |
| Claude tool args → engine output JSON | Post-hoc citation-source validation rejects fabrications |
| Engine error path → stderr / log | Must not contain API key or RPC key |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-2-01 | Information Disclosure | env files + error paths | mitigate | `env-safety.test.ts` git-grep proves no `sk-ant-` or `ANTHROPIC_API_KEY=sk-` patterns in tracked files; `agent/.env.example` does not contain `PRIVATE_KEY`. Error-path scrubbing happens in `claude/synthesize.ts` (Wave 3). |
| T-2-07 | Input Validation | `cli.ts` + `validateCitations()` | mitigate | CLI hard-coded allow-list `SUBJECT_IDS = new Set(["USDY", "cmETH", "FBTC"])`; unknown subjects → exit 2 with "Unknown subject" message. Post-hoc `validateCitations(doc, facts)` throws "fabricated address" if Claude cites an address not in the SubjectFacts allow-list. Both behaviors covered by tests. |
</threat_model>

<verification>
- `cd agent && pnpm test` exits 0 (full deterministic suite)
- `cd agent && pnpm typecheck` exits 0
- `cd agent && pnpm rate USDY --mock --block 75000000` exits 0 from inside `agent/`
- Same for cmETH and FBTC
- `cd agent && pnpm rate NotASubject --mock` exits non-zero
- `git grep -I sk-ant-` returns nothing
- Human-verify checkpoint (2-05-03) passes
</verification>

<success_criteria>
- `rate(SubjectId, blockNumber?)` is the locked Phase 3 import surface; Phase 4 imports `computeReasoningHash`
- CLI accepts ONLY the 3 locked subjects; rejects everything else (T-2-07)
- env-safety: no committed file contains a real API key
- README documents env keys + invocation + phase contracts
- Phase 2 closes with all 3 subjects producing citation-grounded ReasoningDocuments live
- Per-task atomic commits
</success_criteria>

<output>
After completion, create `.planning/phases/02-rating-engine-core/02-05-SUMMARY.md` documenting:
- The 3 live `reasoningHash` values (one per subject) produced during the human-verify checkpoint
- Any deviation from RESEARCH §6/§11
- Phase 2 closure summary: REQ-01 + REQ-05 satisfied; engine ready for Phase 3 wiring
- Cost note: how many Anthropic tokens consumed during the 3 live runs (informs Phase 3 cost planning)
</output>
