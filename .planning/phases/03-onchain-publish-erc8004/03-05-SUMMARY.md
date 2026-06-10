---
phase: 03-onchain-publish-erc8004
plan: 05
subsystem: testing
tags: [historical-proof, elixir-deusd, fixtures, rating-engine, vitest, REQ-06]

# Dependency graph
requires:
  - phase: 02-rating-engine-core
    provides: the 4 deterministic dimension scorers (collateral/contract/oracle/liquidity) + synthesize() + GRADE_LETTER_TO_UINT8, all reused UNCHANGED
provides:
  - Elixir deUSD pre-failure SubjectFacts fixture (HistoricalFacts) encoding the 4 documented red flags with per-fact provenance
  - the UNMODIFIED engine's grade for the fixture (B / uint8=5 / overall=44, confidence 70)
  - a captured deterministic graded artifact (agent/out/historical/elixir-deusd.json) for Phase 4 to render
  - an engine FINDING: the deterministic TVL-band liquidity scorer does not penalize the claimed-vs-actual TVL gap or the yield anomaly
affects: [phase-04, historical-timeline, frontend-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HistoricalFacts type mirrors SubjectFacts with a disjoint HistoricalSubjectId ('deUSD') so historical fixtures stay OUT of the live SubjectId union / getAdapter() / cli allow-list"
    - "facts-only curated fixture rated by the UNMODIFIED engine — no special-casing (D-04, Pitfall 5)"
    - "deterministic graded artifact captured via a dedicated one-shot script (pnpm capture-elixir), persisted in git despite agent/out/ being otherwise ignored"

key-files:
  created:
    - agent/src/fixtures/types.ts
    - agent/src/fixtures/elixir-deusd.ts
    - agent/src/fixtures/capture-elixir.ts
    - agent/tests/fixtures/elixir.test.ts
    - agent/out/historical/elixir-deusd.json
  modified:
    - agent/package.json
    - .gitignore

key-decisions:
  - "Encode honest $160M actual TVL (not the inflated $520M claim) as the liquidity figure; document the gap + yield anomaly in evidence — keeps the fixture truthful and surfaces the engine's blind spot rather than gaming it"
  - "Capture the artifact via a dedicated pnpm capture-elixir script (not the test) because the full vitest suite cleans agent/out/; the committed JSON is the persistent Phase-4 deliverable"
  - "Add a root-anchored Foundry /out/ rule + agent/out/* + !agent/out/historical/ so the curated artifact is tracked while live rating JSON stays ignored"

patterns-established:
  - "Historical-proof fixtures: HistoricalFacts (disjoint ticker) + facts-only + unmodified-engine grading + captured artifact under out/historical/"

requirements-completed: [REQ-06]

# Metrics
duration: ~25min
completed: 2026-06-10
---

# Phase 3 Plan 05: Elixir deUSD Historical Reconstruction (Start) Summary

**The UNMODIFIED Phase-2 engine grades the curated Elixir deUSD pre-failure fixture B (uint8=5, overall=44) — three of four dimensions in their worst band — purely from the four documented red flags, with zero special-casing, and the graded artifact is captured for Phase 4.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-10T20:18Z (approx)
- **Completed:** 2026-06-10T20:43Z
- **Tasks:** 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments
- Reconstructed the Elixir deUSD pre-failure state as a static `HistoricalFacts` fixture encoding the four red flags verbatim ($1.00 hardcoded xUSD oracle, 65% xUSD concentration + circular collateralization, private unlisted Morpho markets + 4.1x recursive leverage, $520M claimed vs $160M actual TVL + 12% yield premium), each fact carrying CBB0FE 2025-10-28 provenance.
- Proved the SAME unmodified engine that rates live Mantle subjects grades the fixture **B** (speculative) with NO `if (ticker === "deUSD")` branch anywhere in `agent/src/dimensions/` — the fixture's ticker is `deUSD` (not a live `SubjectId`), and the engine only works because it reads typed buckets, never the ticker.
- Captured the deterministic graded artifact (`agent/out/historical/elixir-deusd.json`) with grade + per-dimension band/score/reasoning citing each red flag, ready for Phase 4 to render the downgrade→failure timeline without computing live.
- Kept the fixture entirely OUT of the live rate path: not in the `SubjectId` union, `registry.ts`, or the `cli.ts` allow-list.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the Elixir deUSD SubjectFacts fixture** - `172770f` (feat)
2. **Task 2: Grade the fixture with the UNMODIFIED engine + capture the artifact** - `8fa4042` (feat)

_Note: Task 2 is the TDD task — see "TDD Gate Compliance" below._

## Files Created/Modified
- `agent/src/fixtures/types.ts` - `HistoricalFacts` type mirroring `SubjectFacts` with a disjoint `HistoricalSubjectId = "deUSD"` so the fixture never widens the live `SubjectId` union.
- `agent/src/fixtures/elixir-deusd.ts` - `ELIXIR_DEUSD` pre-failure snapshot: four dimension buckets mapping the four red flags, each via an `elixirFact()` static-Fact builder with per-fact CBB0FE 2025-10-28 provenance + a top-of-file timeline/sources comment block. Marked NOT-a-live-subject.
- `agent/src/fixtures/capture-elixir.ts` - one-shot (`pnpm capture-elixir`) that grades the fixture with the unmodified scorers + synthesize and writes the artifact; also exports `gradeElixir()`/`buildArtifact()` reused by the test.
- `agent/tests/fixtures/elixir.test.ts` - 8 tests: unmodified-engine grade assertion (B, uint8>=BB, overall 44), per-dimension worst-band proofs citing each flag, provenance coverage, and artifact-shape check.
- `agent/out/historical/elixir-deusd.json` - the captured graded artifact (committed deliverable for Phase 4).
- `agent/package.json` - added `capture-elixir` script.
- `.gitignore` - root-anchored Foundry `/out/`, `agent/out/*`, and `!agent/out/historical/` exception so the artifact is tracked while live rating JSON stays ignored.

## Decisions Made
- **Honest liquidity figure ($160M, not $520M):** encoded the actual user-deposit figure as `parent TVL (USD)` and documented the $520M-claimed-vs-$160M-actual gap + the 12% yield anomaly in the fact's evidence string. This keeps the fixture truthful and lets the engine's blind spot surface as a finding rather than inflating a number to force a worse grade (D-04 / Pitfall 5).
- **Dedicated capture script over test-write:** the full `pnpm test` run cleans `agent/out/`, so writing the artifact from the test would not persist it. `pnpm capture-elixir` produces the committed JSON; the test reads `buildArtifact()` in-memory (no on-disk dependency).
- **`.gitignore` exception** instead of relocating the artifact, keeping the natural `out/historical/` path Phase 4 expects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed agent dependencies + added esbuild-friendly capture path**
- **Found during:** Task 1 (typecheck) — the worktree had no `node_modules` (`tsc`/`vitest` unavailable).
- **Issue:** `pnpm typecheck` failed with "tsc is not recognized"; worktree was un-bootstrapped.
- **Fix:** Ran `pnpm install` in `agent/` (restores viem/zod/vitest/tsx/typescript). No dependency additions to `package.json`.
- **Files modified:** none committed (node_modules is gitignored).
- **Verification:** `pnpm typecheck` exit 0; full suite 199/199 green.
- **Committed in:** n/a (environment bootstrap).

**2. [Rule 3 - Blocking] `.gitignore` exception so the required artifact is committable**
- **Found during:** Task 2 (staging the artifact).
- **Issue:** `agent/out/` and the root `out/` (unanchored Foundry rule) both ignored `agent/out/historical/elixir-deusd.json`, but the artifact is a required REQ-06 deliverable that Phase 4 renders.
- **Fix:** Anchored the Foundry rule to `/out/`, switched `agent/out/` to `agent/out/*`, and added `!agent/out/historical/`. Verified live `agent/out/USDY/*.json` and root `out/*` remain ignored.
- **Files modified:** `.gitignore` (committed in Task 2).
- **Verification:** `git check-ignore` confirms historical=trackable, live out=ignored, root out=ignored.
- **Committed in:** `8fa4042` (Task 2 commit).

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking).
**Impact on plan:** Both were environment/packaging prerequisites for the planned deliverables. No scope creep; no engine or fixture logic changed to accommodate them.

## Findings (D-04 / Pitfall 5 — surfaced, NOT patched)

**ENGINE FINDING — the liquidity dimension does not catch the TVL gap or the yield anomaly.**
The unmodified engine scored the four dimensions:

| Dimension | Score | Band | Worst-band? |
|-----------|-------|------|-------------|
| oracle_integrity | 30 | "single trusted feed or no on-chain settlement" | yes (the $1.00 hardcoded feed triggers the -25 penalty) |
| collateral_quality | 35 | "thin collateral disclosure" | yes (65% concentration, no PoR/audit/custodian) |
| contract_risk | 30 | "unverified or pausable-by-EOA with no timelock" | yes (private unlisted markets, 4.1x leverage, no timelock) |
| liquidity_stability | 82 | "deep liquidity" | **NO — the finding** |

Overall `(35+30+30+82)/4 = 44` → grade **B** (uint8 5), confidence 70.

The `liquidity-stability` scorer bands purely on raw TVL size (it prefers the larger of parent/mantle TVL in USD). $160M actual deposits lands in the "deep liquidity" band (82), so the dimension does NOT penalize either the **$520M-claimed-vs-$160M-actual discrepancy** or the **anomalous 12% yield premium** — both of which were real pre-failure red flags. Per D-04 / Pitfall 5 this is recorded as a finding about the scorer, NOT papered over by inflating the fact or special-casing the engine. The other three dimensions caught their flags cleanly, and the overall **B** is already "low/deteriorating" (speculative-or-worse, >= BB). A future engine refinement (out of Phase 3 scope) could add a claimed-vs-actual-TVL or yield-anomaly sub-signal to the liquidity dimension; doing so would deepen the historical grade and would equally apply to live subjects (preserving the no-special-casing boundary).

## TDD Gate Compliance

Task 2 was marked `tdd="true"`. The four dimension scorers + `synthesize` are the Phase-2 engine and already existed (the whole point of the proof is that they are UNCHANGED), so there was no RED-on-new-engine step. Per the fail-fast rule, the test passes immediately because the feature (the engine) pre-exists and the fixture (Task 1) supplies valid facts — this is the documented "feature already exists" case, not a skipped RED. The single `feat(03-05)` commit (`8fa4042`) carries the test + the capture mechanism + the artifact together. No `if (ticker === "deUSD")` branch was introduced (`grep -rE 'elixir|deUSD' agent/src/dimensions/` is empty), which is the load-bearing invariant the proof depends on.

## Verification Results
- `cd agent && pnpm test elixir` — 8/8 green (unmodified engine grades the fixture; band recorded as B/uint8 5).
- `cd agent && pnpm typecheck` — exit 0.
- `cd agent && pnpm test` (full suite) — 199/199 green (Phase-2 baseline 191 + 8 new), no regression.
- `grep -rE 'elixir|deUSD' agent/src/dimensions/` — empty (no engine special-casing, Pitfall 5).
- `grep -c 'elixir' agent/src/subjects/registry.ts` — 0; `grep -F 'fixtures/elixir' agent/src/cli.ts` — empty (not in the live rate path).
- `agent/out/historical/elixir-deusd.json` — present, committed, contains grade + 4 per-dimension entries with red flags.

## Issues Encountered
- The full `pnpm test` suite cleans `agent/out/`, which deleted the freshly-captured artifact mid-run. Resolved by capturing via the dedicated `pnpm capture-elixir` script and committing the JSON (the committed copy is authoritative; the test no longer depends on the on-disk file).
- Worktree was not bootstrapped (no `node_modules`); resolved with `pnpm install` (no `package.json` dependency changes).

## User Setup Required
None - no external service configuration required for this plan (no on-chain, no IPFS, no secrets).

## Next Phase Readiness
- The graded artifact at `agent/out/historical/elixir-deusd.json` is the fixed, deterministic input Phase 4 renders for the downgrade→failure timeline (engine's B grade at the 2025-10-28 pre-failure snapshot → actual collapse 2025-11-03..06). Persuasion is in the ordering: downgrade first, failure second.
- The recorded ENGINE FINDING (liquidity scorer ignores the TVL gap / yield anomaly) is flagged for the user — a candidate post-Phase-3 engine refinement, deferred per D-04 discipline.
- No blockers. The fixture and artifact are self-contained and do not touch the live on-chain publish path (Plans 03-01..03-04/03-06).

## Self-Check: PASSED

All claimed files exist on disk (5 created + SUMMARY) and both task commits (`172770f`, `8fa4042`) are present in the git log.

---
*Phase: 03-onchain-publish-erc8004*
*Completed: 2026-06-10*
