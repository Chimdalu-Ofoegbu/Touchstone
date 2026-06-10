---
phase: 02-rating-engine-core
verified: 2026-06-10T11:45:00Z
status: gaps_found
score: 2/4 success criteria fully verified (2 partial)
overrides_applied: 0
re_verification:
gaps:
  - truth: "Four deterministic scoring modules each emit a 0-100 score per subject, implemented as code separate from the LLM step (SC-2 / CON-deterministic-vs-llm-separation). The deterministic scores must be the numbers that appear in the published, hashed reasoning document."
    status: failed
    reason: >
      CR-01 CONFIRMED. The four deterministic scorers exist and run, but their
      BandResults are fed ONLY into the Claude prompt — they are never written
      back into doc.dimensions. synthesizeRating() spreads `...parsed` (Claude's
      output) and overrides only grade, confidence, generated_at, claude_model,
      ingest_block. dimensions[].score and band_hit pass through from Claude
      verbatim. Independent proof (mock client returning score:70 while the engine
      computed 42) showed doc.dimensions[collateral].score === 70 (Claude's), NOT
      42 (engine's). The published per-dimension numbers are LLM output, breaking
      CON-deterministic-vs-llm-separation in the output artifact and making the
      reasoning hash non-deterministic across live runs (violates plan 02-04
      must_have truth #5: "byte-identical canonical string AND identical hash").
      The 185-test mock suite never catches this because the mock hard-codes
      score:70 and hash-determinism.test.ts uses hand-authored fixed docs.
    artifacts:
      - path: "agent/src/claude/synthesize.ts:185-192"
        issue: "`overridden` spreads ...parsed and overrides 5 scalar fields only; dimensions[] (incl. score, band_hit) is Claude's, never the engine's BandResults"
      - path: "agent/src/rate.ts:254-267"
        issue: "BandResults passed as `scores` to synthesizeRating (prompt input) but never reconciled back into doc.dimensions"
      - path: "agent/src/claude/prompt.ts:113"
        issue: "Prompt instructs Claude 'already computed — do NOT recompute' but nothing enforces it; Claude still authors dimensions[].score in the tool call"
    missing:
      - "In synthesizeRating, after zod parse, override each dimension's score / band_hit / missing_facts from the engine BandResult keyed by `key` (pass the four BandResults into synthesizeRating). Reject if Claude dropped/duplicated a dimension key."
      - "Add a LIVE (or mock-with-divergent-score) determinism test: feed a mock that returns a per-dimension score different from the engine's deterministic score and assert the doc carries the engine number — the inverse of the current mock that hard-codes 70."
  - truth: "The engine can be invoked locally for any subject and returns a complete reasoning JSON whose ingest_block and provenance are faithful and reproducible (SC-4 + D-04 no-latest-leak)."
    status: failed
    reason: >
      CR-02 + CR-04 CONFIRMED. On a live run WITHOUT --block, rate() calls
      adapter(undefined) -> multiread(reads, undefined), and viem reads chain
      head (`latest`). But each adapter stamps `ingestBlock = blockNumber !==
      undefined ? Number(blockNumber) : 0`, so ingest_block, every
      Fact.source.blockNumber, every citation block_number, and priceAtBlock(0)
      all record block 0 while the data came from `latest`. This is the exact
      `latest` leak D-04 forbids. Independently, getBlockTimestampSeconds(undefined)
      calls getBlock({}) which also reads `latest` — a second, independent
      `latest` snapshot driving generated_at. Two consecutive live default-block
      runs are therefore non-deterministic (different latest, same stamped block 0)
      and Phase 4 replay against ingest_block:0 reads genesis-era state, never
      reproducing the live hash. The no-latest-leak tripwire is a source-text grep
      that never exercises this runtime default path, so the suite stays green.
    artifacts:
      - path: "agent/src/subjects/usdy.ts:64"
        issue: "`ingestBlock = blockNumber !== undefined ? Number(blockNumber) : 0` stamps 0 while multiread(round1, undefined) reads latest"
      - path: "agent/src/subjects/cmeth.ts:59"
        issue: "same default-to-0; also feeds priceAtBlock(0)"
      - path: "agent/src/subjects/fbtc.ts:62"
        issue: "same default-to-0; also feeds priceAtBlock(0)"
      - path: "agent/src/rate.ts:138-140"
        issue: "getBlockTimestampSeconds(undefined) -> getBlock({}) reads latest independently of the fact-read block (CR-04)"
    missing:
      - "Resolve a concrete block in rate() BEFORE any read: `const resolvedBlock = opts.blockNumber ?? (opts.mock ? MOCK_BLOCK : await publicClient.getBlockNumber())`, then call adapter(resolvedBlock) and getBlockTimestampSeconds(resolvedBlock) so reads, ingest_block, citations, prices, and timestamp all pin to the same block — never 0."
      - "Make the adapter signature require a concrete bigint (or fall back to the resolved value, never literal 0)."
      - "Replace/augment the source-grep no-latest-leak tripwire with a runtime test asserting ingest_block equals the block actually read on the default path."
  - truth: "RPC URL (which may carry an Alchemy/Infura API key) is redacted on the live error path (T-2-03 secret-safety, supports SC-4 'invoked locally' safely)."
    status: failed
    reason: >
      CR-03 CONFIRMED. redactRpcUrl() is defined in rpc.ts and unit-tested, but
      grep across agent/src shows ZERO production call sites — the only call is in
      tests/subjects/static.test.ts. The sole catch in src (cli.ts:97-98) writes
      e.message raw to stderr; its comment claims the message is already scrubbed,
      but synthesize.ts scrubs only ANTHROPIC_API_KEY. A live RPC failure thrown
      from multiread/getBlock carries MANTLE_RPC_URL (file docs note it may embed
      an API key) and viem error strings routinely embed the transport URL, so the
      keyed URL reaches stderr un-redacted. multicall.ts:50 wraps the
      publicClient.multicall call in no try/catch, so a transport throw propagates
      raw to the CLI. T-2-03 is documented-but-not-enforced.
    artifacts:
      - path: "agent/src/cli.ts:97-98"
        issue: "catch writes e.message raw; redactRpcUrl not imported or applied"
      - path: "agent/src/rpc.ts:30-33"
        issue: "redactRpcUrl defined and tested but called by zero production sites (grep-confirmed)"
      - path: "agent/src/multicall.ts:50"
        issue: "publicClient.multicall not wrapped — transport throw carries keyed URL upward unredacted"
    missing:
      - "Route the cli.ts catch (and any logging) through redactRpcUrl + the Anthropic scrubber before writing to stderr."
      - "Wrap the live RPC boundary in multicall.ts / rate.ts (getBlock, getBlockNumber, multicall) so the keyed URL is redacted at the boundary that owns it, with stage context."
deferred: []
human_verification:
  - test: "Citation-rigor eyeball on a LIVE run: run `pnpm rate USDY --block <recent>` (and cmETH, FBTC) with a real ANTHROPIC_API_KEY + MANTLE_RPC_URL, then read each dimension rationale."
    expected: "Every claim names a specific data point from the <facts> block (TVL value, owner address, paused flag, price) — no generic 'the collateral is strong' statements. Grades show a distinguishable mix across the three subjects (not three identical AAAs)."
    why_human: "Requires a live Anthropic call (skipped in CI/worktree per 02-05 SUMMARY Task 2-05-03 auto-approval) and subjective judgement of rationale specificity that grep cannot assess."
  - test: "Live determinism: after the CR-01/CR-02/CR-04 fixes land, run `pnpm rate USDY --block <fixed N>` twice and diff the reasoningHash."
    expected: "Byte-identical reasoningHash across both live runs at the same pinned block (T-2-06 on the live path, not just mock)."
    why_human: "The current mock harness cannot prove live determinism — it hard-codes dimension score:70. Confirming the contract on the live model path needs a real API key."
---

# Phase 2: Rating Engine Core — Verification Report

**Phase Goal:** A standalone off-chain rating engine produces grades + reasoning for the three committed subjects (USDY, cmETH, FBTC), with deterministic and LLM steps inspectably separated.
**Verified:** 2026-06-10T11:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The engine scaffold, adapters, four deterministic scorers, Claude tool-use synthesis, schema, canonicalize+keccak256 hash chain, CLI, and 185-test mock suite all exist and pass. TypeScript strict typecheck is clean (`tsc --noEmit` exit 0). The deterministic and LLM steps ARE file-separated (`agent/src/dimensions/*` vs `agent/src/claude/*`).

However, the central cross-phase contract — hash determinism + faithful provenance — is breached on the LIVE (non-mock) path. **All four CRITICAL findings from 02-REVIEW.md are independently CONFIRMED.** The full test suite is green only because every test runs in mock mode, where the bugs are structurally invisible (the mock hard-codes dimension `score: 70`, the no-latest-leak test is a source-text grep, and the live human-verify checkpoint was auto-skipped for lack of an API key per 02-05 SUMMARY Task 2-05-03).

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Engine ingests on-chain data (TVL/volatility, oracle config, collateral, holder/contract, verified source) for each subject | ✓ VERIFIED (with provenance caveat) | 3 adapters (usdy/cmeth/fbtc.ts) batch ERC-20 + paused + owner via `multiread` → SubjectFacts grouped by 4 dimensions; static facts versioned. Ingestion works; but ingest_block provenance is corrupted on the default live path (see SC-4 / CR-02). |
| SC-2 | Four deterministic scoring modules each emit 0-100 per subject, implemented as code separate from the LLM step | ✗ FAILED | 4 scorers exist and are file-separated from `claude/`, AND `dimensions/synthesize.ts` computes the deterministic overall/grade/confidence. BUT the per-dimension `score`/`band_hit` that land in the published, hashed document are Claude's numbers, not the engine's (CR-01, proven: engine 42 → doc shows Claude's 70). The deterministic-vs-LLM separation does not hold in the output artifact. |
| SC-3 | Claude synthesizes 4 scores into a letter grade (AAA-D) + per-dimension cited rationale, every claim naming a specific data point | ⚠️ PARTIAL (human eval needed) | Forced tool-use (`tool_choice {type:tool,name:submit_rating}`), grade/confidence engine-overridden correctly, prompt wraps facts in `<facts>` and demands `[N]` citations, `validateCitations` rejects fabricated addresses. "Every claim names a specific data point (no generic statements)" needs a live-run eyeball — auto-skipped in execution (02-05 Task 2-05-03). |
| SC-4 | Engine invokable locally for any subject, returns complete reasoning JSON (per-dim scores + rationales + grade + confidence + overall rationale) matching the agreed schema | ✗ FAILED (mock-only; live non-deterministic) | `rate()` + `pnpm rate <SUBJECT> --mock` produce schema-valid JSON for all 3 subjects (185 tests pass). BUT the live default path stamps `ingest_block: 0` while reading `latest` (CR-02), derives `generated_at` from a second independent `latest` snapshot (CR-04), and embeds LLM-variable dimension scores (CR-01) — so the live JSON is non-deterministic and its provenance is unfaithful. Live path was never executed. |

**Score:** 2/4 success criteria fully verified; SC-2 and SC-4 FAILED; SC-3 partial pending human citation-rigor check.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `agent/src/constants/grade-enum.ts` | uint8 mirror of GradeEnum.sol | ✓ VERIFIED | AAA=0, D=9, MAX=9 — byte-for-byte match to Solidity |
| `agent/src/schema.ts` | zod ReasoningDocument, on-chain bounds | ✓ VERIFIED | grade.uint8 0..9, confidence 30..100, chain_id literal 5000, dimensions length 4 |
| `agent/src/subjects/{usdy,cmeth,fbtc}.ts` | per-subject adapters, block-pinned | ⚠️ ORPHANED-PROVENANCE | Exist + wired; but default-block path stamps ingest_block 0 (CR-02) |
| `agent/src/multicall.ts` | multiread, allowFailure → missing_facts | ✓ VERIFIED (redaction gap) | Threads blockNumber; no try/catch redaction at RPC boundary (CR-03) |
| `agent/src/dimensions/{4 scorers}.ts` + `synthesize.ts` | banded 0-100 scorers + 25% combine | ✓ VERIFIED (as code) | All 4 + synthesize exist, file-separated; deterministic numbers computed — but not bound into published doc (CR-01) |
| `agent/src/claude/synthesize.ts` | forced tool-use, engine overrides | ✗ STUB-OF-CONTRACT | Overrides 5 scalar fields; does NOT override dimensions[] score/band_hit (CR-01) |
| `agent/src/claude/prompt.ts` | facts in `<facts>` tags, citation demand | ✓ VERIFIED | Sanitizes C0 controls, caps 256, wraps `<facts>`, demands `[N]` cites |
| `agent/src/hash.ts` | canonicalize + keccak256 | ✓ VERIFIED | RFC 8785 JCS via `canonicalize`; keccak256(toBytes(...)) |
| `agent/src/rate.ts` | orchestrator + validateCitations | ⚠️ WIRED-BUT-LEAKY | Full pipeline wired; passes BandResults to prompt only; getBlockTimestampSeconds reads latest (CR-04) |
| `agent/src/cli.ts` | pnpm rate, 3 subjects, --mock/--block | ✓ VERIFIED (redaction gap) | Allow-list enforced; raw e.message to stderr (CR-03) |
| `agent/src/rpc.ts` | publicClient + redactRpcUrl | ⚠️ ORPHANED | redactRpcUrl defined+tested but ZERO production call sites (CR-03) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| dimensions/*.ts | subjects/types.ts | SubjectFacts buckets | ✓ WIRED | imports present |
| dimensions/synthesize.ts | grade-enum.ts | GRADE_LETTER_TO_UINT8 | ✓ WIRED | used in scoreToGrade |
| claude/synthesize.ts | schema.ts | ReasoningDoc.safeParse | ✓ WIRED | parse + re-parse present |
| hash.ts | viem.keccak256 + canonicalize | computeReasoningHash chain | ✓ WIRED | exact chain present |
| claude/synthesize.ts | tool_choice forced submit_rating | Anthropic API | ✓ WIRED | tool_choice {type:tool,name:submit_rating} |
| **rate.ts deterministic BandResults** | **doc.dimensions[].score / band_hit** | **engine override** | ✗ **NOT_WIRED (CR-01)** | BandResults reach the prompt only; never written into the hashed doc |
| cli.ts / multicall.ts | redactRpcUrl | error-path redaction | ✗ **NOT_WIRED (CR-03)** | redactRpcUrl never called in production |
| rate.ts | resolved pinned block | adapter + timestamp threading | ✗ **NOT_WIRED (CR-02/CR-04)** | default path leaks `latest`, stamps ingest_block 0 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| reasoning doc `dimensions[].score` | doc.dimensions | Claude tool_use input (verbatim) | LLM-variable, NOT engine BandResult | ✗ HOLLOW — wired but data is the LLM's, not the deterministic engine's (CR-01) |
| reasoning doc `ingest_block` | facts.ingestBlock | adapter, literal 0 on default path | reads latest, records 0 | ✗ DISCONNECTED from the block actually read (CR-02) |
| reasoning doc `generated_at` | blockTimestampSeconds | getBlock({}) = latest on default | second independent latest snapshot | ✗ DISCONNECTED from the fact-read block (CR-04) |
| reasoning doc `grade` / `confidence` | det.letter/uint8/confidence | engine synthesize() override | engine deterministic | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript strict typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full mock test suite | `npx vitest run` | 22 files, 185 tests passed | ✓ PASS (mock only) |
| CR-01 dimension-score override | injected mock score:70 vs engine 42, read doc | doc.dimensions[collateral].score = **70** (Claude's), grade/confidence = engine | ✗ FAIL — confirms dimension scores are LLM-controlled |
| Live rating end-to-end | `pnpm rate USDY --block N` (real keys) | not run — no ANTHROPIC_API_KEY in env | ? SKIP — routed to human verification |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| REQ-01 | 02-01, 02-03, 02-04, 02-05 | Rating engine pipeline; deterministic scoring SEPARATED from LLM (CON-deterministic-vs-llm-separation); evidence-cited rationale | ⚠️ PARTIAL | Pipeline + file separation present, but the deterministic separation is NOT preserved in the hashed output (CR-01). Publish (IPFS + publishRating) is Phase 3 scope by design. |
| REQ-05 | 02-02, 02-05 | Three Mantle RWA subjects rated (engine-side) | ✓ SATISFIED (engine-side) | USDY/cmETH/FBTC adapters at the 3 locked addresses, chain 5000; `pnpm rate` works per subject in mock. On-chain `RatingPublished` is Phase 3 scope per CONTEXT boundary. |

No orphaned requirements: every ID declared in plan frontmatter (REQ-01, REQ-05) maps to REQUIREMENTS.md and to the phase requirement IDs. REQUIREMENTS.md maps exactly REQ-01 and REQ-05 to Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| claude/synthesize.ts | 185-192 | `...parsed` spread copies Claude's dimensions[] into the hashed doc | 🛑 Blocker | CR-01 — LLM numbers in deterministic output; non-deterministic hash |
| subjects/usdy.ts, cmeth.ts, fbtc.ts | 64 / 59 / 62 | `ingestBlock = ... : 0` while reading latest | 🛑 Blocker | CR-02 — provenance corruption, `latest` leak, broken replay |
| cli.ts | 97-98 | raw `e.message` to stderr; redactRpcUrl unused | 🛑 Blocker | CR-03 — keyed RPC URL leak on live error path |
| rate.ts | 138-140 | `getBlock({})` reads latest independent of read block | 🛑 Blocker | CR-04 — second non-determinism source for generated_at |
| tests/subjects/no-latest-leak.test.ts | whole file | source-text grep, not runtime exercise | ⚠️ Warning | misleading green — never hits the ingest_block:0 path |
| 02-05-SUMMARY.md | line 26 | "Same code path as live mode; only the leaves are swapped" | ⚠️ Warning | overstates mock coverage; live determinism never proven |

### Human Verification Required

1. **Live citation-rigor eyeball** — run `pnpm rate USDY/cmETH/FBTC --block <recent>` with real `ANTHROPIC_API_KEY` + `MANTLE_RPC_URL`; confirm every dimension rationale names a specific data point (no generic statements) and that grades show a distinguishable mix. (Auto-skipped during execution per 02-05 Task 2-05-03.)
2. **Live determinism re-check (after fixes)** — run the same `--block N` twice live and diff `reasoningHash`; expect byte-identical. The mock harness cannot prove this (hard-codes dimension score 70).

### Gaps Summary

The phase produced a complete, well-structured engine that is correct under the mock, but it does NOT yet honor the determinism + provenance contract on the live path that Phases 3 and 4 will consume. Three blocking gaps, grouped by root cause:

1. **LLM-controlled deterministic fields (CR-01)** — the engine's banded `score`/`band_hit` are computed and shown to Claude, but Claude's echoed numbers (not the engine's) are what get hashed and published. Two live runs over identical chain state can produce different hashes. This is the most serious finding: it breaks CON-deterministic-vs-llm-separation (REQ-01) and plan 02-04 must_have truth #5 directly, and it silently corrupts the bytes32 that Phase 3 writes on-chain and Phase 4 verifies. **Independently reproduced** with a divergent-score mock (engine 42 → doc 70).

2. **`latest` leak + ingest_block:0 (CR-02, CR-04)** — the default (no `--block`) live path reads chain head but records block 0 everywhere (ingest_block, citations, prices, and a separate latest read for the timestamp). This poisons provenance and makes Phase 4 replay impossible for any document rated without an explicit block. The fix (resolve one concrete block in `rate()` and thread it to adapter + timestamp) closes both CR-02 and CR-04.

3. **Un-redacted RPC URL on the live error path (CR-03)** — `redactRpcUrl` exists and is tested but is wired into zero production sites; a live RPC failure prints the keyed `MANTLE_RPC_URL` to stderr. T-2-03 is documented-but-not-enforced.

None of these were flagged as intentional deviations in any SUMMARY — they are undiscovered defects masked by mock-only test coverage — so no override is warranted. None are addressed by a later phase; Phase 3/4 consume this contract and would inherit the corruption. Recommend a focused gap-closure plan: a single change in `rate.ts`/`synthesize.ts` resolves CR-01/CR-02/CR-04 (resolve block + override dimensions from BandResults), plus a small redaction wiring change for CR-03, plus live-path tests that exercise divergent dimension scores and the default-block path.

---

_Verified: 2026-06-10T11:45:00Z_
_Verifier: Claude (gsd-verifier)_
