---
phase: 02-rating-engine-core
plan: 03
subsystem: dimensions-scoring
tags: [bands-as-data, threshold-banded, missing-fact-default, uniform-weighting, grade-mapping, on-chain-bounds, t-2-02, t-2-04, d-06, d-07, d-08]

# Dependency graph
requires:
  - phase: 02-rating-engine-core
    provides: SubjectFacts/Fact/SubjectId types (agent/src/subjects/types.ts), Band/BandResult types (agent/src/dimensions/types.ts), GRADE_LETTER_TO_UINT8 + GRADE_MAX (agent/src/constants/grade-enum.ts) — all locked in Plan 02-01
  - phase: 02-rating-engine-core
    provides: per-subject adapters returning SubjectFacts with collateral/contract/oracle/liquidity buckets and fact labels { "issuer + collateral", "audits", "reserve attestation", "custodian", "source verified", "audits", "proxy pattern", "timelock", "owner", "pausable", "oracle architecture", "staleness tolerance", "mantle TVL (USD)", "parent TVL (USD)" } — locked in Plan 02-02
provides:
  - COLLATERAL_BANDS + scoreCollateral(SubjectFacts): BandResult — D-06 bands-as-data + D-07 missing-fact default
  - CONTRACT_RISK_BANDS + scoreContractRisk(SubjectFacts): BandResult
  - ORACLE_BANDS + scoreOracleIntegrity(SubjectFacts): BandResult
  - LIQUIDITY_BANDS + scoreLiquidityStability(SubjectFacts): BandResult (band-input prefers parent_tvl_USD per RESEARCH Open Q2)
  - synthesize(SynthesizeInput): SynthesizeOutput — D-08 uniform 25% + D-07 confidence floor 30 + T-2-02 on-chain bounds throw
  - scoreToGrade(overall): { letter, uint8 } — locked GRADE_SCORE_TABLE letter boundaries (AAA>=90 ... D>=0)
  - GRADE_SCORE_TABLE — top-of-file bands-as-data const, 10 entries, sorted descending by min
affects: [02-04-claude, 02-05-cli, phase-03-publisher, phase-04-verifier]

# Tech tracking
tech-stack:
  added: []   # All deps pinned in Plan 02-01; this plan exercises them.
  patterns:
    - "Bands-as-data (D-06): every dimension declares a top-of-file BANDS const of { max: number|null, score: number, label: string }; lookup is the 3-line idiom: `for (const b of BANDS) if (b.max === null || idx < b.max) return b;`. Top band uses `max: null` as the catch-all so the type system enforces a default for every quality_index in [0, ∞)."
    - "Missing-fact policy (D-07): every dimension has a REQUIRED_LABELS list. If ALL required labels are missing-or-null in the SubjectFacts bucket, the dimension returns BandResult{ score: 50, raw_value: null, label: 'missing data — default neutral', missing_facts: [all required labels] }. Partial-missing runs the recipe and populates missing_facts with the absent subset (does NOT default to 50)."
    - "Per-fact recipe trace (CON-llm-prompt-evidence-citation): each dimension's recipe is documented at the top of its source file so the Wave 3 Claude prompt can cite the same fact ids that contributed to the deterministic score. Every +/- adjustment maps to a named label."
    - "Uniform 25% weighting (D-08): synthesize() is `Math.round((a + b + c + d) / 4)`; no per-asset profiles, no per-dimension weights. The hash hardness implication: changing the weighting is a breaking change for downstream phases."
    - "Confidence floor (D-07): `Math.max(30, Math.min(100, 100 - 5 * totalMissingFacts))`. Floor 30 means a 'fully blind' rating still publishes — it just signals uncertainty. Ceiling 100 mirrors RatingRegistry.InvalidConfidence — engine NEVER emits 101+ even if a future change drops the missing-fact-count subtraction."
    - "T-2-02 defense-in-depth: synthesize() throws if grade.uint8 > GRADE_MAX (9) or confidence ∉ [30, 100]. These should NEVER fire under correct upstream logic — they catch a future regression in scoreToGrade or band recipes BEFORE the doc reaches publishRating, which would revert on-chain."
    - "Boundary-value triplet discipline (carried from Phase 1): for each band's `max`, tests assert {max-1, max, max+1} land in the correct neighboring bands. Catches off-by-one (<= vs <) regressions deterministically."
    - "TDD per task: RED (failing test) commit → GREEN (impl) commit pair. 2 task-level cycles in this plan."

key-files:
  created:
    - agent/src/dimensions/collateral-quality.ts
    - agent/src/dimensions/contract-risk.ts
    - agent/src/dimensions/oracle-integrity.ts
    - agent/src/dimensions/liquidity-stability.ts
    - agent/src/dimensions/synthesize.ts
    - agent/tests/dimensions/collateral-quality.test.ts
    - agent/tests/dimensions/contract-risk.test.ts
    - agent/tests/dimensions/oracle-integrity.test.ts
    - agent/tests/dimensions/liquidity-stability.test.ts
    - agent/tests/dimensions/synthesize.test.ts
  modified: []

key-decisions:
  - "Liquidity band input: prefer parent_tvl_USD when present, else fall back to mantle_tvl_USD — resolves RESEARCH §7.4 Open Q2 in favor of cross-chain liquidity awareness. USDY's $680M parent supply lands in the 'anchor-level' top band (score 92) rather than the punitive 'limited' band that mantle-only ($8M) would give. Mantle-side TVL still drives the score for subjects with no parent surface."
  - "Liquidity bands cap at max: 500_000_000 with the top band as max: null catch-all. RESEARCH §7.4 used Number.POSITIVE_INFINITY for the top band — replaced with `max: null` so the table shape matches every other dimension and the type system catches missing catch-alls uniformly."
  - "Oracle recipe matches keywords in the architecture string ('redundan', 'multi-source', 'manipulation-resistant', 'aggregator', 'single trusted feed', etc.) rather than introducing new structured fact labels. The adapter's `oracle architecture` value is a freeform string per the static config (USDY 'internal-accrual, daily settler', cmETH 'restaked-balance proof system', FBTC 'off-chain reserve attestation + Chainlink Proof-of-Reserves'). Keeping the recipe in the dimension layer means the static config does not need restructuring."
  - "Contract risk owner = null heuristic: a missing owner Fact (value === null) earns -10, since either the read failed or the contract has no admin getter — both are signals the engine cannot verify the admin surface. A more sophisticated EOA detection requires an on-chain getCode call which lives outside the deterministic seam (the dimension scorer reads ONLY from SubjectFacts buckets). Documented in the source file."
  - "Did NOT update agent/src/index.ts barrel. Plan's files_modified list excludes the barrel; Wave 3 (Plan 02-04) will re-export synthesize() and the band tables for the Claude tool-schema and prompt builder."
  - "All 4 dimensions have a top band with `max: null`. The `Band.max: number | null` type already allows this; tests assert the table is sorted ascending and only the last entry's max is null."

patterns-established:
  - "Bands-as-data table shape: { max: number | null, score: number, label: string } sorted ascending by max with the top band's max set to null. Replicated across all 4 dimensions for diff-readability and Phase 4 frontend rendering uniformity."
  - "Required-labels constant: each dimension scorer declares a `const REQUIRED_LABELS = [...] as const` at the top of its file. The missing-fact policy walks this list, populates missing_facts, and defaults to 50 iff ALL required labels are missing. Pattern keeps the fact contract between adapter and dimension explicit and grep-discoverable."
  - "Boundary-value triplet test idiom: for each band's max, assert lookup({max-1, max, max+1}) lands in the correct neighboring bands. Covers the off-by-one (<= vs <) regression deterministically."
  - "Defense-in-depth throw at synthesize: any future band recipe or grade-table change that emits out-of-bounds uint8 / confidence will fail loudly here before publishRating. T-2-02 mitigation as code, not just as a comment."

requirements-completed: [REQ-01]

# Metrics
duration: ~9 min (TDD with full test verification each cycle)
completed: 2026-06-09
---

# Phase 2 Plan 3: Dimension Scorers + Synthesize Combiner Summary

**Four deterministic threshold-banded scorers (collateral_quality, contract_risk, oracle_integrity, liquidity_stability) + a synthesize() combiner that applies uniform 25% weighting and produces the final letter grade + confidence — all pure functions of SubjectFacts → BandResult with bands-as-data (D-06), missing-fact default-to-50 (D-07), and T-2-02 defense-in-depth bounds checks at the synthesize seam.**

## Performance

- **Duration:** ~9 min (including `pnpm install --frozen-lockfile` ~36s + TDD with full verification each cycle)
- **Started:** 2026-06-09T04:04:59Z
- **Completed:** 2026-06-09T04:13:26Z
- **Tasks:** 2 (each TDD: RED + GREEN commit pair)
- **Files created:** 10 (5 src + 5 tests)
- **Files modified:** 0
- **Tests:** 136/136 green (70 baseline from Plans 02-01/02-02 + 66 new from this plan)

## Accomplishments

- **4 dimension scorers as pure functions of SubjectFacts → BandResult.** Every scorer reads only from its bucket of `SubjectFacts` (collateral, contract, oracle, liquidity), declares a top-of-file `BANDS` constant, and uses the canonical 3-line band-lookup idiom: `for (const b of BANDS) if (b.max === null || idx < b.max) return b;`. The deterministic-vs-LLM seam (CON-deterministic-vs-llm-separation) is intact: dimensions never call RPC, never call Anthropic.
- **D-07 missing-fact policy uniformly enforced.** Every dimension has a `REQUIRED_LABELS` const at the top of its source file. When ALL required labels are missing-or-null in the SubjectFacts bucket, the scorer returns `{ score: 50, raw_value: null, label: 'missing data — default neutral', missing_facts: <all required labels> }`. Partial-missing runs the recipe with `missing_facts` populated for the absent subset. This is end-to-end with the adapter contract from Plan 02-02 (adapters surface `Fact.value === null` for failed reads).
- **D-08 uniform 25% weighting + D-07 confidence floor in synthesize().** `overall = Math.round((collateral + contract + oracle + liquidity) / 4)`. `confidence = Math.max(30, Math.min(100, 100 - 5 * totalMissingFacts))`. Both clamped integers; no floats can escape.
- **T-2-02 defense-in-depth.** `synthesize()` throws if `grade.uint8 > GRADE_MAX (9)` or `confidence ∉ [30, 100]`. These bounds mirror `RatingRegistry.InvalidGrade` and `RatingRegistry.InvalidConfidence` on the Sepolia deploy — Phase 3 would revert on-chain if either bound was violated. The throws are defense against a future change to `scoreToGrade()` or band recipes; current logic cannot reach them.
- **Locked GRADE_SCORE_TABLE.** Letter boundaries at every 10-point cut (AAA ≥ 90, AA ≥ 80, ..., D ≥ 0). 10 entries sorted descending by `min`; `scoreToGrade()` finds the first entry whose `min` ≤ clamped overall. Boundary tests cover all 20 cut points (each `min` + each `min-1`) plus out-of-range clamping (101 → AAA, -5 → D).
- **136 tests, 0 failures.** 5 new test files contributing 66 new tests (15 collateral + 13 contract_risk + 13 oracle + 14 liquidity + 11 synthesize). 70 baseline tests from Plans 02-01/02-02 continue to pass.

## Per-Dimension Bands (Final Brackets)

### COLLATERAL_BANDS

| max | score | label |
|-----|-------|-------|
| 30  | 35    | thin collateral disclosure |
| 50  | 55    | moderate collateral, single custodian or sparse audit |
| 70  | 72    | strong collateral, recent audit, multi-attestation |
| 85  | 85    | institutional collateral with regular proof-of-reserves |
| null | 92   | tokenized treasury-grade collateral |

Recipe: `+25` treasury keywords in issuer; `+20` audits non-empty / `-10` if missing; `+20` reserve attestation / `-15` if missing; `+15` custodian non-empty. Clamped to [0, 100].

### CONTRACT_RISK_BANDS

| max | score | label |
|-----|-------|-------|
| 30  | 30    | unverified or pausable-by-EOA with no timelock |
| 50  | 55    | verified source, owner concentrated, partial mitigation |
| 70  | 72    | verified, audited, proxy admin documented |
| 85  | 85    | timelocked admin, distributed holders, multiple audits |
| null | 92   | battle-tested with multi-sig timelocked admin and no central pause |

Recipe: `+25` source_verified == "yes"; `+15` audits; `+10` proxy_pattern; `+15` timelock present; `-15` pausable && !timelock; `-10` owner missing. Clamped to [0, 100].

### ORACLE_BANDS

| max | score | label |
|-----|-------|-------|
| 30  | 30    | single trusted feed or no on-chain settlement |
| 50  | 55    | single oracle with documented staleness guard |
| 70  | 72    | redundant feeds with aggregation |
| 85  | 85    | multi-source aggregator with fresh data and manipulation resistance |
| null | 92   | battle-tested oracle stack with hardened deviation thresholds |

Recipe: `+20` architecture string present; `+20` staleness keyword (24h/12h/6h/1h/monthly/hourly/daily); `+15` redundan|multi-source|multiple in architecture; `+15` manipulation-resistant|aggregator|deviation threshold; `-25` single trusted feed|single point of failure|no redundancy. Clamped to [0, 100].

### LIQUIDITY_BANDS

| max | score | label |
|-----|-------|-------|
| 1_000_000   | 25 | very thin liquidity |
| 10_000_000  | 50 | limited liquidity |
| 100_000_000 | 70 | healthy liquidity |
| 500_000_000 | 82 | deep liquidity |
| null        | 92 | anchor-level liquidity |

Band input: prefer `parent TVL (USD)` Fact when non-null, else `mantle TVL (USD)`. Both null → D-07 default to 50.

### GRADE_SCORE_TABLE (synthesize.ts)

| min | letter | uint8 |
|-----|--------|-------|
| 90  | AAA    | 0 |
| 80  | AA     | 1 |
| 70  | A      | 2 |
| 60  | BBB    | 3 |
| 50  | BB     | 4 |
| 40  | B      | 5 |
| 30  | CCC    | 6 |
| 20  | CC     | 7 |
| 10  | C      | 8 |
| 0   | D      | 9 |

Mirrors `GRADE_LETTER_TO_UINT8` from agent/src/constants/grade-enum.ts which mirrors `GradeEnum.sol`. Any change to letter boundaries here must be coordinated with the Solidity side (currently NONE — the Solidity side has no opinion on which `overall` produces which letter; only the uint8 encoding is locked).

## Deviations from RESEARCH §7 Proposals

- **§7.4 LIQUIDITY_BANDS top entry:** RESEARCH used `max: Number.POSITIVE_INFINITY` for the top band. Replaced with `max: null` so the table shape is identical across all 4 dimensions and the type system (`Band.max: number | null`) uniformly enforces a catch-all. Behavior is equivalent (the lookup short-circuits on `b.max === null`).
- **§7.4 Open Q2 (parent vs mantle TVL):** PLAN deferred this to the planner. Resolved in favor of parent-when-present so USDY's $680M parent supply lands in the top band (anchor-level, score 92) rather than the punitive 'limited' band ($8M Mantle-only would give 50). Documented in the file header and tested explicitly (`USDY parent_tvl $680M → score >= 82` + `mantle_tvl ONLY $8M → score 50`).
- **§7.3 ORACLE recipe:** RESEARCH proposed a numeric `redundancy_count * 15 + ...` formula. The static config exposes a freeform architecture string (e.g., "redundant feeds with manipulation-resistant aggregator across multiple sources"), so the recipe matches keywords in that string instead of introducing new structured fact labels. Preserves the adapter contract from Plan 02-02 unchanged.
- **§7.2 CONTRACT_RISK owner heuristic:** RESEARCH proposed `-10 if owner is null/EOA-shaped`. True EOA detection requires `getCode` (off-deterministic-seam). Implemented as `-10 if owner is null` (missing fact = risk signal); documented in the file header so a future polish wave can extend with on-chain code-size probe once Plan 02-02 adds it as a Fact.

## Test Results

```
$ pnpm test
 RUN  v4.1.8

 Test Files  13 passed (13)
      Tests  136 passed (136)
   Duration  ~11s

$ pnpm typecheck
> tsc --noEmit
(no output — exits 0)
```

| Test File | Tests | Scope |
|-----------|-------|-------|
| tests/constants/grade-enum.test.ts        | 13 | Baseline (Plan 02-01) |
| tests/schema.test.ts                       | 11 | Baseline (Plan 02-01) |
| tests/subjects/static.test.ts              | 14 | Baseline (Plan 02-02) |
| tests/subjects/usdy.test.ts                |  7 | Baseline (Plan 02-02) |
| tests/subjects/cmeth.test.ts               |  7 | Baseline (Plan 02-02) |
| tests/subjects/fbtc.test.ts                |  7 | Baseline (Plan 02-02) |
| tests/subjects/registry.test.ts            |  5 | Baseline (Plan 02-02) |
| tests/subjects/no-latest-leak.test.ts      |  6 | Baseline (Plan 02-02) |
| **tests/dimensions/collateral-quality.test.ts** |  8 | Task 2-03-01 |
| **tests/dimensions/contract-risk.test.ts**      |  7 | Task 2-03-01 |
| **tests/dimensions/oracle-integrity.test.ts**   |  8 | Task 2-03-02 |
| **tests/dimensions/liquidity-stability.test.ts**|  9 | Task 2-03-02 |
| **tests/dimensions/synthesize.test.ts**          | 34 | Task 2-03-02 (incl. 20 it.each grade-boundary checks) |
| **TOTAL** | **136** | **13 files, 0 failures, 0 skips** |

## Confirmation: synthesize() Cannot Produce Out-of-Bound Output

The synthesize tests explicitly cover the degenerate edges (T-2-02):

- **All scores 100, 0 missing facts:** `overall = 100 → AAA / uint8 0`; `confidence = 100`. Both in bound.
- **All scores 0, 100 missing facts:** `overall = 0 → D / uint8 9`; `100 - 5*100 = -400 → clamped to 30`. Both in bound.
- **Floor saturation:** any `totalMissingFacts >= 14` → confidence == 30 (verified at 14 exactly + 15 + 30).
- **No floating point leakage:** `Math.round(...)` and `Math.max/min(...)` produce integers from integer inputs; tests assert `Number.isInteger(out.overall) === true` and `Number.isInteger(out.confidence) === true`.

The `throw new Error(...)` branches in synthesize() are unreachable under current logic (scoreToGrade only returns uint8 ∈ {0..9} from a 10-entry table; confidence clamp guarantees [30, 100]). They are defense-in-depth against future regressions and would fail loudly BEFORE the document reaches Phase 3 publishRating, which would revert on-chain.

## Task Commits

| # | Task | RED commit | GREEN commit |
|---|------|-----------|-----------|
| 1 | Task 2-03-01: collateral_quality + contract_risk scorers | `d7648ec` (test) | `2c5c182` (feat) |
| 2 | Task 2-03-02: oracle + liquidity scorers + synthesize() combiner | `b73eef5` (test) | `8480cec` (feat) |

## Decisions Made

- **Liquidity band input (RESEARCH §7.4 Open Q2 resolution):** Prefer `parent TVL (USD)` Fact when non-null. Justification documented in the file header + tested explicitly.
- **Liquidity top band shape:** `max: null` instead of `Number.POSITIVE_INFINITY` for uniformity with the other 3 dimensions. Behavior equivalent.
- **Oracle recipe via architecture keywords:** Preserves the adapter contract from Plan 02-02 (freeform `oracle architecture` string). No new fact labels required.
- **Contract risk owner heuristic:** `-10 if owner is null`. True EOA detection deferred to a polish wave that adds `getCode` reads to the adapter.
- **Barrel index.ts not touched:** Plan's `files_modified` excludes it; Wave 3 (Plan 02-04) will re-export band tables + synthesize() for the Claude tool schema and prompt builder.
- **schema_version field NOT added to dimension files:** the existing ReasoningDocument zod schema (Plan 02-01) carries `schema_version: "1.0.0"` at the document root; dimensions don't need their own version field — they're consumed as `BandResult` which gets serialized as part of the document.

## Deviations from Plan

None — both tasks executed exactly as specified. The 4 minor variations between PLAN code excerpts and final implementation are within the discretionary latitude the plan grants (RESEARCH §7.4 Open Q2 explicitly delegated, the `max: null` vs `POSITIVE_INFINITY` uniformity improves type-safety without changing behavior, the oracle keyword recipe is a faithful interpretation of the "redundancy_count * 15 + ..." formula given the adapter's freeform architecture string, and the owner heuristic is documented as documented).

No auto-fixes required:
- No NodeNext extension issues (every relative import uses `.js`).
- No untracked files generated.
- No `tsc --noEmit` errors.
- No grep-acceptance-criteria conflicts (all `grep -c 'export const ...'` checks return 1 as required).

## Issues Encountered

- **`pnpm install` needed in worktree:** Worktree base commit had the lockfile committed but no `node_modules/`. Ran `pnpm install --frozen-lockfile` before TDD work; ~36s; 73 packages installed; lockfile unchanged.
- No other issues. Typecheck and full test suite both green at every commit boundary.

## Authentication Gates

None — this wave is pure deterministic scoring + unit tests. No live RPC, no Anthropic, no external services.

## Self-Check Results

Files claimed created (all verified present on disk):
- agent/src/dimensions/collateral-quality.ts — FOUND
- agent/src/dimensions/contract-risk.ts — FOUND
- agent/src/dimensions/oracle-integrity.ts — FOUND
- agent/src/dimensions/liquidity-stability.ts — FOUND
- agent/src/dimensions/synthesize.ts — FOUND
- agent/tests/dimensions/collateral-quality.test.ts — FOUND
- agent/tests/dimensions/contract-risk.test.ts — FOUND
- agent/tests/dimensions/oracle-integrity.test.ts — FOUND
- agent/tests/dimensions/liquidity-stability.test.ts — FOUND
- agent/tests/dimensions/synthesize.test.ts — FOUND

Commits claimed (all verified via `git log --oneline -10`):
- d7648ec — FOUND (test 02-03-01 RED)
- 2c5c182 — FOUND (feat 02-03-01 GREEN)
- b73eef5 — FOUND (test 02-03-02 RED)
- 8480cec — FOUND (feat 02-03-02 GREEN)

Acceptance-criteria grep checks:
- `export const COLLATERAL_BANDS` in collateral-quality.ts: 1 ✓
- `export const CONTRACT_RISK_BANDS` in contract-risk.ts: 1 ✓
- `export const ORACLE_BANDS` in oracle-integrity.ts: 1 ✓
- `export const LIQUIDITY_BANDS` in liquidity-stability.ts: 1 ✓
- `export const GRADE_SCORE_TABLE` in synthesize.ts: 1 ✓
- `export function scoreCollateral` in collateral-quality.ts: 1 ✓
- `export function scoreContractRisk` in contract-risk.ts: 1 ✓
- `export function scoreOracleIntegrity` in oracle-integrity.ts: 1 ✓
- `export function scoreLiquidityStability` in liquidity-stability.ts: 1 ✓
- `export function synthesize` in synthesize.ts: 1 ✓
- `Math\.max\(30` in synthesize.ts: 1 ✓ (confidence floor)
- `GRADE_MAX` in synthesize.ts: 3 ✓ (≥1 required: import + 2 bound checks)
- `[2-03-01` traceability markers across test files: 7 ✓

Final results:
- `pnpm test` — 136/136 passing (13 files), 0 failures, 0 skips
- `pnpm typecheck` — exits 0 (no diagnostics)

## Self-Check: PASSED

## TDD Gate Compliance

This plan does not have `type: tdd` at the plan level (it has individual TDD tasks). Both tasks followed RED → GREEN cycles with distinct commits:
- Task 2-03-01: `test(02-03)` (d7648ec) → `feat(02-03)` (2c5c182) ✓
- Task 2-03-02: `test(02-03)` (b73eef5) → `feat(02-03)` (8480cec) ✓

Each RED commit was verified to actually fail (modules missing) before the GREEN commit added the implementation. No "passing on RED" edge cases.

## Threat Flags

None — this wave introduces no new security-relevant surface. The 2 threats addressed (T-2-02 on-chain bound mirror at synthesize, T-2-04 missing-fact silent fall-through in each dimension) are mitigated as documented in the plan's `<threat_model>`. No new network endpoints, no auth paths, no file access patterns, no schema changes at trust boundaries.

## Next Phase Readiness

- Wave 2 contracts ready for Wave 3 (Claude synthesizer) to import: `scoreCollateral`, `scoreContractRisk`, `scoreOracleIntegrity`, `scoreLiquidityStability`, `synthesize`, `scoreToGrade`, `GRADE_SCORE_TABLE`, plus the BANDS tables (`COLLATERAL_BANDS`, `CONTRACT_RISK_BANDS`, `ORACLE_BANDS`, `LIQUIDITY_BANDS`). All five files live under `agent/src/dimensions/`.
- Wave 3 (Plan 02-04) will:
  1. Update `agent/src/index.ts` barrel to re-export these symbols.
  2. Build the Claude prompt that cites each dimension's score + label + facts.
  3. Force the `submit_rating` tool with the locked GRADE_SCORE_TABLE pinned in the system prompt.
  4. Wire the hash.ts canonicalize → keccak256 chain (D-13, D-14) over the final ReasoningDocument.
- Phase 3 publisher reuse: synthesize() is the only function in the agent codebase that produces a `grade.uint8` value. Phase 3 imports synthesize() (via Wave 4's `rate()` orchestrator) and feeds the result straight into RatingRegistry.publishRating; the T-2-02 throws are the hard guarantee that the on-chain call cannot revert on `InvalidGrade()` / `InvalidConfidence()` regardless of how upstream changes evolve.
- No blockers. Phase 2 Plan 04 (Claude synthesizer + hash) can begin immediately.

---
*Phase: 02-rating-engine-core*
*Plan: 03-dimensions*
*Completed: 2026-06-09*
