# Phase 2: Rating Engine Core - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 39 new files (zero modifications)
**Analogs found:** 2 exact (constant-mirror), 1 divergence-noted (test-organization) / 39 total

## Repo Reality (read this first)

Touchstone is a Solidity-first Foundry repo. There is NO pre-existing TypeScript anywhere — no `agent/`, no `app/`, no `engine/`, no `src/*.ts`. Phase 2 introduces the entire `agent/` directory tree.

**Implication for the planner:** for almost every new file, the closest analog does not exist in this codebase. Those files are marked `analog: NEW-PATTERN` and the proposed shape (lifted verbatim from RESEARCH.md sections §1-§11) is the planner's source of truth.

**The two files that DO have hard analogs:**
1. `agent/src/constants/grade-enum.ts` MUST mirror `src/constants/GradeEnum.sol` byte-for-byte. Both are consumed by the same on-chain `publishRating(..., uint8 grade, ...)` path — any drift breaks Phase 3.
2. The zod schema in `agent/src/claude/synthesize.ts` (and the schema-shared `agent/src/subjects/types.ts`) MUST cap `confidence ≤ 100` and `grade.uint8 ≤ 9` to honor the on-chain bounds that `src/RatingRegistry.sol` enforces via `InvalidConfidence()` and `InvalidGrade()`.

The Foundry test file `test/RatingRegistry.t.sol` is the closest "how tests are structured in this repo" analog but the engine uses vitest, not forge — see the divergence note in `## Shared Patterns → Testing Divergence`.

## File Classification

Roles use the phase-specific vocabulary requested: scaffold / adapter / scorer / claude / hash / schema / cli / test / config / static-fact / constant-mirror / rpc.

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `agent/package.json` | scaffold | n/a | NEW-PATTERN | none |
| `agent/tsconfig.json` | scaffold | n/a | NEW-PATTERN | none |
| `agent/vitest.config.ts` | scaffold | n/a | NEW-PATTERN | none |
| `agent/.env.example` | scaffold | n/a | NEW-PATTERN | none |
| `agent/.gitignore` (or rely on root) | scaffold | n/a | NEW-PATTERN (root `.gitignore` already covers `.env.*`) | partial |
| `agent/src/index.ts` | scaffold (barrel) | re-export | NEW-PATTERN (see RESEARCH §11) | none |
| `agent/src/rpc.ts` | rpc | outbound HTTPS | NEW-PATTERN (RESEARCH §1) | none |
| `agent/src/multicall.ts` | rpc | request-response (batched) | NEW-PATTERN (RESEARCH §2) | none |
| `agent/src/hash.ts` | hash | transform (doc → bytes32) | NEW-PATTERN (RESEARCH §5) | none |
| `agent/src/rate.ts` | scaffold (orchestrator) | pipeline | NEW-PATTERN (RESEARCH §6) | none |
| `agent/src/cli.ts` | cli | stdin args → stdout/file | NEW-PATTERN (RESEARCH §6) | none |
| `agent/src/constants/grade-enum.ts` | constant-mirror | static map | `src/constants/GradeEnum.sol` | **EXACT** |
| `agent/src/constants/prices.ts` | static-fact | static map (block-range keyed) | NEW-PATTERN (RESEARCH §3 footnote) | none |
| `agent/src/subjects/types.ts` | schema (TS types) | type-only | NEW-PATTERN (RESEARCH §3.4) | none |
| `agent/src/subjects/static.ts` | static-fact | static map (per-subject off-chain facts) | NEW-PATTERN (RESEARCH §3.1-§3.3) | none |
| `agent/src/subjects/registry.ts` | scaffold (dispatch) | SubjectId → adapter | NEW-PATTERN | none |
| `agent/src/subjects/usdy.ts` | adapter | request-response (RPC → SubjectFacts) | NEW-PATTERN (RESEARCH §3.1) | none |
| `agent/src/subjects/cmeth.ts` | adapter | request-response (RPC → SubjectFacts) | NEW-PATTERN (RESEARCH §3.2) | none |
| `agent/src/subjects/fbtc.ts` | adapter | request-response (RPC → SubjectFacts) | NEW-PATTERN (RESEARCH §3.3) | none |
| `agent/src/dimensions/types.ts` | schema (TS types) | type-only | NEW-PATTERN (RESEARCH §7) | none |
| `agent/src/dimensions/collateral-quality.ts` | scorer | transform (SubjectFacts → BandResult) | NEW-PATTERN (RESEARCH §7.1) | none |
| `agent/src/dimensions/contract-risk.ts` | scorer | transform (SubjectFacts → BandResult) | NEW-PATTERN (RESEARCH §7.2) | none |
| `agent/src/dimensions/oracle-integrity.ts` | scorer | transform (SubjectFacts → BandResult) | NEW-PATTERN (RESEARCH §7.3) | none |
| `agent/src/dimensions/liquidity-stability.ts` | scorer | transform (SubjectFacts → BandResult) | NEW-PATTERN (RESEARCH §7.4) | none |
| `agent/src/dimensions/synthesize.ts` | scorer (combiner) | transform (4 bands → 0..100 → grade letter) | NEW-PATTERN | none |
| `agent/src/claude/tool-schema.ts` | schema (zod → JSON Schema) | type/schema author | NEW-PATTERN (RESEARCH §4) | none |
| `agent/src/claude/prompt.ts` | claude (template) | transform (facts → prompt string) | NEW-PATTERN (RESEARCH §4.2) | none |
| `agent/src/claude/synthesize.ts` | claude (API call) | request-response (Anthropic tool-use) | NEW-PATTERN (RESEARCH §4) | none |
| `agent/tests/constants/grade-enum.test.ts` | test (constant-mirror parity) | unit | `test/RatingRegistry.t.sol` (divergent framework, parallel intent) | partial |
| `agent/tests/dimensions/collateral-quality.test.ts` | test (scorer unit) | unit | NEW-PATTERN | none |
| `agent/tests/dimensions/contract-risk.test.ts` | test (scorer unit) | unit | NEW-PATTERN | none |
| `agent/tests/dimensions/oracle-integrity.test.ts` | test (scorer unit) | unit | NEW-PATTERN | none |
| `agent/tests/dimensions/liquidity-stability.test.ts` | test (scorer unit) | unit | NEW-PATTERN | none |
| `agent/tests/dimensions/synthesize.test.ts` | test (combiner unit) | unit | NEW-PATTERN | none |
| `agent/tests/subjects/usdy.golden.test.ts` | test (golden file) | integration (fixture-stubbed RPC) | NEW-PATTERN | none |
| `agent/tests/subjects/cmeth.golden.test.ts` | test (golden file) | integration (fixture-stubbed RPC) | NEW-PATTERN | none |
| `agent/tests/subjects/fbtc.golden.test.ts` | test (golden file) | integration (fixture-stubbed RPC) | NEW-PATTERN | none |
| `agent/tests/hash.test.ts` | test (determinism) | unit | NEW-PATTERN | none |
| `agent/tests/claude.mock.test.ts` | test (mock Anthropic) | integration (mocked SDK) | NEW-PATTERN | none |
| `agent/tests/rate.test.ts` | test (pipeline) | integration | NEW-PATTERN | none |
| `agent/tests/helpers/mock-anthropic.ts` | test (helper) | fixture | NEW-PATTERN | none |
| `agent/tests/fixtures/` (directory of `.json`) | test (recorded data) | fixture | NEW-PATTERN | none |

## Pattern Assignments

### 1. `agent/src/constants/grade-enum.ts` (constant-mirror, static-map) — EXACT ANALOG

**Analog:** `src/constants/GradeEnum.sol` — lines 7-21 verbatim.

**Why this is the only true mirror in the phase:** Phase 3 will call `publishRating(subject, doc.grade.uint8, hash, doc.confidence)`. The Solidity `RatingRegistry.publishRating` reverts `InvalidGrade()` if `grade > GradeEnum.MAX` (= 9). Any drift between the TS enum and the Solidity library is a Phase 3 break.

**Solidity source to mirror byte-for-byte** (`src/constants/GradeEnum.sol` lines 7-21):

```solidity
library GradeEnum {
    uint8 internal constant AAA = 0;
    uint8 internal constant AA  = 1;
    uint8 internal constant A   = 2;
    uint8 internal constant BBB = 3;
    uint8 internal constant BB  = 4;
    uint8 internal constant B   = 5;
    uint8 internal constant CCC = 6;
    uint8 internal constant CC  = 7;
    uint8 internal constant C   = 8;
    uint8 internal constant D   = 9;

    /// @notice Maximum valid grade value (inclusive). Anything > MAX is invalid.
    uint8 internal constant MAX = 9;
}
```

**Required TS shape** (planner pastes this directly):

```typescript
// agent/src/constants/grade-enum.ts
// MIRROR of src/constants/GradeEnum.sol — byte-for-byte. Any change requires
// updating the Solidity file AND this file together. Verified by
// agent/tests/constants/grade-enum.test.ts which round-trips each pair.

export const GRADE_LETTER_TO_UINT8 = {
  AAA: 0,
  AA: 1,
  A: 2,
  BBB: 3,
  BB: 4,
  B: 5,
  CCC: 6,
  CC: 7,
  C: 8,
  D: 9,
} as const;

export type GradeLetter = keyof typeof GRADE_LETTER_TO_UINT8;

export const GRADE_UINT8_TO_LETTER: Record<number, GradeLetter> = {
  0: "AAA", 1: "AA", 2: "A", 3: "BBB", 4: "BB",
  5: "B",   6: "CCC", 7: "CC", 8: "C",  9: "D",
};

/** Maximum valid grade value (inclusive). Anything > MAX is invalid. */
export const GRADE_MAX = 9;
```

**Test pattern (`agent/tests/constants/grade-enum.test.ts`):** for every letter in `GRADE_LETTER_TO_UINT8`, assert the round-trip `letter → uint8 → letter` is identity AND that `uint8 ≤ GRADE_MAX`. Then hard-assert each of the 10 specific pairs (AAA=0 … D=9) literally so the test fails noisily if anyone re-numbers without thinking.

---

### 2. Schema bounds in `agent/src/subjects/types.ts` + `agent/src/claude/synthesize.ts` (zod) — BOUNDS ANALOG

**Analog:** `src/RatingRegistry.sol` — the `publishRating` bounds and the `Rating` struct shape.

**Why this analog:** the engine's output JSON IS the off-chain side of the on-chain `Rating` struct (the `reasoningHash` field is the keccak256 of canonicalize(doc), but `grade`, `confidence`, `subject` map directly). The engine MUST never emit values the contract would revert.

**Solidity bounds to mirror** (`src/RatingRegistry.sol`):

Struct shape (lines 16-23):
```solidity
struct Rating {
    address subject;
    uint8 grade;          // 0..9 → AAA..D per DEC-grade-encoding-uint8 / CON-grade-encoding
    bytes32 reasoningHash;
    uint8 confidence;
    uint256 timestamp;
    address agentIdentity; // Phase 1: same as agent; Phase 3: ERC-8004 identity address
}
```

Bound enforcement (lines 85-86 of `publishRating`):
```solidity
if (grade > GradeEnum.MAX) revert InvalidGrade();
if (confidence > 100) revert InvalidConfidence();
```

**Required zod shape** (planner pastes into `agent/src/claude/synthesize.ts` — already drafted in RESEARCH §4):

```typescript
// Must mirror the on-chain bounds above. These two lines are the defense-in-depth
// layer: RatingRegistry will revert if violated, but Phase 2 must never emit a
// doc that would cause that revert.
grade: z.object({
  letter: z.enum(["AAA","AA","A","BBB","BB","B","CCC","CC","C","D"]),
  uint8: z.number().int().min(0).max(9),         // mirrors GradeEnum.MAX = 9
}),
confidence: z.number().int().min(30).max(100),   // 100 ceiling mirrors publishRating;
                                                  // floor of 30 is D-07 (engine-internal)
```

**Test (`agent/tests/dimensions/synthesize.test.ts -t "on-chain-bounds"`):** assert that no input to `synthesize()` — including the most-degraded "all 4 dims default to 50, all facts missing" path — produces `confidence > 100` or `grade.uint8 > 9`. This is the Phase 3 break-prevention test.

---

### 3. Test organization (`agent/tests/**/*.test.ts`) — DIVERGENT-FRAMEWORK PARALLEL

**Analog:** `test/RatingRegistry.t.sol` — same intent (per-task numbered unit tests, boundary-value coverage) but different framework (forge / Solidity vs vitest / TS).

**Pattern to carry forward (intent, not syntax):**

From `test/RatingRegistry.t.sol` lines 34-72 — the boundary-value test style for `confidenceRange`:

```solidity
function test_publishRating_confidenceRange() public {
    // Boundary: confidence == 0 is allowed.
    registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 0);
    // Boundary: confidence == 100 is allowed.
    registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(2)), 100);
    // Boundary: confidence == 101 reverts.
    vm.expectRevert(RatingRegistry.InvalidConfidence.selector);
    registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(3)), 101);
    // Boundary: confidence == 255 (uint8 max) reverts.
    vm.expectRevert(RatingRegistry.InvalidConfidence.selector);
    registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(4)), 255);
}
```

**Carry-forward conventions for the TS test files:**

- **Per-task numbering in test docstrings.** The Phase 1 forge test prefixed each test with `/// 1-02-01 — onlyAgent gate rejects non-agent callers (T-1-01 mitigation proof).`. Mirror this in vitest: `it("[2-XX-XX] returns score 50 when collateral fact missing (D-07 mitigation)", () => {...})`. Keeps the validation-architecture traceability that Phase 1 established.
- **Boundary-value triplets.** Phase 1 tests each numeric bound with three points: just-below, at-bound, just-above. Apply the same pattern to every banded scorer test: `BANDS[i].max - 1`, `BANDS[i].max`, `BANDS[i].max + 1`.
- **Setup() pattern.** Phase 1 uses `setUp()` to construct the registry once. Vitest equivalent: `beforeEach()` to construct the `publicClient`-mocked context once per test file.

**Divergence to document inline in PLAN.md:**

| Concern | Solidity test (`forge-std`) | TS test (`vitest`) |
|---------|-----------------------------|---------------------|
| Framework import | `import {Test} from "forge-std/Test.sol";` | `import { describe, it, expect, beforeEach, vi } from "vitest";` |
| Pranking caller | `vm.prank(addr)` | n/a — no equivalent; test pure functions or inject mocked deps |
| Expect revert | `vm.expectRevert(Selector)` | `expect(() => fn()).toThrow(/InvalidConfidence/)` |
| Mocking | n/a — test against real bytecode | `vi.spyOn(publicClient, "multicall").mockResolvedValue(fixture)` |
| Event assertion | `vm.expectEmit` + redeclared event | Vitest does not assert events; assert returned struct shape instead |

This divergence is real and unavoidable — do NOT try to force the forge idioms into vitest. The carry-forward is the test-naming convention and the boundary-value discipline, NOT the framework idioms.

---

### 4-22. NEW-PATTERN files (see RESEARCH.md sections for proposed shapes)

The remaining files have no existing analog in the repo. The planner should lift the proposed shape from the indicated RESEARCH.md section verbatim. Each entry below names the file, the section the shape comes from, and a 2-line summary of what the file does.

| File | Source section | Summary |
|------|----------------|---------|
| `agent/package.json` | RESEARCH §6 | Pin viem ^2.52.2, @anthropic-ai/sdk ^0.102.0, canonicalize ^3.0.0, zod ^4.4.3, zod-to-json-schema ^3.24.0, vitest ^4.1.8, tsx ^4.22.4. `"type": "module"`, scripts: `rate`, `test`, `test:live`, `typecheck`. Exports map per RESEARCH §6. |
| `agent/tsconfig.json` | RESEARCH §6 | ES2022, module NodeNext, strict, esModuleInterop, skipLibCheck. |
| `agent/vitest.config.ts` | RESEARCH §9 | Default Vitest config; pick up `tests/**/*.test.ts`; `RUN_LIVE=1` gates `.live.test.ts` files. |
| `agent/.env.example` | RESEARCH §9 Wave 0 | `ANTHROPIC_API_KEY=`, `MANTLE_RPC_URL=`, `CLAUDE_MODEL=claude-opus-4-7`. NO `PRIVATE_KEY` (engine never signs). |
| `agent/src/index.ts` | RESEARCH §11 | Barrel: re-export `rate`, `computeReasoningHash`, `canonicalizeDoc`, grade constants, all four BANDS tables, types. |
| `agent/src/rpc.ts` | RESEARCH §1 | `createPublicClient({ chain: mantle, transport: http(MANTLE_RPC_URL, {retryCount: 2, timeout: 15_000}), batch: { multicall: true }})`. Single exported `publicClient`. |
| `agent/src/multicall.ts` | RESEARCH §2 | `multiread(reads, blockNumber?)` wraps `publicClient.multicall({ contracts, blockNumber, allowFailure: true })`. Returns `ReadResult[]` with `{ ok, value | error, label }`. The `label` drives missing_facts and citations. |
| `agent/src/hash.ts` | RESEARCH §5 | `canonicalizeDoc(doc) → string` and `computeReasoningHash(doc) → keccak256(toBytes(canonical))`. THIS file is imported by Phase 4 frontend without modification. |
| `agent/src/rate.ts` | RESEARCH §6 / §11 | `rate(SubjectId, blockNumber?): Promise<ReasoningDocument>` — orchestrates adapter → 4 scorers → synthesize → claude → engine-override fields → zod validate → return. Writes `agent/out/{ticker}/{block}.json` when called by CLI. |
| `agent/src/cli.ts` | RESEARCH §6 | `pnpm rate USDY [--block N] [--out -]`. Parse args with standard `process.argv` (NO commander/yargs dep — keep deps tight). |
| `agent/src/constants/prices.ts` | RESEARCH §3 footnote | Static USD prices keyed by block range. `{ BTC_USD: number; ETH_USD: number; MNT_USD: number; recordedAtBlock: number; }[]`. Lookup: `priceAtBlock(block) → entry`. Hash-determinism mechanism. |
| `agent/src/subjects/types.ts` | RESEARCH §3.4 | Export `SubjectId`, `Fact`, `SubjectFacts`. Locked shape. |
| `agent/src/subjects/static.ts` | RESEARCH §3.1-§3.3 | Per-subject off-chain facts (collateral, audit, custodian, oracle architecture). Versioned with `STATIC_VERSION = "1.0.0"` so citations are reproducible. |
| `agent/src/subjects/registry.ts` | (helper, no section) | `const ADAPTERS: Record<SubjectId, (block?: bigint) => Promise<SubjectFacts>> = { USDY: fetchUsdy, cmETH: fetchCmeth, FBTC: fetchFbtc };`. |
| `agent/src/subjects/usdy.ts` | RESEARCH §3.1 | `fetch(blockNumber?)`. Multicall round 1: ERC-20 + `oraclePrice()` + `paused()`. Round 2: top-N `balanceOf` from static holder list. Returns `SubjectFacts` grouped by dimension. |
| `agent/src/subjects/cmeth.ts` | RESEARCH §3.2 | Same pattern as usdy.ts. Reads cmETH↔mETH peg ratio + EIP-1967 impl + top-N holders + Mantle Chainlink ETH/USD oracle (if available). |
| `agent/src/subjects/fbtc.ts` | RESEARCH §3.3 | Same pattern. Reads `decimals()` (=8), `paused()`, `totalSupply()`, blocked-address probe, top-N holders, PoR-address if exposed. |
| `agent/src/dimensions/types.ts` | RESEARCH §7 | Export `Band = { max: number \| null; score: number; label: string }`, `BandResult = Band & { missing_facts: string[]; raw_value: number \| null }`. |
| `agent/src/dimensions/collateral-quality.ts` | RESEARCH §7.1 | Top-of-file `export const COLLATERAL_BANDS: Band[] = [...]`. Function: derive quality_index 0..100 from `SubjectFacts.collateral`, then `for (const b of BANDS) if (idx < b.max) return b;`. |
| `agent/src/dimensions/contract-risk.ts` | RESEARCH §7.2 | Same shape; derives index from source_verified, timelock, holder concentration, audit recency. |
| `agent/src/dimensions/oracle-integrity.ts` | RESEARCH §7.3 | Same shape; derives index from redundancy_count, staleness guard, manipulation resistance. |
| `agent/src/dimensions/liquidity-stability.ts` | RESEARCH §7.4 | Same shape. Band input is parent_tvl_USD per Open Question 2 recommendation. Document choice in file header. |
| `agent/src/dimensions/synthesize.ts` | RESEARCH §4.2 / D-08 | Uniform 25% combine: `overall = (b1+b2+b3+b4)/4`. Map overall 0..100 → grade letter using band table. Apply D-07 confidence rule: `confidence = max(30, 100 - 5*totalMissingFacts)`. |
| `agent/src/claude/tool-schema.ts` | RESEARCH §4 | Zod schemas (`Citation`, `Dimension`, `ReasoningDoc`) → `zodToJsonSchema(..., {target: "openAi"})` → exported `submitRatingTool` with `name`, `description`, `input_schema`, `strict: true`. |
| `agent/src/claude/prompt.ts` | RESEARCH §4.2 | `buildPromptFromFacts({ subject, scores, missingFacts })` returns the templated prompt string. Wraps every fact value in `<facts>...</facts>` XML tags (threat-model mitigation §10). |
| `agent/src/claude/synthesize.ts` | RESEARCH §4 | `synthesizeRating(args)`: single-shot Anthropic call with forced `tool_choice`, zod-validate, one-retry on schema mismatch, OVERRIDE `generated_at`/`claude_model`/`ingest_block` engine-side. |
| `agent/tests/dimensions/*.test.ts` | RESEARCH §9 | Per-dimension unit tests: (a) typical score, (b) missing-fact → 50, (c) boundary at each band edge. Follow the Phase 1 boundary-value style above. |
| `agent/tests/subjects/*.golden.test.ts` | RESEARCH §9 + golden-recording note | Stub `publicClient.multicall` to return a fixture from `tests/fixtures/{ticker}@{block}.json`. Assert dimension scores AND structural properties of rationale (NOT exact text). |
| `agent/tests/hash.test.ts` | RESEARCH §8 + §9 | Determinism test: run engine twice over same input, assert byte-equal canonical strings AND byte-equal hashes. Plus regression tests for each §8 landmine. |
| `agent/tests/claude.mock.test.ts` | RESEARCH §9 | Mock `client.messages.create` to return a hand-authored `tool_use` block satisfying ReasoningDocument schema. Validates the wiring without an API call. |
| `agent/tests/rate.test.ts` | RESEARCH §9 | Pipeline test combining mocked RPC + mocked Anthropic. Asserts returned doc validates against the zod schema. |
| `agent/tests/helpers/mock-anthropic.ts` | RESEARCH §9 Wave 0 | Helper exporting `mockAnthropicClient(toolArgs)` for the above. |
| `agent/tests/fixtures/` | RESEARCH §9 golden-recording | Directory of `{ticker}@{block}.json` files capturing recorded multicall responses. Generated by a one-off `pnpm rate --record-fixtures` run. |

## Shared Patterns

### Constant-mirror discipline (applies to: `grade-enum.ts`, the zod schema bounds)

**Source:** `src/constants/GradeEnum.sol` lines 7-21; `src/RatingRegistry.sol` lines 85-86.

**Apply to:** any TS file whose values must round-trip through `publishRating`. Currently: `agent/src/constants/grade-enum.ts` and the `grade.uint8` + `confidence` fields of the zod schema in `agent/src/claude/synthesize.ts`.

**Rule:** if you change the Solidity, you change the TS in the same commit. The constant-mirror parity test (`agent/tests/constants/grade-enum.test.ts`) is the tripwire — it hard-asserts each of the 10 pairs plus `MAX === 9`.

### Per-task atomic commits (carried from Phase 1)

**Source:** Phase 1 CONTEXT §code_context, observed in `git log` (recent commits are per-task: `fix(01)`, `docs(01)`, `feat(01)` style).

**Apply to:** every plan task in Phase 2 PLAN.md should be a single commit unit. Mirror the Phase 1 commit-message convention: `<type>(<phase>): <subject>`, e.g., `feat(02): scaffold agent package and tsconfig`, `feat(02): port GradeEnum to TS with parity test`.

### Block-pinning thread-through (applies to: all 3 adapters + `rate.ts`)

**Source:** D-04 (CONTEXT) — every adapter accepts `blockNumber?: bigint`; if provided, ALL viem reads MUST pass it through.

**Apply to:** `agent/src/subjects/{usdy,cmeth,fbtc}.ts`, `agent/src/multicall.ts`, `agent/src/rate.ts`.

**Tripwire test:** `agent/tests/subjects/no-latest-leak.test.ts` (suggested by RESEARCH §10 threat-model row "Replay-at-block reads inconsistent if `latest` snuck in") greps the adapter source files for `client.multicall(` and `client.readContract(` and asserts `blockNumber` appears in the same expression. Cheap and catches the foot-gun.

### Engine-side overrides for hash-determinism fields (applies to: `rate.ts`, `claude/synthesize.ts`)

**Source:** RESEARCH §4 and §8 (BigInt / `generated_at` / `claude_model` / `ingest_block` landmines).

**Rule:** after zod validation of Claude's tool args, OVERWRITE these three fields engine-side. Never trust Claude with `generated_at`/`claude_model`/`ingest_block`. Specifically:
- `generated_at` ← derived from `publicClient.getBlock({ blockNumber: ingestBlock }).timestamp`, formatted to a single locked ISO 8601 form (pick: with or without millis — RESEARCH §8 leaves the choice to planner; recommend WITHOUT millis for fewest divergence vectors).
- `claude_model` ← `process.env.CLAUDE_MODEL ?? "claude-opus-4-7"`.
- `ingest_block` ← `Number(blockNumber)` (asserts `< 2^53`).

### Testing divergence (Solidity forge ↔ TypeScript vitest)

**Source:** `test/RatingRegistry.t.sol` is the only test file in the repo. It uses forge-std, `vm.prank`, `vm.expectRevert`, `vm.expectEmit`. Phase 2 uses vitest. The divergence is real — do not paper over it.

**Carry forward:** test-naming convention (`/// 1-02-01 — ...` → `it("[2-XX-XX] ...")`); boundary-value discipline (just-below, at-bound, just-above for every numeric threshold); per-task numbered traceability back to the validation architecture map.

**Do NOT carry forward:** forge idioms, `vm.*` calls, event-assertion patterns. Use vitest's `vi.spyOn` / `vi.mock` for mocking and `expect().toThrow(...)` for revert-equivalents.

### Secrets handling (applies to: `.env.example`, `rpc.ts`, error handling everywhere)

**Source:** Phase 1 WR-04 (root `.gitignore` covers `.env.*`); RESEARCH §10 threat-model rows on secret leakage.

**Rules:**
- `agent/.env.example` is committed; `agent/.env` is NOT (covered by root `.env.*` glob).
- Engine reads ONLY `ANTHROPIC_API_KEY`, `MANTLE_RPC_URL`, `CLAUDE_MODEL`. Never reads `PRIVATE_KEY` (engine does not sign in Phase 2).
- Any `viem` error message that contains `MANTLE_RPC_URL` MUST be redacted before being written to JSON or stdout: `error.message.replace(MANTLE_RPC_URL, "[redacted]")`. Wrap this in a shared helper in `agent/src/rpc.ts`.

### Static-fact citation source convention (applies to: `subjects/static.ts`, `claude/prompt.ts`, schema)

**Source:** RESEARCH §3 + zod regex `^0x[a-fA-F0-9]{40}$|^static_config$` (already drafted in RESEARCH §4).

**Rule:** every `Fact` whose `source.kind === "static"` produces a citation with `source.address === "static_config"` and `source.function === "static.ts@v1.0.0"` (matches `STATIC_VERSION`). Phase 4 verifier renders these as "off-chain config (versioned)" distinct from on-chain citations.

## No Analog Found

Files with no close match — listed because they ARE in the file plan but have no in-repo prior art to lift from. Planner should use RESEARCH.md as the spec source.

| File | Role | Data Flow | Reason no analog |
|------|------|-----------|------------------|
| All 39 files except `grade-enum.ts` and the zod schema bounds | various | various | Touchstone has zero pre-existing TypeScript. The entire `agent/` tree is greenfield. |

Of the 39 files, only **`agent/src/constants/grade-enum.ts`** has an EXACT analog (`src/constants/GradeEnum.sol`). The zod schema bounds in `agent/src/claude/synthesize.ts` (and re-exposed in `agent/src/subjects/types.ts`) have a CONSTRAINT analog (the Solidity reverts in `RatingRegistry.publishRating`) but no shape-analog — they're new code constrained by an old contract. The test files have a CONVENTION analog (`test/RatingRegistry.t.sol`'s numbered-comment + boundary-value style) but a divergent framework.

For every other file, the planner should treat RESEARCH.md as the closest thing to a pattern source and copy the code excerpts from the cited section verbatim.

## Metadata

**Analog search scope:**
- `src/**/*.sol` (Solidity contracts and libraries)
- `test/**/*.sol` (Foundry tests)
- `**/*.{ts,js,tsx,jsx,json}` (entire repo glob to confirm no existing TS)

**Files scanned (non-derived):**
- `src/RatingRegistry.sol` — full read
- `src/constants/GradeEnum.sol` — full read
- `test/RatingRegistry.t.sol` — full read
- `.planning/phases/02-rating-engine-core/02-CONTEXT.md` — full read
- `.planning/phases/02-rating-engine-core/02-RESEARCH.md` — full read (both pages)

**Non-source files (build artifacts, broadcast logs, package.json from lib/) deliberately excluded** as they have no bearing on engine pattern selection.

**Pattern extraction date:** 2026-06-09

## PATTERN MAPPING COMPLETE

**Phase:** 2 - Rating Engine Core
**Files classified:** 39 new (zero modifications)
**Analogs found:** 2 exact (constant-mirror + bounds-mirror) / 39 total

### Coverage
- Files with exact analog: **2** (`agent/src/constants/grade-enum.ts` mirrors `src/constants/GradeEnum.sol`; the zod bounds in `agent/src/claude/synthesize.ts` mirror `src/RatingRegistry.sol` revert conditions)
- Files with partial / convention analog: **8 test files** (Phase 1 forge test contributes naming convention + boundary-value discipline but framework divergence is real)
- Files with no analog: **29** (entire greenfield `agent/` tree)

### Key Patterns Identified
- **Constant-mirror discipline:** the Solidity `GradeEnum` library and `RatingRegistry` bound enforcement are the immutable truth source; TS files are slaves. Tripwire test asserts each pair literally.
- **Block-pinning thread-through:** D-04 hook for Phase 3 historical replay. Every adapter + multicall call site MUST receive and forward `blockNumber?`. Grep-based tripwire test catches `latest` leaks.
- **Engine-side override for hash-stability fields:** `generated_at`, `claude_model`, `ingest_block` are written by the engine AFTER Claude's tool args are zod-validated. Never trust the LLM with deterministic provenance.
- **Per-task atomic commits with phase-prefixed type(NN): subject messages** carried over from Phase 1.
- **Testing divergence acknowledged, not papered over:** vitest is not forge; carry forward only naming convention and boundary-value discipline.

### File Created
`C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Touchstone\.planning\phases\02-rating-engine-core\02-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference the two real analogs (`src/constants/GradeEnum.sol` for the constant-mirror file; `src/RatingRegistry.sol` bounds for the zod schema) and use RESEARCH.md §1-§11 as the spec source for the remaining greenfield files. The convention-only carry-forwards (test naming, commit cadence, secret handling) are documented in `## Shared Patterns`.
