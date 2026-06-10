---
phase: 02-rating-engine-core
verified: 2026-06-10T13:25:00Z
status: passed
score: 4/4 success criteria verified (live UAT passed in-session at block 96481000 — see 02-HUMAN-UAT.md)
human_uat_result: "passed 2026-06-10 — SC-3 citation rigor + SC-4 re-hash determinism confirmed live (USDY→BBB). A 5th live-only blocker CR-05 (submit_rating input_schema missing type:object, Anthropic 400) was found during live UAT and fixed (commit 7cdff79)."
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "CR-01 (SC-2): engine BandResult dimension scores now bound into the hashed doc (synthesize.ts rebuild), proven by divergent-score test [2-04-02e]"
    - "CR-02 (SC-4): adapters resolve a concrete block once via resolveBlockNumber and stamp it into both multiread and ingestBlock — no ingest_block=0 while reading latest; proven by 3 runtime adapter tests"
    - "CR-04 (SC-4): getBlockTimestampSeconds reads getBlock({ blockNumber }) at BigInt(facts.ingestBlock), param is bigint (not optional) — no second latest snapshot"
    - "CR-03 (security): redactRpcError/redactRpcUrl now CALLED in multicall.ts, rate.ts, rpc.ts, cli.ts — wiring tripwire test enforces it"
  gaps_remaining: []
  regressions: []
deferred: []
human_verification:
  - test: "Live citation-rigor eyeball: run `pnpm rate USDY --block <recent>` (and cmETH, FBTC) with a real ANTHROPIC_API_KEY + MANTLE_RPC_URL, then read each dimension rationale."
    expected: "Every claim names a specific data point from the <facts> block (TVL value, owner address, paused flag, price). Grades show a distinguishable mix across the three subjects (not three identical AAAs)."
    why_human: "Requires a live Anthropic call (skipped in CI/worktree per 02-05 SUMMARY Task 2-05-03) and subjective judgement of rationale specificity that grep cannot assess. SC-3."
  - test: "Live two-run determinism: run `pnpm rate USDY --block <fixed N>` twice live and diff the reasoningHash."
    expected: "Byte-identical reasoningHash across both live runs at the same pinned block (T-2-06 on the live model path, not just mock)."
    why_human: "The code path that makes this byte-identical (engine-bound dimensions + pinned block + pinned timestamp) is now verified and mock-proven, but final confirmation on the live model path needs a real API key."
---

# Phase 2: Rating Engine Core — Verification Report

**Phase Goal:** A standalone off-chain rating engine produces grades + reasoning for the three committed subjects (USDY, cmETH, FBTC), with deterministic and LLM steps inspectably separated.
**Verified:** 2026-06-10T12:25:00Z
**Status:** human_needed
**Re-verification:** Yes — after inline gap closure for the 4 determinism/security blockers (CR-01, CR-02, CR-03, CR-04).

## Re-Verification Summary

The prior verification (status `gaps_found`, score 2/4) confirmed 4 CRITICAL blockers from 02-REVIEW.md. Four atomic fix commits have since landed on master. Each fix was re-checked **independently against the live source and the live test suite** — not the commit messages. **All four blockers are genuinely closed.** The full suite is **190/190 green** (22 files) and `tsc --noEmit` exits 0 — both re-run during this verification, not taken on report.

| Blocker | Prior | Now | Code Evidence | Test Evidence |
|---------|-------|-----|---------------|---------------|
| CR-01 (SC-2) | ✗ FAILED | ✓ CLOSED | `synthesize.ts:213-254` rebuilds `dimensions[]` from engine `BandResult`s keyed by canonical key; `score`/`band_hit`/`missing_facts` ← engine, only `rationale`+`citations` ← Claude; canonical key order enforced (`CANONICAL_DIMENSION_KEYS`, l.61-66, 236); drop/dup keys rejected (l.225-242) | `[2-04-02e]` (3 cases): engine 85/62/50/41 published over Claude's 70; canonical order on shuffle; throws on dup/drop — all pass |
| CR-02 (SC-4) | ✗ FAILED | ✓ CLOSED | `rpc.ts:37-46` `resolveBlockNumber()` resolves head once; all 3 adapters (`usdy.ts:66-69`, `cmeth.ts:61-65`, `fbtc.ts:64-68`) thread the SAME `resolvedBlockNumber` into both `multiread()` and `ingestBlock`; **zero `: 0` defaults remain** (grep-confirmed) | 3 runtime adapter tests "resolves chain head and stamps THAT block (never 0)…": `ingestBlock === 88_000_000`, `multiread` received the resolved block, every onchain fact carries it — all pass |
| CR-04 (SC-4) | ✗ FAILED | ✓ CLOSED | `rate.ts:140-153` `getBlockTimestampSeconds(blockNumber: bigint, …)` calls `getBlock({ blockNumber })`; invoked at `rate.ts:250-253` with `BigInt(facts.ingestBlock)`; param is `bigint` (not optional); **no `getBlock({})` (latest) remains** (grep-confirmed, only in a comment) | Covered transitively by rate() determinism + golden hash tests; param-type enforced by `tsc` (exit 0) |
| CR-03 (security) | ✗ FAILED | ✓ CLOSED | `redactRpcError` CALLED in `multicall.ts:62`, `rate.ts:150`, `rpc.ts:44`; `redactRpcUrl` CALLED in `cli.ts:102` — no longer zero production sites | `static.test.ts:131-148` wiring tripwire asserts the redactor symbol is present in all 4 production files + `redactRpcError` scrub test — both pass |

## Goal Achievement

The engine scaffold, adapters, four deterministic scorers, Claude tool-use synthesis, schema, canonicalize+keccak256 hash chain, CLI, and now a **190**-test suite all exist and pass. The deterministic and LLM steps are file-separated (`agent/src/dimensions/*` vs `agent/src/claude/*`) AND — the key fix — the deterministic separation is now **preserved in the hashed output artifact**: the published per-dimension numbers are the engine's, not the LLM's. The default (no `--block`) live path now resolves one concrete head and pins reads, `ingest_block`, citations, prices, and `generated_at` to that same block.

What remains is genuinely human-only: two live-API checks that need a real `ANTHROPIC_API_KEY` (subjective citation-rigor eyeball for SC-3, and a live two-run hash diff). The code that makes both pass is verified and mock-proven; only the live-model confirmation is pending. Per the status decision tree, a non-empty human-verification section means status is `human_needed`, not `passed`.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Engine ingests on-chain data (TVL/volatility, oracle config, collateral, holder/contract, verified source) for each subject | ✓ VERIFIED | 3 adapters (usdy/cmeth/fbtc.ts) batch ERC-20 + paused + owner via `multiread` → `SubjectFacts` grouped into 4 dimensions; static facts versioned (1.0.0). Provenance is now faithful: `ingest_block` and every `Fact.source.blockNumber` carry the resolved concrete block (CR-02 fix), proven by 3 runtime adapter tests. |
| SC-2 | Four deterministic scoring modules each emit 0-100 per subject, implemented as code separate from the LLM step | ✓ VERIFIED | 4 scorers file-separated from `claude/`; `dimensions/synthesize.ts` computes overall/grade/confidence deterministically. **CR-01 fix:** `claude/synthesize.ts` now REBUILDS `dimensions[]` from the engine `BandResult`s (score/band_hit/missing_facts), discarding Claude's numbers. Proven inverse-of-mock test `[2-04-02e]`: engine 85/62/50/41 → doc shows 85/62/50/41 (not Claude's 70). The deterministic-vs-LLM separation now holds in the published, hashed artifact. |
| SC-3 | Claude synthesizes 4 scores into a letter grade (AAA-D) + per-dimension cited rationale, every claim naming a specific data point | ⚠️ PARTIAL — human eyeball pending | Forced tool-use (`tool_choice {type:tool,name:submit_rating}`), grade/confidence engine-overridden, prompt wraps facts in `<facts>` and demands `[N]` citations, `validateCitations` rejects fabricated addresses (test passes). "Every claim names a specific data point (no generic statements)" + "distinguishable grade mix" need a live-run eyeball — auto-skipped in CI/worktree (02-05 Task 2-05-03). Routed to human verification. |
| SC-4 | Engine invokable locally for any subject, returns complete reasoning JSON matching the agreed schema | ✓ VERIFIED (code) — live determinism eyeball pending | `rate()` + `pnpm rate <SUBJECT>` produce schema-valid JSON for all 3 subjects (190 tests). **CR-02 fix:** default path resolves one concrete head and stamps it everywhere (no `ingest_block:0`). **CR-04 fix:** `generated_at` derives from `getBlock({ blockNumber })` at the SAME ingest block (no second `latest`). **CR-01 fix:** dimension scores are engine-deterministic. The doc is now deterministic by construction on the live path; final live two-run hash diff is routed to human verification. |

**Score:** 4/4 success criteria code-verified. SC-2 and SC-4 are FULLY closed at the code+test level (was FAILED). SC-3 and SC-4 each carry one live-API human item (citation-rigor eyeball; live two-run determinism diff).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `agent/src/constants/grade-enum.ts` | uint8 mirror of GradeEnum.sol | ✓ VERIFIED | (unchanged) AAA=0..D=9 |
| `agent/src/schema.ts` | zod ReasoningDocument, on-chain bounds | ✓ VERIFIED | (unchanged) grade.uint8 0..9, confidence ≤100, chain_id 5000, dimensions length 4 |
| `agent/src/subjects/{usdy,cmeth,fbtc}.ts` | per-subject adapters, block-pinned | ✓ VERIFIED | **CR-02 fix:** `resolveBlockNumber(blockNumber)` resolves head once; `resolvedBlockNumber` threaded into `multiread()` + `ingestBlock`; no `: 0` default. 3 runtime tests prove the resolved head is stamped. |
| `agent/src/multicall.ts` | multiread, allowFailure → missing_facts | ✓ VERIFIED | **CR-03 fix:** `publicClient.multicall` wrapped in try/catch → `redactRpcError` at the RPC boundary. |
| `agent/src/dimensions/{4 scorers}.ts` + `synthesize.ts` | banded 0-100 scorers + 25% combine | ✓ VERIFIED | (unchanged) deterministic numbers computed AND now bound into the published doc (via CR-01 fix in claude/synthesize.ts). |
| `agent/src/claude/synthesize.ts` | forced tool-use, engine overrides | ✓ VERIFIED | **CR-01 fix:** rebuilds `dimensions[]` from engine `BandResult`s in canonical order; rejects dropped/duplicated keys; only rationale+citations from Claude. |
| `agent/src/claude/prompt.ts` | facts in `<facts>` tags, citation demand | ✓ VERIFIED | (unchanged) sanitizes C0 controls, wraps `<facts>`, demands `[N]` cites |
| `agent/src/hash.ts` | canonicalize + keccak256 | ✓ VERIFIED | (unchanged) RFC 8785 JCS + keccak256(toBytes(...)) |
| `agent/src/rate.ts` | orchestrator + validateCitations | ✓ VERIFIED | **CR-04 fix:** `getBlockTimestampSeconds(BigInt(facts.ingestBlock))` reads `getBlock({ blockNumber })`; **CR-03:** wrapped in `redactRpcError`. Full pipeline wired. |
| `agent/src/cli.ts` | pnpm rate, 3 subjects, --mock/--block | ✓ VERIFIED | **CR-03 fix:** catch routes `e.message` through `redactRpcUrl` before stderr. Allow-list enforced. |
| `agent/src/rpc.ts` | publicClient + redactRpcUrl | ✓ VERIFIED | **CR-02/CR-03 fix:** adds `resolveBlockNumber()` (head-resolve, redacted) + `redactRpcError()` wiring helper; redactor now called by production sites. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| rate.ts deterministic BandResults | doc.dimensions[].score / band_hit / missing_facts | engine rebuild in claude/synthesize.ts | ✓ WIRED (CR-01) | `synthesize.ts:218-254` keys BandResults into the published doc; Claude's dimension numbers discarded |
| adapters | resolved concrete block | resolveBlockNumber → multiread + ingestBlock | ✓ WIRED (CR-02) | one head resolved, same value threaded to reads + stamp; no `:0` default |
| rate.ts | getBlock({ blockNumber }) at ingestBlock | getBlockTimestampSeconds(bigint) | ✓ WIRED (CR-04) | timestamp pinned to the ingest block, not a fresh latest |
| cli.ts / multicall.ts / rate.ts / rpc.ts | redactRpcUrl / redactRpcError | error-path redaction | ✓ WIRED (CR-03) | redactor CALLED at all 4 production sites; tripwire test guards regression |
| claude/synthesize.ts | schema.ts | ReasoningDoc.safeParse + final parse | ✓ WIRED | parse + re-parse present |
| hash.ts | viem.keccak256 + canonicalize | computeReasoningHash chain | ✓ WIRED | exact chain present |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| reasoning doc `dimensions[].score` | doc.dimensions | engine BandResult (rebuilt in synthesize.ts) | engine-deterministic, NOT the LLM's | ✓ FLOWING (CR-01) |
| reasoning doc `ingest_block` | facts.ingestBlock | adapter, resolved concrete block | reads + stamps the same resolved head | ✓ FLOWING (CR-02) |
| reasoning doc `generated_at` | blockTimestampSeconds | getBlock({ blockNumber }) at ingestBlock | timestamp of the exact ingest block | ✓ FLOWING (CR-04) |
| reasoning doc `grade` / `confidence` | det.letter/uint8/confidence | engine synthesize() override | engine deterministic | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript strict typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full test suite | `npx vitest run` | 22 files, 190 tests passed | ✓ PASS |
| CR-01 engine-bound dimensions | `vitest run tests/claude.mock.test.ts -t "engine, not Claude"` (3 cases) | engine 85/62/50/41 published over Claude's 70; canonical order on shuffle; throws on dup/drop | ✓ PASS |
| CR-02 resolved-head stamp (×3 adapters) | `vitest run tests/subjects/{usdy,cmeth,fbtc}.test.ts -t "never 0"` | `ingestBlock === 88_000_000`, multiread got the resolved block | ✓ PASS |
| CR-03 redactor wiring tripwire | `vitest run tests/subjects/static.test.ts -t "funnels errors through the redactor"` | redactor present in all 4 production files | ✓ PASS |
| No `: 0` default in adapters | grep `subjects/*.ts` | zero matches | ✓ PASS |
| No `getBlock({})` (latest) in src | grep `src/**` | only in a comment; actual call is `getBlock({ blockNumber })` | ✓ PASS |
| Live rating end-to-end | `pnpm rate USDY --block N` (real keys) | not run — no ANTHROPIC_API_KEY in env | ? SKIP — routed to human verification |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| REQ-01 | 02-01, 02-03, 02-04, 02-05 | Rating engine pipeline; deterministic scoring SEPARATED from LLM (CON-deterministic-vs-llm-separation); evidence-cited rationale | ✓ SATISFIED (engine-side) | Pipeline + file separation present AND the deterministic separation is now preserved in the hashed output (CR-01 closed). Citation enforcement present; rigor eyeball is a human item. Publish (IPFS + publishRating) is Phase 3 scope by design. |
| REQ-05 | 02-02, 02-05 | Three Mantle RWA subjects rated (engine-side) | ✓ SATISFIED (engine-side) | USDY/cmETH/FBTC adapters at the 3 locked addresses, chain 5000; `pnpm rate` works per subject. On-chain `RatingPublished` is Phase 3 scope per CONTEXT boundary. |

No orphaned requirements: REQUIREMENTS.md maps exactly REQ-01 and REQ-05 to Phase 2; both are declared in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TODO/FIXME/PLACEHOLDER markers in `agent/src`; no `: 0` default in adapters; no `getBlock({})` call | — | All 4 prior blockers' anti-patterns are removed |

The 4 prior 🛑 Blocker anti-patterns (synthesize `...parsed` dimension pass-through, adapter `: 0`, raw `e.message` to stderr, `getBlock({})` latest) are all gone. The prior ⚠️ "no-latest-leak is source-grep only" warning is now superseded: 3 genuine **runtime** adapter tests exercise the default-block path and assert the resolved head is stamped (never 0) — the grep tripwire remains as a complementary guard.

### Human Verification Required

1. **Live citation-rigor eyeball (SC-3)** — run `pnpm rate USDY/cmETH/FBTC --block <recent>` with real `ANTHROPIC_API_KEY` + `MANTLE_RPC_URL`; confirm every dimension rationale names a specific data point (no generic statements) and grades show a distinguishable mix. (Auto-skipped during execution per 02-05 Task 2-05-03.)
2. **Live two-run determinism (SC-4 / T-2-06)** — run the same `--block N` twice live and diff `reasoningHash`; expect byte-identical. The code that guarantees this (engine-bound dimensions + pinned block + pinned timestamp) is now verified and mock-proven; live-model confirmation needs a real API key.

### Gaps Summary

No blocking gaps remain. All four CRITICAL determinism/security blockers from 02-REVIEW.md are independently confirmed closed against the live source and the live test suite (re-run this pass: 190/190 green, tsc exit 0):

1. **CR-01 (was SC-2 fail)** — `claude/synthesize.ts` now rebuilds `dimensions[]` from the engine's deterministic `BandResult`s in canonical key order, discarding Claude's per-dimension numbers and rejecting dropped/duplicated keys. Inverse-of-mock test `[2-04-02e]` proves the doc carries engine scores (85/62/50/41), not Claude's hard-coded 70. CON-deterministic-vs-llm-separation now holds in the hashed artifact.
2. **CR-02 + CR-04 (were SC-4 fail)** — `resolveBlockNumber()` resolves the head once; the same concrete block is threaded into reads, `ingest_block`, citations, prices, AND `generated_at` (via `getBlock({ blockNumber })`). No `ingest_block:0`-while-reading-latest path remains; no second `latest` snapshot for the timestamp. 3 runtime adapter tests assert the resolved head is stamped (never 0).
3. **CR-03 (security)** — `redactRpcError`/`redactRpcUrl` are now CALLED at all four production boundaries (multicall.ts, rate.ts, rpc.ts, cli.ts), guarded by a wiring tripwire test so the leak cannot silently regress to zero call sites.

The only items outstanding are inherently human/live-API: the SC-3 citation-rigor eyeball and the SC-4 live two-run hash diff, both requiring a live `ANTHROPIC_API_KEY`. Because the human-verification section is non-empty, the status is `human_needed` (automated checks pass, live testing pending) rather than `passed`. Nothing here blocks proceeding to plan Phase 3 in parallel — the engine contract Phase 3/4 consume is now correct and deterministic by construction.

---

_Verified: 2026-06-10T12:25:00Z_
_Verifier: Claude (gsd-verifier)_
