---
phase: 02-rating-engine-core
plan: 05
subsystem: cli-e2e
tags: [rate-orchestrator, cli, env-safety, citation-validation, t-2-01, t-2-07, req-01, req-05, phase-3-import-surface, phase-2-closure]

# Dependency graph
requires:
  - phase: 02-rating-engine-core
    provides: getAdapter (Plan 02-02), 4 scorers + synthesize (Plan 02-03), synthesizeRating + computeReasoningHash + canonicalizeDoc (Plan 02-04), ReasoningDoc zod schema (Plan 02-01)
provides:
  - rate(SubjectId, RateOptions?): Promise<RateResult> — the locked Phase 3 import surface
  - validateCitations(doc, facts) — T-2-07 post-hoc fabrication check
  - agent/src/cli.ts — pnpm rate <SUBJECT> [--block N] [--out -|<path>] [--mock]
  - agent/src/claude/mock.ts — production-safe home for fixtureToolUseResponse + mockAnthropicClient (W2 fix; tests/helpers re-exports for back-compat)
  - agent/README.md — env setup + CLI usage + architecture map + phase contracts
  - 3 new test files: rate.test.ts (7 tests), cli.test.ts (5 tests), env-safety.test.ts (4 tests) — 16 new tests this plan
affects: [phase-03-publisher, phase-04-verifier]

# Tech tracking
tech-stack:
  added: []   # All deps pinned in Plan 02-01; this wave exercises them.
  patterns:
    - "rate() orchestrator pattern: getAdapter -> 4 scorers -> synthesize -> synthesizeRating -> validateCitations -> computeReasoningHash -> (optional) canonical-bytes file write. Single entrypoint, single return shape ({ doc, reasoningHash, outPath? }). Phase 3 imports this verbatim."
    - "Post-hoc citation-source validation (T-2-07): validateCitations(doc, facts) walks every dim.citations[].source.address; throws if the address is not in the SubjectFacts allow-list AND not 'static_config'. Defense-in-depth on top of the system-prompt instruction; catches a future LLM regression that fabricates addresses despite the prompt."
    - "--mock determinism harness: opts.mock injects a hand-authored Anthropic mock (via fixtureToolUseResponse) and pins blockTimestampSeconds = 1717804800 so the on-chain block read is skipped AND the hash is reproducible. Same code path as live mode; only the leaves are swapped."
    - "Production-safe mock module: agent/src/claude/mock.ts has zero test-framework deps. rate({ mock: true }) imports it from src/. tests/helpers/mock-anthropic.ts is a thin re-export so Wave 3 tests' import paths keep working. (W2 fix carried forward from the plan's <action> block.)"
    - "Canonical-bytes file write: writeToFs writes exactly canonicalizeDoc(doc) — no trailing newline. The on-disk bytes ARE the canonical form; readFileSync(path).toString() re-canonicalizes to the same bytes; computeReasoningHash on the re-parsed doc returns the same hash. Phase 4 verifier's IPFS fetch -> JSON.parse -> computeReasoningHash chain WILL match the on-chain bytes32."
    - "CLI argv allow-list (T-2-07): cli.ts hard-codes SUBJECT_IDS = new Set(['USDY','cmETH','FBTC']); unknown subjects exit 2 with 'Unknown subject' on stderr. The runtime check is redundant with the TypeScript literal-union type but it is the actual security boundary at process entry."
    - "Env-safety by absence (T-2-01): tests/env-safety.test.ts git-greps tracked files for real-key shapes (sk-ant-api03-<long alphanumeric suffix>) instead of bare prefixes, so PLAN documentation that legitimately mentions 'sk-ant-' or 'ANTHROPIC_API_KEY=sk-' doesn't trip the assertion. Asserts no agent-local .env file exists on disk and agent/src never references process.env.PRIVATE_KEY."
    - "Cross-platform CLI test spawner: spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', cli.ts, ...args]) instead of `npx tsx`. Bypasses .CMD wrapper on Windows AND avoids shell:true (which mangles paths containing spaces)."
    - "TDD per task: RED (failing test) commit -> GREEN (impl) commit pair. 2 task-level cycles in this plan. Task 3 is checkpoint-only — no commit."

key-files:
  created:
    - agent/src/rate.ts
    - agent/src/cli.ts
    - agent/src/claude/mock.ts
    - agent/README.md
    - agent/tests/rate.test.ts
    - agent/tests/cli.test.ts
    - agent/tests/env-safety.test.ts
  modified:
    - agent/src/index.ts (Wave 4 barrel re-exports: rate, validateCitations, RateOptions, RateResult)
    - agent/tests/helpers/mock-anthropic.ts (now re-exports from src/claude/mock.ts)
    - agent/package.json (rate script: --env-file -> --env-file-if-exists)
    - .gitignore (added agent/.test-out/)

key-decisions:
  - "rate({ mock: true }) imports from agent/src/claude/mock.ts (production-safe home), not from agent/tests/helpers/mock-anthropic.ts. W2 fix lifted directly from the PLAN's <action> block — rationale: the CLI and Phase 3 publisher will import rate(), and neither can pull test-framework deps. tests/helpers/mock-anthropic.ts is now a 4-line re-export; Wave 3 tests' import paths are preserved."
  - "tsx flag changed from --env-file to --env-file-if-exists in the pnpm rate script. Rationale: --env-file is a hard requirement that exits the process with code 9 when ../.env is absent (e.g., CI, --mock runs, the parallel-executor worktree which has no root .env). --env-file-if-exists prints a warning to stderr and continues. Live rating still works when the root .env IS present; --mock and CI runs no longer break."
  - "Default outDir in rate() is resolve(process.cwd(), 'out', subject) — NOT resolve(process.cwd(), 'agent', 'out', subject). The CLI is launched from inside agent/ via the pnpm rate script, so the on-disk path is correctly agent/out/<SUBJECT>/<block>.json. Earlier draft (verbatim from the PLAN <action> block) produced agent/agent/out/... — Rule 1 bug, fixed in-flight."
  - "CLI test spawner switched from `npx tsx` (which uses tsx.CMD on Windows and requires shell:true) to `node node_modules/tsx/dist/cli.mjs` (plain Node + ESM script — works without shell). Rule 3 blocking fix — original spawnSync invocation returned status:null on Windows because spawnSync cannot natively execute .CMD wrappers and shell:true mangled the path 'Mantle - Turing' as a separate argv entry."
  - "env-safety.test.ts uses real-key-shape patterns (sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}) rather than the bare prefix recommended in the PLAN's behavior list. Rule 1 fix — the bare-prefix patterns would always fail because the PLAN.md, this SUMMARY.md, and env-safety.test.ts itself ALL legitimately mention the bare prefix as documentation. Same shape-based approach used by `gitleaks` and other secret scanners; the assertion catches real planted keys without tripping on documentation."
  - "Task 2-05-03 (live human-verify checkpoint) auto-approved per auto-mode override. The live RPC + live Anthropic verification requires ANTHROPIC_API_KEY which is not present in the parallel-executor worktree. The 3 --mock hashes are recorded below in lieu of live hashes; the human-verify rubric (citation-rigor eyeball check) is deferred to a manual demo-day run."

patterns-established:
  - "Orchestrator + post-hoc validation: rate() composes deterministic + LLM steps then ALWAYS runs post-hoc validators before returning. Phase 4 and any future plan that adds an LLM-touchpoint should follow the same pattern — never return raw LLM output; always pass it through a deterministic check."
  - "Canonical-bytes file write convention: when writing JSON whose hash must be reproducible, write canonicalize(doc) EXACTLY — no trailing newline, no pretty-printing, no JSON.stringify. Phase 4 verifier's contract is the in-memory string, not the on-disk bytes; this discipline ensures they coincide."
  - "Cross-platform Node-tool spawner: invoke `<tool>/dist/cli.mjs` via `process.execPath` instead of shell-wrapped binaries. Generalizes to any future test that spawns a Node-based CLI on Windows."

requirements-completed: [REQ-01, REQ-05]

# Metrics
duration: ~18 min
completed: 2026-06-09
---

# Phase 2 Plan 5: rate() Orchestrator + pnpm rate CLI Summary

**rate(SubjectId, blockNumber?) is the locked Phase 3 import surface; the CLI accepts only the 3 locked subjects (T-2-07), produces a canonical-bytes JSON whose hash matches the printed reasoningHash, and an env-safety git-grep proves no API keys leak in committed files (T-2-01). Phase 2 engine end-to-end — Wave 0 scaffolding + Wave 1 ingest + Wave 2 banded scorers + Wave 3 forced-tool-use synthesis + RFC 8785 JCS hash + Wave 4 orchestrator + CLI — is complete and ready for Phase 3 wiring.**

## Performance

- **Duration:** ~18 min (3 tasks; TDD on Tasks 1 + 2; Task 3 is the human-verify checkpoint, auto-approved)
- **Started:** 2026-06-09T05:01:14Z
- **Completed:** 2026-06-09T05:20:02Z
- **Tasks:** 3 (2 implemented + 1 checkpoint)
- **Files created:** 7 (3 src + 3 tests + 1 README)
- **Files modified:** 4 (agent/src/index.ts, agent/tests/helpers/mock-anthropic.ts, agent/package.json, .gitignore)
- **Tests:** 185/185 green (169 baseline from Plans 02-01/02/03/04 + 16 new from this plan)

## Accomplishments

### Task 2-05-01: rate() orchestrator + post-hoc citation validation + pipeline integration test

- **agent/src/rate.ts (rate orchestrator):** Composes the full pipeline:
  1. `getAdapter(subject)(blockNumber)` → SubjectFacts
  2. 4 deterministic scorers → 4 BandResults
  3. `synthesize()` → letter + uint8 + confidence + totalMissingFacts
  4. `getBlockTimestampSeconds(blockNumber, mock)` → fixed in mock mode (1_717_804_800), live RPC `publicClient.getBlock` in live mode
  5. `synthesizeRating()` (with mock or live Anthropic client) → ReasoningDocument
  6. `validateCitations(doc, facts)` — post-hoc T-2-07 check
  7. `computeReasoningHash(doc)` → 0x+64hex bytes32
  8. (optional) `writeFileSync(<outDir>/<block>.json, canonicalizeDoc(doc))` — canonical bytes, no trailing newline
  9. Final `parseReasoningDocument(doc)` defensive re-parse → returns `{ doc, reasoningHash, outPath? }`
- **validateCitations() — T-2-07 mitigation:** Builds an allowlist Set of every onchain SubjectFacts source.address (case-normalized to lowercase) plus the literal "static_config" sentinel for static facts. Walks every `dim.citations[].source.address` (lowercased unless it's the static sentinel) and throws "fabricated address in citation (T-2-07): dim=<key> cite=[<id>] addr=<addr>" if absent from the allowlist. Defense-in-depth on top of the system-prompt instruction "DO NOT invent facts or addresses" from Wave 3.
- **agent/src/claude/mock.ts (W2 fix):** Production-safe home for `fixtureToolUseResponse` and `mockAnthropicClient` — zero vitest/test-framework deps. Lets rate({ mock: true }) be invoked from any code path (CLI, Phase 3 publisher) without pulling test infrastructure. `agent/tests/helpers/mock-anthropic.ts` is now a 4-line backward-compat re-export so Wave 3 tests' imports continue to resolve.
- **agent/tests/rate.test.ts (7 tests, all green):**
  - 3× `rate(USDY/cmETH/FBTC, { mock: true, blockNumber: 75_000_000n })` produces schema-valid doc with `subject.ticker` match, `ingest_block === 75_000_000`, and hash format `0x[0-9a-f]{64}`
  - Hash determinism: two consecutive `rate("USDY", { mock: true, blockNumber: 75_000_000n })` calls → byte-identical reasoningHash (T-2-06)
  - `validateCitations` throws on a fabricated address (0xdEadBeef...) NOT in SubjectFacts
  - `validateCitations` accepts addresses present in SubjectFacts with case-insensitive normalization (mixed-case `0x5be26527e817998A7206475496fDE1E68957c5A6` from doc matches lower-cased `0x5be26527e817998a7206475496fde1e68957c5a6` in the allowlist)
  - `writeToFs` writes canonical-bytes JSON to disk; re-reading + JSON.parse + canonicalize → same bytes; recompute hash on re-parsed doc → same reasoningHash

### Task 2-05-02: CLI + env-safety + README + Windows-cross-platform test runner

- **agent/src/cli.ts:** `pnpm rate <SUBJECT> [--block N] [--out -|<path>] [--mock]` with:
  - Hard-coded `SUBJECT_IDS = new Set(["USDY", "cmETH", "FBTC"])` allow-list
  - Argv parser supporting `--key value` and `--bool` flags
  - Exit 2 on missing/unknown subject with `Unknown subject:` + allow-list message on stderr (T-2-07)
  - Exit 1 with `ERROR: <msg>` on any rate() throw — synthesize.ts has already scrubbed `ANTHROPIC_API_KEY` from the message body (T-2-01 defense)
  - `--out -` writes `canonicalizeDoc(doc) + "\n"` to stdout instead of a file; `reasoningHash=...` line always on stdout
- **agent/README.md:** Setup steps + env-key table (`ANTHROPIC_API_KEY`, `MANTLE_RPC_URL`, `CLAUDE_MODEL` all from root `.env`) + usage examples + architecture file map + Phase contracts. Explicitly states "no separate `agent/.env`" and references CON-deterministic-vs-llm-separation.
- **agent/tests/cli.test.ts (5 tests, all green):**
  - 3× `pnpm rate <SUBJECT> --mock --block 75000000` exits 0 with `reasoningHash=0x<64hex>` line
  - `pnpm rate NotASubject --mock` exits non-zero with `Unknown subject` on stderr (T-2-07)
  - `pnpm rate USDY --mock --out - --block 75000000` writes canonical JSON to stdout AND hashLine; both halves verified
- **agent/tests/env-safety.test.ts (4 tests, all green):**
  - No `sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}` (real key shape) anywhere in tracked files
  - No `ANTHROPIC_API_KEY=sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}` assignments in tracked files
  - `agent/.env` and `agent/.env.example` do NOT exist (T-2-01 by absence — root `.env` is single source)
  - `process.env.PRIVATE_KEY` is not referenced anywhere under `agent/src/` (engine never signs — that's Phase 3)

### Task 2-05-03: Live human-verify checkpoint (auto-approved per auto-mode)

- **Status:** Auto-approved. Live RPC + live Anthropic verification requires `ANTHROPIC_API_KEY` which is not present in the parallel-executor worktree. The 3 mock-mode hashes recorded below stand in for the live hashes the checkpoint's `<output>` clause would normally request. The citation-rigor eyeball check is deferred to demo-day manual runs.

## Mock-Mode Hashes (Reproducible at HEAD)

These hashes are emitted by `pnpm rate <SUBJECT> --mock --block 75000000` and are deterministic at this commit. Re-running the CLI at the same commit reproduces them exactly. Different from the Wave 3 golden test hashes because `rate()`'s `--mock` mode uses a different hand-authored Claude payload (uniform `score: 70` with `mock band` label) than the goldens (`score: 72`); both are deterministic; both are reproducible from their respective inputs.

| Subject | Mock-mode reasoningHash |
|---------|-------------------------|
| USDY  | `0xe1e97d074fe28bb4cb15eb1aceb66e1b644afea10683331614bc7be380725aa1` |
| cmETH | `0x3720519581e6c7d21a2f97fa4ccc021d96ebf4b91dee05818938a7b6ca3f74a2` |
| FBTC  | `0x691402e780107beada1906ff78ad82d725c1ac175a8b6d25784ee886744ec034` |

Inputs that determine these hashes (in --mock mode):
- pinned block: `75_000_000`
- `blockTimestampSeconds`: `1_717_804_800` (= `2024-06-08T00:00:00Z` engine-set `generated_at`)
- `claude_model`: `claude-opus-4-8` (CLAUDE_MODEL env unset in the worktree)
- Mock payload (per `buildMockClient` in rate.ts): every dimension score 70, band label "mock band", 2 citations per dimension citing `static_config`
- Recorded multicall fixtures: `tests/fixtures/{usdy,cmeth,fbtc}.fixture.ts` from Plan 02-02

## Live RPC + Live Anthropic — Cost Note (Phase 3 Planning Input)

Per Wave 3 SUMMARY estimate (CONTEXT D-11 note): each live rating consumes ~$0.05–$0.10 in Anthropic tokens on `claude-opus-4-8`. Three live runs ≈ $0.30/demo. Phase 3 publisher should budget similarly — every `RatingRequested` event triggers one live rate() call.

The 3 live runs were NOT executed in this parallel-executor agent because the worktree has no `ANTHROPIC_API_KEY`. Demo-day operator should:
1. Ensure `ANTHROPIC_API_KEY` is in the root project `.env`
2. From `agent/`: `pnpm rate USDY` / `pnpm rate cmETH` / `pnpm rate FBTC`
3. Eyeball one `dimensions[*].rationale` per subject to confirm `[N]` citation markers map to real `citations[]` entries with `source.address` either `static_config` or a real Mantle address

## Test Results

```
$ pnpm test
 RUN  v4.1.8

 Test Files  22 passed (22)
      Tests  185 passed (185)
   Duration  ~33s

$ pnpm typecheck
> tsc --noEmit
(no output — exits 0)
```

| Test File | Tests | Scope |
|-----------|-------|-------|
| tests/constants/grade-enum.test.ts | 13 | Baseline (Plan 02-01) |
| tests/schema.test.ts                | 11 | Baseline (Plan 02-01) |
| tests/subjects/static.test.ts       | 14 | Baseline (Plan 02-02) |
| tests/subjects/usdy.test.ts         |  7 | Baseline (Plan 02-02) |
| tests/subjects/cmeth.test.ts        |  7 | Baseline (Plan 02-02) |
| tests/subjects/fbtc.test.ts         |  7 | Baseline (Plan 02-02) |
| tests/subjects/registry.test.ts     |  5 | Baseline (Plan 02-02) |
| tests/subjects/no-latest-leak.test.ts |  6 | Baseline (Plan 02-02) |
| tests/dimensions/collateral-quality.test.ts |  8 | Baseline (Plan 02-03) |
| tests/dimensions/contract-risk.test.ts      |  7 | Baseline (Plan 02-03) |
| tests/dimensions/oracle-integrity.test.ts   |  8 | Baseline (Plan 02-03) |
| tests/dimensions/liquidity-stability.test.ts|  9 | Baseline (Plan 02-03) |
| tests/dimensions/synthesize.test.ts         | 34 | Baseline (Plan 02-03) |
| tests/hash.test.ts                  |  6 | Baseline (Plan 02-04) |
| tests/hash-determinism.test.ts      |  5 | Baseline (Plan 02-04) |
| tests/claude.mock.test.ts           | 12 | Baseline (Plan 02-04) |
| tests/goldens/usdy.golden.test.ts   |  4 | Baseline (Plan 02-04) |
| tests/goldens/cmeth.golden.test.ts  |  3 | Baseline (Plan 02-04) |
| tests/goldens/fbtc.golden.test.ts   |  3 | Baseline (Plan 02-04) |
| **tests/rate.test.ts**                  |  **7** | Task 2-05-01 (3 happy-path subjects + determinism + 2 validateCitations + writeToFs) |
| **tests/cli.test.ts**                   |  **5** | Task 2-05-02 (3 subjects --mock + unknown rejection + --out -) |
| **tests/env-safety.test.ts**            |  **4** | Task 2-05-02 (no key shapes + no agent .env + no PRIVATE_KEY in src) |
| **TOTAL** | **185** | **22 files, 0 failures, 0 skips** |

## Task Commits

| # | Task | RED commit | GREEN / single commit |
|---|------|-----------|------------------------|
| 1 | Task 2-05-01: rate() orchestrator + validateCitations + pipeline test | `b658d41` (test) | `e6e6c7c` (feat) |
| 2 | Task 2-05-02: CLI + env-safety + README + Windows-safe test runner | `cdc08f9` (test) | `bebc6ec` (feat) |
| 3 | Task 2-05-03: Live human-verify checkpoint | — (auto-approved; no commit) | — |

## Decisions Made

- **rate() return shape:** `{ doc, reasoningHash, outPath? }` instead of just `Promise<ReasoningDocument>` as RESEARCH §11 suggested. The CLI and Phase 3 publisher both need the hash AND the doc together; the outPath is conditional so the library default doesn't write to FS. Phase 3 will destructure `{ doc, reasoningHash }` and pass `reasoningHash` to `publishRating(subject, doc.grade.uint8, reasoningHash, doc.confidence)`.
- **--env-file-if-exists in pnpm rate script:** Rule 3 blocking fix (see Deviations #1 below).
- **outDir default `<cwd>/out/<SUBJECT>`:** Rule 1 bug fix (see Deviations #2 below).
- **Mock-mode block timestamp pinned at `1_717_804_800`:** Same value Wave 3 goldens used so the generated_at format and engine-overridden-field discipline are consistent across both test paths.
- **env-safety pattern uses real-key shape:** Rule 1 fix to avoid documentation self-reference (see Deviations #3 below).
- **Cross-platform spawnSync invocation:** Rule 3 blocking fix (see Deviations #4 below).
- **schema_version locked at "1.0.0":** Carried forward from Plan 02-01; not changed in this wave.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm rate script: --env-file → --env-file-if-exists**
- **Found during:** Manual smoke test after Task 2-05-02 GREEN
- **Issue:** The `pnpm rate` script (committed in Plan 02-01) ran `tsx --env-file=../.env src/cli.ts`. In a parallel-executor worktree (and any CI environment) there is no root `.env`. tsx with `--env-file` exits with code 9 ("../.env: not found") before the CLI even starts. This blocks the plan's acceptance criterion `pnpm rate USDY --mock --block 75000000 exits 0`.
- **Fix:** Switched the flag to `--env-file-if-exists=../.env`. Node honors this — prints a warning to stderr if the file is missing but continues execution. Live rating still works when the root `.env` IS present; --mock and CI runs no longer break.
- **Files modified:** `agent/package.json`
- **Verification:** `pnpm rate USDY --mock --block 75000000` exits 0 with reasoningHash + outPath; same for cmETH and FBTC.
- **Committed in:** `bebc6ec` (Task 2-05-02 GREEN)

**2. [Rule 1 - Bug] rate() default outDir produced `agent/agent/out/...`**
- **Found during:** Manual smoke test (outPath printed `agent\agent\out\USDY\75000000.json` — duplicated agent/ segment)
- **Issue:** The PLAN's `<action>` block had `resolve(process.cwd(), "agent", "out", subject)`. The CLI is launched from inside `agent/` via the `pnpm rate` script, so `process.cwd()` is already `agent/`, and prepending another `"agent"` produced the duplicated segment. The README states the path should be `agent/out/<SUBJECT>/<block>.json`.
- **Fix:** Changed to `resolve(process.cwd(), "out", subject)`. Tests inject `outDir` to control the location precisely; the default now matches the README and the canonical path.
- **Files modified:** `agent/src/rate.ts`
- **Verification:** `pnpm rate USDY --mock --block 75000000` outPath now reads `agent\out\USDY\75000000.json`.
- **Committed in:** `bebc6ec` (Task 2-05-02 GREEN)

**3. [Rule 1 - Bug] env-safety patterns matched PLAN documentation as false positives**
- **Found during:** First test run of env-safety.test.ts during Task 2-05-02 RED
- **Issue:** PLAN-as-written used bare-prefix patterns: `gitTrackedSearch("sk-ant-")` and `gitTrackedSearch("ANTHROPIC_API_KEY=sk-")`. These match literal documentation strings — the PLAN.md file itself, this SUMMARY, the env-safety test source, even threat-model tables that mention "sk-ant-" as a string. The assertions ALWAYS fail under those patterns.
- **Fix:** Narrowed patterns to real-key shapes: `sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}` and `ANTHROPIC_API_KEY=sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}`. Real Anthropic keys are `sk-ant-api03-<~95 alphanumeric/_-/>`; the 20-char minimum suffix catches actual planted keys while leaving doc references (bare prefix only) alone. Same shape-based approach `gitleaks` uses.
- **Files modified:** `agent/tests/env-safety.test.ts`
- **Verification:** `pnpm test -- tests/env-safety.test.ts` 4/4 green. A planted real key shape would still trip the assertion (manually verified with throwaway insertion+removal at authoring time).
- **Committed in:** Test refinement happened during RED commit `cdc08f9`; final form committed as part of GREEN `bebc6ec` (no separate commit — the refinement landed during the RED-to-GREEN transition).

**4. [Rule 3 - Blocking] cli.test.ts spawnSync returned status:null on Windows**
- **Found during:** Task 2-05-02 GREEN initial test run
- **Issue:** PLAN-as-written used `spawnSync("npx", ["tsx", CLI, ...args], { shell: process.platform === "win32" })`. On Windows with shell:true, the path `Mantle - Turing` (a directory segment in this project's path) was split on the space and " - " — npx interpreted "Mantle" as a separate argument and tried to resolve it as a module. Result: status:null, ERR_MODULE_NOT_FOUND in stderr, all 5 CLI tests fail without ever running the binary. Without shell:true, `npx` itself can't be found on Windows because Node can't natively execute the .CMD wrapper.
- **Fix:** Switched to `spawnSync(process.execPath, [<absolute path to tsx/dist/cli.mjs>, CLI, ...args])` — invokes the local tsx ESM entrypoint via the running Node binary, no shell, no .CMD. Every array element is a single argv entry; paths with spaces are passed through unmangled.
- **Files modified:** `agent/tests/cli.test.ts`
- **Verification:** `pnpm test -- tests/cli.test.ts` 5/5 green on Windows (the parallel-executor host); the spawner is also valid on POSIX since `tsx/dist/cli.mjs` exists in the npm package's dist tree on every platform.
- **Committed in:** `bebc6ec` (Task 2-05-02 GREEN)

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 2 Rule 3 blocking issues). All discovered through normal verification and fixed inline. None changed contract surface or threat model coverage. The CLI ACTUAL acceptance criteria from the plan (`pnpm rate USDY --mock --block 75000000` exits 0; same for cmETH/FBTC; unknown subject exits non-zero) all pass post-fix.

### Skipped on purpose

- **Task 2-05-03 live human-verify checkpoint:** Auto-approved per auto-mode override. Live RPC + live Anthropic cannot be exercised in the parallel-executor worktree (no `ANTHROPIC_API_KEY`); the citation-rigor eyeball check is deferred to demo-day manual runs.

## Issues Encountered

- **`pnpm install` needed in worktree:** Worktree base commit had the lockfile committed but no `node_modules/`. Ran `pnpm install --frozen-lockfile` before TDD work; ~62s; 73 packages installed; lockfile unchanged. pnpm flagged one ignored build script (`esbuild@0.28.0`) — no action required, the build is deferred to first compile and tsx handles it transparently.
- No other issues outside the 4 auto-fixed deviations above. Typecheck and test suite green at every commit boundary.

## Authentication Gates

None encountered. Live Anthropic + live Mantle RPC are gated by Task 2-05-03 (the human-verify checkpoint) and would be the FIRST live network calls in Phase 2 if exercised. Per auto-mode, the checkpoint was auto-approved; live verification deferred to demo-day operator.

## Self-Check Results

Files claimed created (all verified present on disk via `test -f`):
- agent/src/rate.ts — FOUND
- agent/src/cli.ts — FOUND
- agent/src/claude/mock.ts — FOUND
- agent/README.md — FOUND
- agent/tests/rate.test.ts — FOUND
- agent/tests/cli.test.ts — FOUND
- agent/tests/env-safety.test.ts — FOUND

Files modified (verified):
- agent/src/index.ts — Wave 4 re-exports added (rate, validateCitations, RateOptions, RateResult); typecheck clean
- agent/tests/helpers/mock-anthropic.ts — now a 4-line backward-compat re-export from src/claude/mock.ts
- agent/package.json — rate script uses --env-file-if-exists
- .gitignore — added `agent/.test-out/`

Commits claimed (all verified via `git log --oneline 6e2825a..HEAD`):
- b658d41 — FOUND (test 02-05-01 RED)
- e6e6c7c — FOUND (feat 02-05-01 GREEN)
- cdc08f9 — FOUND (test 02-05-02 RED)
- bebc6ec — FOUND (feat 02-05-02 GREEN)

Acceptance-criteria grep checks:
- `test -f agent/src/rate.ts`: OK
- `grep -c 'export async function rate' agent/src/rate.ts`: 1 ✓
- `grep -c 'export function validateCitations' agent/src/rate.ts`: 1 ✓
- `grep -cE 'from "\.\./tests/' agent/src/rate.ts`: 0 ✓ (W2 — src must not import from tests/)
- `test -f agent/src/claude/mock.ts`: OK
- `grep -c 'fabricated address' agent/src/rate.ts`: 2 (≥1 required) ✓
- `test -f agent/src/cli.ts`: OK
- `test -f agent/README.md`: OK
- `grep -c 'pnpm rate' agent/README.md`: 6 (≥1 required) ✓
- `grep -c 'ANTHROPIC_API_KEY' agent/README.md`: 2 (≥1 required) ✓
- `grep -c 'MANTLE_RPC_URL' agent/README.md`: 1 (≥1 required) ✓
- `grep -c 'CLAUDE_MODEL' agent/README.md`: 1 (≥1 required) ✓
- `grep -c 'Unknown subject' agent/src/cli.ts`: 2 (≥1 required) ✓ (T-2-07)
- `grep -cE 'SUBJECT_IDS.*=.*new Set\(\[' agent/src/cli.ts`: 1 ✓ (locked allow-list)

Manual smoke (each invoked from agent/):
- `pnpm rate USDY --mock --block 75000000` → exit 0; reasoningHash `0xe1e97d074fe28bb4cb15eb1aceb66e1b644afea10683331614bc7be380725aa1`
- `pnpm rate cmETH --mock --block 75000000` → exit 0; reasoningHash `0x3720519581e6c7d21a2f97fa4ccc021d96ebf4b91dee05818938a7b6ca3f74a2`
- `pnpm rate FBTC --mock --block 75000000` → exit 0; reasoningHash `0x691402e780107beada1906ff78ad82d725c1ac175a8b6d25784ee886744ec034`
- `pnpm rate NotASubject --mock` → exit 2; stderr `Unknown subject: NotASubject` + allow-list message

Final results:
- `pnpm test` — 185/185 passing (22 files), 0 failures, 0 skips
- `pnpm typecheck` — exits 0 (no diagnostics)

## Self-Check: PASSED

## TDD Gate Compliance

This plan does not have `type: tdd` at the plan level (it has individual TDD tasks via `tdd="true"` on each `<task>`). Both implemented tasks followed RED → GREEN cycles with distinct commits:

- Task 2-05-01: `test(02-05)` (`b658d41`) → `feat(02-05)` (`e6e6c7c`) ✓
- Task 2-05-02: `test(02-05)` (`cdc08f9`) → `feat(02-05)` (`bebc6ec`) ✓

Each RED commit was verified to actually fail (module-not-found for the source-under-test or spawn failure for the not-yet-existing CLI) before the GREEN commit added the implementation.

Task 2-05-03 is a checkpoint task with no commit — auto-approved per auto-mode override; no TDD applies.

## Threat Flags

None — Wave 4 closes Phase 2 within the threat model the plan declared. The 2 threats this plan addressed are mitigated as documented:

- **T-2-01 (Information Disclosure — secrets in committed files):** env-safety.test.ts proves the absence (real-key-shape git-grep + no agent/.env + no process.env.PRIVATE_KEY in src/). Error-path scrubbing happens in claude/synthesize.ts (Wave 3); the CLI just re-emits the already-scrubbed message.
- **T-2-07 (Input Validation — fabricated identifiers/citations):** CLI rejects unknown subjects at process entry (hard-coded SUBJECT_IDS allow-list). validateCitations rejects any LLM-citation source.address not in the SubjectFacts allowlist or "static_config". Both behaviors covered by tests (5 CLI tests + 2 validateCitations tests + 1 fabricated-address rejection inside rate.test.ts).

No new network endpoints introduced by this plan. No new file-access patterns beyond writing canonical-bytes JSON to a `<cwd>/out/<SUBJECT>/<block>.json` path that's gitignored. No schema changes (ReasoningDoc remains locked at Plan 02-01 + Wave 3 engine-override discipline).

## Phase 2 Closure Summary

Phase 2 is complete and ready for Phase 3 wiring.

**REQ-01 (Rating Engine Pipeline) — satisfied.** The full pipeline (Ingest → Score → Reason → output JSON) runs end-to-end via `rate(SubjectId, opts?)`. Deterministic code (`subjects/*`, `dimensions/*`, `hash.ts`) is strictly separated from the LLM step (`claude/*`) per CON-deterministic-vs-llm-separation. Every Claude rationale cites a fact via `[N]` markers that map to `citations[N]` entries — both the prompt (Wave 3) and post-hoc validation (Wave 4) enforce this. Output JSON conforms to D-12 locked schema, canonicalized via RFC 8785 JCS, hashed with `viem.keccak256` — Phase 4 verifier will reproduce the hash byte-for-byte by importing `computeReasoningHash` unmodified.

**REQ-05 (Three Mantle RWA Subjects Rated) — satisfied (engine-side).** All 3 locked subjects (USDY, cmETH, FBTC on Mantle Mainnet) produce a complete reasoning JSON in --mock mode (verified by automated test + manual CLI smoke). The historical-replay reuse hook is in place: every adapter accepts `blockNumber?: bigint` and threads it through every read; rate() forwards it via the `RateOptions.blockNumber` field. Phase 3's Elixir deUSD historical-downgrade reconstruction can pass the pre-failure block and the same engine code path will return state pinned to that block.

**Phase 3 import surface (locked):**
- `import { rate } from "@touchstone/agent";` or `import { rate } from "../agent/src/rate.js"` (relative)
- Phase 3's `RatingRequested` listener: `const { doc, reasoningHash } = await rate(subjectId, { blockNumber });`
- Phase 3 publish: `await ratingRegistry.publishRating(subjectAddress, doc.grade.uint8, reasoningHash, doc.confidence)`
- The engine guarantees `doc.grade.uint8 ∈ [0, 9]` and `doc.confidence ∈ [30, 100]` via the zod schema + synthesize.ts T-2-02 throw — Phase 3's revert paths are dead-code under correct engine output.

**Phase 4 import surface (locked):**
- `import { computeReasoningHash, canonicalizeDoc } from "../agent/src/hash.js"` — same canonical-bytes contract
- Phase 4 fetches reasoning JSON from IPFS, runs `computeReasoningHash(JSON.parse(rawBytes))`, compares against `latestRating(subject).reasoningHash` from the RatingRegistry contract
- Hash determinism proven by the Wave 3 hash-determinism tests + Wave 4 rate determinism test (2 sequential `rate("USDY", { mock: true, blockNumber: 75_000_000n })` runs → byte-identical reasoningHash)

**Test coverage at phase close:**
- 22 test files, 185 tests, 0 failures, 0 skips
- Every dimension scorer: ≥3 unit tests covering typical / missing-fact / boundary
- Every subject: ≥7 adapter tests + 1 golden ReasoningDocument test
- Hash module: 11 tests (6 hash basics + 5 determinism)
- Claude pipeline: 12 mock tests + 4 golden tests (engine-override discipline + one-retry path + API-key scrubbing)
- Wave 4: 7 rate() pipeline tests + 5 CLI smoke tests + 4 env-safety tests

**Cost projection for Phase 3:** Each live rating consumes ~$0.05–$0.10 in Anthropic tokens on `claude-opus-4-8` (per Wave 3 estimate). 3 ratings per demo ≈ $0.30. Phase 3 publisher should budget similarly for its `RatingRequested` handler.

## Next Phase Readiness

- **No blockers.** Phase 3 (publisher: IPFS pin + on-chain `publishRating` + ERC-8004 enforcement + `RatingRequested` listener) can begin immediately.
- **Phase 3 reads:** `rate()` from `agent/src/rate.ts`; `computeReasoningHash` from `agent/src/hash.ts` (the publisher already has the hash returned by `rate()`, but Phase 3 may want to recompute for defense-in-depth before calling publishRating).
- **Phase 4 reads:** `computeReasoningHash` + `canonicalizeDoc` from `agent/src/hash.ts`; the BANDS constants from `agent/src/dimensions/*.ts` for drill-down UI rendering.
- **Demo-day operator checklist:**
  1. Ensure root `.env` has `ANTHROPIC_API_KEY` set
  2. (Optional) Set `MANTLE_RPC_URL` to a private RPC if rate-limiting is a concern
  3. (Optional) Set `CLAUDE_MODEL` to override the default `claude-opus-4-8`
  4. From `agent/`: `pnpm rate USDY` / `pnpm rate cmETH` / `pnpm rate FBTC` to produce 3 live ReasoningDocuments
  5. Eyeball each `dimensions[*].rationale` for `[N]` citation markers and confirm each `citations[N].source.address` is either `static_config` or a real Mantle address

---
*Phase: 02-rating-engine-core*
*Plan: 05-cli-e2e*
*Completed: 2026-06-09*
