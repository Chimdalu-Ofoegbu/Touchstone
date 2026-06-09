---
phase: 02-rating-engine-core
plan: 02
subsystem: subjects-ingest
tags: [viem, multicall3, mantle-mainnet, block-pinning, allowfailure, missing-facts, static-facts, hash-determinism, rpc-redaction, t-2-03, t-2-07]

# Dependency graph
requires:
  - phase: 02-rating-engine-core
    provides: SubjectId / Fact / SubjectFacts types (agent/src/subjects/types.ts), STATIC_VERSION via Fact.source convention, vitest harness, NodeNext .js extension discipline, root .env loading
  - phase: 01-lock-skeleton
    provides: locked subject addresses on Mantle Mainnet (DEC-subject-set-locked — USDY 0x5be...c5A6, cmETH 0xE68...e8fA, FBTC 0xC96...C364)
provides:
  - publicClient bound to Mantle Mainnet (chain 5000) via viem mantle chain export with retryCount 2 / timeout 15s / batched multicall (D-02, D-05)
  - multiread(reads, blockNumber?) helper that wraps client.multicall with allowFailure path (D-03 batching + D-04 block-pinning + D-07 missing-fact surface)
  - redactRpcUrl(message) helper scrubbing MANTLE_RPC_URL out of error messages (T-2-03 mitigation)
  - STATIC_VERSION = "1.0.0" lock + STATIC record for USDY/cmETH/FBTC + staticFact() helper that emits Fact{source.kind:"static", file, version}
  - PRICES table + priceAtBlock(block) — block-range-keyed BTC/ETH/MNT USD prices for hash determinism (no live price API at rating time)
  - fetchUsdy / fetchCmeth / fetchFbtc — per-subject adapters returning typed SubjectFacts with collateral/contract/oracle/liquidity buckets
  - ADAPTERS map + getAdapter(SubjectId) — dispatch with throw-on-unknown (T-2-07 mitigation)
  - tests/subjects/no-latest-leak.test.ts — grep-style tripwire confirming blockNumber threads through every multiread call site in adapters AND that no adapter calls raw viem publicClient methods directly
affects: [02-03-dimensions, 02-04-claude, 02-05-cli, phase-03-historical-replay]

# Tech tracking
tech-stack:
  added: []   # All deps were pinned in Plan 02-01; this plan exercises them.
  patterns:
    - "Per-subject adapter shape: erc20Abi + parseAbi(extra) → multiread(round1, blockNumber) → bucket Facts by dimension (collateral/contract/oracle/liquidity)"
    - "Block-pinning thread-through: every adapter accepts optional blockNumber?: bigint; converts to Number(ingestBlock) once at the top; stamps source.blockNumber on every onchain Fact; passes blockNumber to multiread() so allowFailure-mode multicall pins the read"
    - "Missing-fact surface at adapter boundary: failed multicall reads (ReadResult{ok:false}) become Fact{value:null}; dimension scorer in Wave 2 applies default-to-50 + confidence-drop. Adapter NEVER fabricates a value or returns 0/'unknown' string for a failed read"
    - "Static-fact citation source convention: staticFact() helper emits Fact{source:{kind:'static', file:'agent/src/subjects/static.ts', version:'1.0.0'}} — STATIC_VERSION is the single source of truth so Phase 4 verifier can render off-chain config citations distinct from on-chain ones"
    - "RPC URL redaction (T-2-03): redactRpcUrl(message) splits on MANTLE_RPC_URL and joins with '[redacted]'; wraps any error before logging or JSON serialization"
    - "Adapter-helper indirection: no adapter calls publicClient.multicall or publicClient.readContract directly — they all route through multiread(). A no-latest-leak grep tripwire test enforces this for all 3 adapter source files"
    - "TDD discipline: RED (failing test) → GREEN (impl) committed atomically; 3 RED + 3 GREEN commits for 3 tasks"

key-files:
  created:
    - agent/src/rpc.ts
    - agent/src/multicall.ts
    - agent/src/constants/prices.ts
    - agent/src/subjects/static.ts
    - agent/src/subjects/usdy.ts
    - agent/src/subjects/cmeth.ts
    - agent/src/subjects/fbtc.ts
    - agent/src/subjects/registry.ts
    - agent/tests/subjects/static.test.ts
    - agent/tests/subjects/usdy.test.ts
    - agent/tests/subjects/cmeth.test.ts
    - agent/tests/subjects/fbtc.test.ts
    - agent/tests/subjects/registry.test.ts
    - agent/tests/subjects/no-latest-leak.test.ts
    - agent/tests/fixtures/usdy.fixture.ts
    - agent/tests/fixtures/cmeth.fixture.ts
    - agent/tests/fixtures/fbtc.fixture.ts
  modified:
    - agent/src/index.ts (barrel re-exports of STATIC, STATIC_VERSION, staticFact, StaticSubject, fetchUsdy, fetchCmeth, fetchFbtc, ADAPTERS, getAdapter)

key-decisions:
  - "Single multiread round per subject — 1 of D-03's 3-round budget. Each adapter calls multiread() exactly ONCE with 5 ERC-20-surface reads (totalSupply, decimals, symbol, paused, owner). Rounds 2 and 3 (holder-concentration probe + protocol-specific reads) are deferred to a future polish wave since the ≤3 cap is generous, the static facts file covers what holder probes and oracle-specifics would surface, and dimension scorers can read everything they need from the bucketed SubjectFacts as designed."
  - "Adapters surface decimals + symbol from on-chain reads even though the value is statically known; this gives the dimension scorer (Wave 2) a citable on-chain fact for contract_risk drill-downs and lets the no-latest-leak tripwire find real call sites to verify block-pinning on."
  - "FBTC implementation field stays null in static config (per RESEARCH §3.3) — FBTC's UUPS proxy does not expose a universal implementation getter on the proxy surface. This is documented in the static file rather than emitted as a missing on-chain fact, because it's a known design, not a failed read."
  - "Re-exported subject adapters + registry from the agent/src/index.ts barrel so Wave 2/3/4 and (later) Phase 3 publisher import via `import { getAdapter } from '@touchstone/agent'`, not via deep relative paths into agent/src/subjects/. Preserves the import-surface contract Plan 02-01 established."

patterns-established:
  - "Per-subject adapter template (USDY → cmETH → FBTC): identical shape, swap STATIC entry + decimals semantics + price-feed multiplier (ETH_USD for cmETH, BTC_USD for FBTC). Easy to add a 4th subject in a v2 polish: copy fbtc.ts, swap STATIC.FBTC for STATIC.NEW, add a fixture, add a test."
  - "Block-pinning tripwire test pattern (grep adapter source files for multiread call sites + verify blockNumber within 4-line window): cheap, catches the foot-gun, generalizes to any future helper-vs-raw-client situation"
  - "ReadResult discriminated union mock pattern: vi.mock the multicall helper module and inject typed ReadResult[] arrays from fixture files — unit tests run in milliseconds without a live RPC; the success path and the all-fail path are both exercised per subject"

requirements-completed: [REQ-05]

# Metrics
duration: ~15 min
completed: 2026-06-09
---

# Phase 2 Plan 2: Per-Subject Ingest Adapters Summary

**Three Mantle Mainnet subjects (USDY, cmETH, FBTC) are now ingestable via per-subject viem + Multicall3 adapters that thread blockNumber through every read, surface missing reads as Fact{value:null} via the allowFailure path, and cite versioned static facts for off-chain claims — all gated by a no-latest-leak grep tripwire and an RPC-URL redaction helper (T-2-03).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-09T04:42:00Z (approx, post `pnpm install --frozen-lockfile`)
- **Completed:** 2026-06-09T04:57:00Z (approx)
- **Tasks:** 3 (each TDD: RED + GREEN commit pair)
- **Files created:** 17 (8 src, 9 tests/fixtures)
- **Files modified:** 1 (agent/src/index.ts barrel)
- **Tests:** 70/70 green (24 baseline from Plan 02-01 + 46 new from this plan)

## Accomplishments

- **viem publicClient + multiread helper:** `agent/src/rpc.ts` exports a publicClient bound to viem's `mantle` chain (chain 5000, RPC `https://rpc.mantle.xyz` by default; overridable via root `.env`'s `MANTLE_RPC_URL`). `agent/src/multicall.ts` exposes `multiread(reads, blockNumber?)` that wraps `publicClient.multicall({ contracts, blockNumber, allowFailure: true })` and maps per-read `{status: success|failure}` → `ReadResult` discriminated-union entries. Empty input short-circuits without an RPC round-trip (test-asserted).
- **T-2-03 mitigation (RPC URL redaction):** `redactRpcUrl(message)` scrubs `MANTLE_RPC_URL` (which may carry an Alchemy/Infura API key) from any string before it is logged or serialized. Test asserts the default URL is replaced by `[redacted]`.
- **STATIC_VERSION = "1.0.0" lock:** `agent/src/subjects/static.ts` carries the versioned off-chain facts for all 3 subjects (collateral, audits, custodian, oracle architecture, staleness tolerance, pausable/timelock, source-verified, implementation, proxy pattern, TVL approximations). `staticFact()` helper builds a `Fact` with `source.kind: "static"`, `source.file: "agent/src/subjects/static.ts"`, `source.version: STATIC_VERSION`. Locked addresses (D-05, DEC-subject-set-locked) are present byte-for-byte: USDY `0x5be26527e817998A7206475496fDE1E68957c5A6`, cmETH `0xE6829d9a7ee3040e1276Fa75293Bde931859e8fA`, FBTC `0xC96dE26018A54D51c097160568752c4E3BD6C364`.
- **Hash-determinism prices:** `agent/src/constants/prices.ts` provides `priceAtBlock(block)` returning the highest `PriceEntry` whose `recordedAtBlock <= block`. Default entry (block 0) pinned at planning time: BTC $95k, ETH $3.8k, MNT $0.60. Engine NEVER hits a live price API at rating time (hash stability requirement; Phase 3 historical replay extends this with block-range entries).
- **3 subject adapters (USDY/cmETH/FBTC):** Each exposes `fetch{Ticker}(blockNumber?: bigint): Promise<SubjectFacts>`. Single `multiread()` round per adapter (5 reads: totalSupply, decimals, symbol, paused, owner) — 1 of the D-03 ≤3-round budget. Returns `SubjectFacts` with 4 buckets (collateral, contract, oracle, liquidity) populated with a mix of static and on-chain Facts. Block-pinning: `blockNumber` is converted to `Number(ingestBlock)` once at the top of each adapter and stamped on every on-chain Fact's `source.blockNumber`. Missing reads (ReadResult{ok:false}) emit `Fact{value:null}` per D-07 — the dimension scorer (Wave 2) is responsible for the default-to-50 + confidence-drop policy; the adapter just surfaces null faithfully.
- **Dispatch registry (T-2-07 mitigation):** `agent/src/subjects/registry.ts` exports `ADAPTERS: Record<SubjectId, ...>` plus `getAdapter(id)` which throws on unknown id. SubjectId is a literal union (`"USDY" | "cmETH" | "FBTC"`) — TypeScript enforces at compile time AND the runtime guard rejects any bypass attempt.
- **no-latest-leak tripwire:** `agent/tests/subjects/no-latest-leak.test.ts` reads `usdy.ts`, `cmeth.ts`, `fbtc.ts` as plain text, strips line-comments, then (a) asserts every `multiread(` call site has `blockNumber` within a 4-line window AND (b) asserts no `publicClient.multicall` / `publicClient.readContract` direct calls anywhere in the adapters. 6 assertions across 3 files; all green.
- **Per-adapter test coverage:** Each adapter has 7 behavioral tests via `vi.mock('../../src/multicall.js', …)` injecting fixture `ReadResult[]` arrays. 21 adapter tests + 3 static-facts tests + 3 prices tests + 3 multicall/RPC tests + 5 registry tests + 6 tripwire tests = 46 new tests this plan. Total 70/70 green when including the 24 baseline tests from Plan 02-01 (grade-enum + schema).

## Per-subject Multicall Round-trip Count (D-03 ≤3 cap)

| Subject | Adapter | multiread calls | Reads per call | Notes |
|---------|---------|-----------------|----------------|-------|
| USDY  | `fetchUsdy`  | 1 | 5 (totalSupply, decimals, symbol, paused, owner) | Under cap; rounds 2+3 deferred — static facts cover what additional reads would surface |
| cmETH | `fetchCmeth` | 1 | 5 (same shape) | Under cap; identical pattern |
| FBTC  | `fetchFbtc`  | 1 | 5 (same shape) | Under cap; implementation field stays static (UUPS proxy doesn't expose getter) |

All three adapters are well under D-03's 3-round budget. Future polish can add round 2 (holder concentration via static holder-probe list) and round 3 (price-feed reads where available) without breaking the contract.

## Static Facts Confirmed at Planning Time

All 3 subjects have full static entries with:
- Locked Mantle Mainnet address (verified byte-for-byte against DEC-subject-set-locked in PROJECT.md)
- Collateral composition description
- Audit firm list (≥1 entry per subject)
- Reserve attestation cadence
- Custodian (where applicable; null for cmETH which is restake-based not custody-based)
- Oracle architecture description
- Staleness tolerance
- Pausable flag (all true)
- Source-verified flag (all true)
- Implementation address where universally exposed (null for FBTC per RESEARCH §3.3)
- Proxy pattern (EIP-1967 transparent for USDY/cmETH; UUPS for FBTC)
- Mantle TVL and parent TVL approximations
- Holder probe list (empty — deferred to a future polish wave)
- Price feed (null — deferred; covered by static prices.ts table)

## RPC Reads That Fell Back to Static (planning-time analysis)

Per RESEARCH §3 and the planning-time threat model, the following on-chain reads were *expected* to need a static fallback. This wave does NOT yet run live RPC against Mantle Mainnet (live testing is gated by `RUN_LIVE=1` and is a Wave 4 / CLI smoke-test concern), so we cannot report observed availability. The current adapter design surfaces these expectations *defensively* — if a static fact ends up overlapping with a future on-chain read, both can coexist as siblings in the same bucket:

| Subject | Read RESEARCH expected | Current treatment | Reason |
|---------|------------------------|-------------------|--------|
| USDY | `oraclePrice()` (USDY accrued price) | static-only this wave | The accrued-price getter may not be on the proxy surface; needs live verification; oracle bucket cites architecture statically with a citable on-chain symbol() probe as a sanity-check ingredient |
| cmETH | Mantle Chainlink ETH/USD feed | static-only this wave | priceAtBlock().ETH_USD provides deterministic USD framing; live oracle reads can be added in a polish wave once the feed address is verified on Mantle |
| FBTC | Chainlink Proof-of-Reserves | static-only this wave | PoR oracle availability on Mantle is not universally guaranteed; static facts carry the attestation cadence; live PoR can be wired in a polish wave |

When Wave 4 wires the live `RUN_LIVE=1` smoke test, these are the call sites to revisit. The architecture supports both: every adapter is structured so a new `multiread()` call returning the on-chain price simply appends a new `Fact` to the appropriate bucket without changing the adapter's contract.

## Test Results

```
$ pnpm test
 RUN  v4.1.8

 Test Files  8 passed (8)
      Tests  70 passed (70)
   Duration  ~6.3s

$ pnpm typecheck
> tsc --noEmit
(no output — exits 0)
```

| Test File | Tests | Scope |
|-----------|-------|-------|
| tests/constants/grade-enum.test.ts | 13 | Baseline from Plan 02-01 |
| tests/schema.test.ts                | 11 | Baseline from Plan 02-01 |
| tests/subjects/static.test.ts       | 14 | Task 2-02-01 (STATIC, prices, multicall empty, redactRpcUrl) |
| tests/subjects/usdy.test.ts         |  7 | Task 2-02-02 (USDY adapter behaviors 1-6 + ingestBlock-0 edge) |
| tests/subjects/cmeth.test.ts        |  7 | Task 2-02-03 (cmETH adapter behaviors 1-6 + ingestBlock-0 edge) |
| tests/subjects/fbtc.test.ts         |  7 | Task 2-02-03 (FBTC adapter behaviors 1-6 + ingestBlock-0 edge) |
| tests/subjects/registry.test.ts     |  5 | Task 2-02-03 (ADAPTERS map + getAdapter throws on unknown id) |
| tests/subjects/no-latest-leak.test.ts |  6 | Task 2-02-03 (block-pinning thread-through tripwire over 3 adapters × 2 assertions) |
| **TOTAL** | **70** | **8 files, 0 failures, 0 skips** |

## Task Commits

Each task: RED (failing test) commit + GREEN (impl) commit. All 6 commits on the per-agent worktree branch.

| # | Task | RED commit | GREEN commit |
|---|------|-----------|-----------|
| 1 | Task 2-02-01: viem client + multicall helper + static facts + prices | `e97fe89` (test) | `85840a2` (feat) |
| 2 | Task 2-02-02: USDY adapter + fixture + tests | `79b418f` (test) | `c2f7f96` (feat) |
| 3 | Task 2-02-03: cmETH + FBTC adapters + registry + no-latest-leak tripwire | `54bd796` (test) | `de84e14` (feat) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Reworded multicall.ts header comment to remove literal Multicall3 hex address**
- **Found during:** Task 2-02-01 acceptance-criteria verification (`grep -c '0xcA11bde05977b3631167028862bE2a173976CA11' src/multicall.ts` returned 1, criterion required 0)
- **Issue:** The PLAN's `<action>` block included a code comment that named the Multicall3 canonical address verbatim. The PLAN's `<acceptance_criteria>` explicitly required this grep to return 0 (delegation to viem's chain definition; no raw hex). The two parts of the plan were inconsistent — code comment vs grep criterion.
- **Fix:** Reworded the comment to reference "canonical Multicall3 deployment per the Multicall3 deployment policy" without naming the literal hex address. Functionality unchanged.
- **Files modified:** `agent/src/multicall.ts`
- **Verification:** `grep -c '0xcA11bde05977b3631167028862bE2a173976CA11' agent/src/multicall.ts` returns 0; full test suite still green.
- **Committed in:** `85840a2` (Task 2-02-01 GREEN commit)

**2. [Rule 2 - Missing critical] Reworded USDY adapter header comment to remove literal `publicClient.multicall`/`publicClient.readContract` mentions**
- **Found during:** Task 2-02-02 acceptance-criteria verification (`grep -cE 'publicClient\.(multicall|readContract)' agent/src/subjects/usdy.ts` returned 1, criterion required 0)
- **Issue:** Same pattern as #1. The adapter header comment named the forbidden methods to explain why the adapter doesn't call them. Acceptance criterion's grep can't distinguish prose from code.
- **Fix:** Reworded comment to "raw viem publicClient batched-read or single-read methods" without verbatim method names. Functionality unchanged.
- **Files modified:** `agent/src/subjects/usdy.ts`
- **Verification:** `grep -cE 'publicClient\.(multicall|readContract)' agent/src/subjects/usdy.ts` returns 0; cmETH and FBTC adapters used the corrected phrasing from the start.
- **Committed in:** `c2f7f96` (Task 2-02-02 GREEN commit)

**3. [Rule 2 - Missing critical] no-latest-leak tripwire test strips line-comments before grepping for forbidden direct calls**
- **Found during:** Authoring `agent/tests/subjects/no-latest-leak.test.ts` (Task 2-02-03 RED phase). The plan's draft of this test did NOT strip comments before the `publicClient.multicall` / `publicClient.readContract` regex check. That risks false positives forever (any future doc-comment that names the forbidden methods would break the tripwire even though the code is correct).
- **Issue:** Plan-as-drafted would couple test outcome to comment phrasing.
- **Fix:** Both the "blockNumber within window" check AND the "no direct client call" check now strip lines whose `trimStart()` begins with `//` before testing. The tripwire still catches all real call sites (code is never inside a `//` line) and is robust against future doc rewording.
- **Files modified:** `agent/tests/subjects/no-latest-leak.test.ts` (authored with this fix from the start)
- **Verification:** Tripwire green across all 3 adapters; deviations #1 and #2 are not needed for the test files (which never reference publicClient at all), only for the source files.
- **Committed in:** `54bd796` (Task 2-02-03 RED commit)

---

**Total deviations:** 3 auto-fixed (all Rule 2 — missing critical correctness; all about resolving inconsistencies between PLAN code samples and PLAN acceptance criteria where comment prose tripped grep-based checks). No scope creep. No contract changes. All deviations preserve the spirit of the criteria (no raw hex Multicall3 hardcode; no direct publicClient calls; tripwire robust against future doc rewording).

## Issues Encountered

- **`pnpm install` needed in worktree:** Worktree was created from base commit `b6877c2` which had the lockfile committed but no `node_modules/`. Ran `pnpm install --frozen-lockfile` before TDD work; took ~70s; 73 packages installed; lockfile unchanged.
- No other issues outside the 3 auto-fixed deviations above. Typecheck and tests both green at every commit boundary.

## Authentication Gates

None — this wave is pure ingest scaffold + unit tests with mocked multicall. No live RPC, no Anthropic, no external services. Wave 4 CLI smoke test (`RUN_LIVE=1`) will be the first wave to need MANTLE_RPC_URL secrets and is owned by Plan 02-05.

## Self-Check Results

Files claimed created (all verified present on disk):
- agent/src/rpc.ts — FOUND
- agent/src/multicall.ts — FOUND
- agent/src/constants/prices.ts — FOUND
- agent/src/subjects/static.ts — FOUND
- agent/src/subjects/usdy.ts — FOUND
- agent/src/subjects/cmeth.ts — FOUND
- agent/src/subjects/fbtc.ts — FOUND
- agent/src/subjects/registry.ts — FOUND
- agent/tests/subjects/static.test.ts — FOUND
- agent/tests/subjects/usdy.test.ts — FOUND
- agent/tests/subjects/cmeth.test.ts — FOUND
- agent/tests/subjects/fbtc.test.ts — FOUND
- agent/tests/subjects/registry.test.ts — FOUND
- agent/tests/subjects/no-latest-leak.test.ts — FOUND
- agent/tests/fixtures/usdy.fixture.ts — FOUND
- agent/tests/fixtures/cmeth.fixture.ts — FOUND
- agent/tests/fixtures/fbtc.fixture.ts — FOUND

Files modified (verified):
- agent/src/index.ts — barrel updated with Wave 1 re-exports (STATIC, STATIC_VERSION, staticFact, fetchUsdy, fetchCmeth, fetchFbtc, ADAPTERS, getAdapter); typecheck clean.

Commits claimed (all verified via `git log --oneline -10`):
- e97fe89 — FOUND (test 02-02-01 RED)
- 85840a2 — FOUND (feat 02-02-01 GREEN)
- 79b418f — FOUND (test 02-02-02 RED)
- c2f7f96 — FOUND (feat 02-02-02 GREEN)
- 54bd796 — FOUND (test 02-02-03 RED)
- de84e14 — FOUND (feat 02-02-03 GREEN)

Acceptance-criteria grep checks (verified post-deviation-fixes):
- `STATIC_VERSION = "1.0.0"` in static.ts: 1 ✓
- `0xcA11bde05977b3631167028862bE2a173976CA11` in multicall.ts: 0 ✓ (delegated to viem)
- `allowFailure: true` in multicall.ts: 1 ✓
- `redactRpcUrl` in rpc.ts: 3 (≥1 required) ✓
- USDY address in static.ts: 1 ✓
- cmETH address in static.ts: 1 ✓
- FBTC address in static.ts: 1 ✓
- `export async function fetchUsdy` in usdy.ts: 1 ✓
- `export async function fetchCmeth` in cmeth.ts: 1 ✓
- `export async function fetchFbtc` in fbtc.ts: 1 ✓
- `blockNumber` count in usdy.ts: 4 (≥3 required) ✓
- `blockNumber` count in cmeth.ts: 4 (≥3 required) ✓
- `blockNumber` count in fbtc.ts: 4 (≥3 required) ✓
- `publicClient.(multicall|readContract)` in usdy.ts: 0 ✓
- `publicClient.(multicall|readContract)` in cmeth.ts: 0 ✓
- `publicClient.(multicall|readContract)` in fbtc.ts: 0 ✓

Test + typecheck final results:
- `pnpm test` — 70/70 passing (8 files), 0 failures, 0 skips
- `pnpm typecheck` — exits 0 (no diagnostics)

## Self-Check: PASSED

## Threat Flags

None — this wave introduces no NEW security-relevant surface beyond what is already in the plan's `<threat_model>`. The 3 threats addressed (T-2-03 RPC URL leakage via redactRpcUrl, T-2-04 missing-fact silent fall-through via Fact{value:null} surfacing, T-2-07 unknown SubjectId rejection via getAdapter throw) are all mitigated as documented. No new network endpoints, no auth paths, no file access patterns, no schema changes at trust boundaries.

## Next Phase Readiness

- Wave 1 contracts ready for Wave 2 (dimensions scoring) to import: `fetchUsdy`, `fetchCmeth`, `fetchFbtc`, `getAdapter`, `STATIC`, `staticFact`, `priceAtBlock`, plus all the type contracts from Plan 02-01 (`SubjectId`, `SubjectFacts`, `Fact`, `Band`, `BandResult`).
- Wave 2 dimension scorers should consume `SubjectFacts` produced by these adapters and emit `BandResult` per dimension; they should apply the D-07 default-to-50 + confidence-drop policy ONLY at the dimension boundary (the adapters surface `value: null` faithfully without making policy decisions).
- Phase 3 historical-replay reuse hook is in place: every adapter accepts `blockNumber?: bigint`; the multiread helper threads it to `publicClient.multicall`. The Elixir deUSD reconstruction in Phase 3 can pass the pre-failure block and the same adapters will return facts pinned to that historical state.
- `pnpm rate` script (loading root `.env` via `tsx --env-file=../.env`) is the entry point Wave 4 CLI will build on. No agent-local `.env` was introduced (T-2-01 mitigation preserved).
- No blockers. Phase 2 Plan 03 (dimension scorers) can begin immediately.

---
*Phase: 02-rating-engine-core*
*Plan: 02-subjects*
*Completed: 2026-06-09*
