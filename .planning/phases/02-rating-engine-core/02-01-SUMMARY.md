---
phase: 02-rating-engine-core
plan: 01
subsystem: engine-scaffold
tags: [typescript, pnpm, vitest, zod, viem, anthropic-sdk, canonicalize, tsx, strict-tsc]

# Dependency graph
requires:
  - phase: 01-lock-skeleton
    provides: src/constants/GradeEnum.sol (Solidity source-of-truth for grade encoding), src/RatingRegistry.sol (publishRating bounds the engine must respect), root .env populated with PRIVATE_KEY + MANTLE_RPC_URL + MANTLE_SEPOLIA_RPC_URL + MANTLE_EXPLORER_KEY + (newly-added) ANTHROPIC_API_KEY
provides:
  - agent/ TypeScript workspace compiling under tsc --strict + NodeNext
  - GRADE_LETTER_TO_UINT8 / GRADE_UINT8_TO_LETTER / GRADE_MAX mirror of GradeEnum.sol
  - parseReasoningDocument (zod) — locked ReasoningDocument schema with on-chain bound mirrors (T-2-02 mitigation)
  - SubjectFacts / Fact / SubjectId type contracts (D-01, D-12)
  - Band / BandResult type contracts (D-06)
  - pnpm rate script that loads root .env via tsx --env-file=../.env (T-2-01 mitigation by absence — no agent-local .env)
  - root .gitignore extended with node_modules/, agent/out/, agent/dist/
affects: [02-02-subjects, 02-03-dimensions, 02-04-claude, 02-05-cli]

# Tech tracking
tech-stack:
  added:
    - viem@^2.52.2 (RPC client for Mantle Mainnet reads)
    - "@anthropic-ai/sdk@^0.102.0" (Claude tool-use synthesizer dep for Wave 3)
    - canonicalize@^3.0.0 (RFC 8785 JCS — D-13)
    - zod@^4.4.3 (schema enforcement at engine boundary)
    - zod-to-json-schema@^3.25.2 (used in Wave 3 to author the submit_rating tool input_schema)
    - vitest@^4.1.8 (test framework — divergent from Phase 1 forge)
    - tsx@^4.22.4 (ESM-friendly Node TS runner with --env-file support)
    - typescript@^5.9.3 (strict mode + NodeNext moduleResolution)
    - "@types/node@^22.19.20"
  patterns:
    - "Constant-mirror discipline: TS file mirrors Solidity GradeEnum byte-for-byte; tripwire test asserts each pair literally + MAX=9 + 10-letter cardinality + round-trip identity"
    - "Schema-level on-chain bound mirror: zod schema enforces grade.uint8 ≤ 9 + confidence ≤ 100 so engine never emits a document that would revert RatingRegistry"
    - "Single-source secrets via root .env: engine reads root project .env (where Phase 1 secrets already live); no agent-local .env or .env.example created; root .gitignore .env rule covers agent/.env (verified via git check-ignore)"
    - "Per-task atomic commits with type(02-01): subject format carried from Phase 1"
    - "TDD: every test file written first (RED commit) and assertion-target file added in the next commit (GREEN commit) — 2 task-level cycles in this plan"
    - "NodeNext .js extension discipline on all relative imports (TS2835-safe under tsc --noEmit even though vitest tolerates omission)"

key-files:
  created:
    - agent/package.json
    - agent/tsconfig.json
    - agent/vitest.config.ts
    - agent/pnpm-lock.yaml
    - agent/src/index.ts
    - agent/src/constants/grade-enum.ts
    - agent/src/subjects/types.ts
    - agent/src/dimensions/types.ts
    - agent/src/schema.ts
    - agent/tests/_setup.ts
    - agent/tests/constants/grade-enum.test.ts
    - agent/tests/schema.test.ts
  modified:
    - .gitignore (added node_modules/, agent/out/, agent/dist/)

key-decisions:
  - "Used pnpm (not npm) — pnpm v10.33.0 is present in the dev environment and is the package manager named in PLAN code excerpts; lockfile committed as agent/pnpm-lock.yaml"
  - "Added .js extensions to ALL relative TS imports to satisfy NodeNext moduleResolution; vitest tolerated omission but `pnpm typecheck` (acceptance criterion for Task 2-01-01) did not — Rule 1 bug fix applied during Task 3"
  - "Extended root .gitignore (not agent/.gitignore) to cover node_modules/, agent/out/, agent/dist/ — Rule 3 blocking fix; the plan forbids creating agent/.gitignore but does not forbid editing the root one; preserves the 'single source of gitignore' principle the plan establishes for secrets"
  - "Locked schema_version literal '1.0.0' per CONTEXT specifics (defensive forward-compat); easy revert if user objects"

patterns-established:
  - "Constant-mirror discipline (Solidity → TS): GradeEnum mapping mirrored byte-for-byte with tripwire test hard-asserting each pair plus MAX and round-trip"
  - "On-chain bound mirror (Solidity → zod): RatingRegistry.publishRating bounds replicated in zod schema as defense-in-depth so the engine never emits a doc that would revert (T-2-02 mitigation)"
  - "Static-config citation source convention: zod regex accepts EITHER 0x...40-hex OR literal 'static_config' for citation.source.address — enables off-chain facts (issuer, audit firm, etc.) to be cited with versioned provenance distinct from on-chain reads"
  - "TDD discipline carry-over: RED (failing test) → GREEN (impl) → optional REFACTOR, each as a separate commit; per-test docstrings include the [{phase}-{plan}-{task}] traceability prefix"

requirements-completed: [REQ-01]

# Metrics
duration: ~10 min
completed: 2026-06-09
---

# Phase 2 Plan 1: Engine Scaffold + Locked Contracts Summary

**TypeScript agent/ workspace bootstrapped under strict tsc + NodeNext, with the GradeEnum TS mirror, the locked ReasoningDocument zod schema enforcing on-chain bounds, and the SubjectFacts/Band type contracts that all downstream waves consume.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-09T04:20:00Z (approx)
- **Completed:** 2026-06-09T04:30:00Z (approx)
- **Tasks:** 3
- **Files created:** 12 (10 in agent/, 1 lockfile, 1 modified root .gitignore)

## Accomplishments

- Agent workspace compiles under `tsc --noEmit --strict --moduleResolution NodeNext` (Task 2-01-01 acceptance criterion: `pnpm typecheck` exits 0)
- 73 npm packages installed via pnpm 10.33.0; lockfile committed for deterministic future installs
- GradeEnum TS mirror produced and verified byte-for-byte against `src/constants/GradeEnum.sol` (Solidity → TS); 13 tests assert each of the 10 letter→uint8 pairs literally plus MAX=9, length=10, round-trip
- ReasoningDocument zod schema locked per D-12; 11 tests cover every threat-model boundary (grade > 9, grade < 0, confidence > 100, confidence < 30, fractional confidence, chain_id != 5000, dimensions.length != 4, citation.source.address malformed, static_config sentinel accepted, schema_version != "1.0.0")
- SubjectFacts / Fact / SubjectId types exported for Wave 1 subject adapters; Band / BandResult types exported for Wave 2 dimension scorers
- T-2-01 mitigation achieved by absence: no `agent/.env`, no `agent/.env.example`, no `agent/.gitignore`. Engine loads root `.env` via `tsx --env-file=../.env` in the `pnpm rate` script. `git check-ignore -q agent/.env` confirms root .gitignore correctly covers the path even though the file doesn't exist on disk.
- Total: 24 vitest tests, all green (0 failures, 0 skips)

## Task Commits

Each task was committed atomically. TDD tasks have RED + GREEN commits.

1. **Task 2-01-01: Scaffold agent package (package.json, tsconfig, vitest) wired to root .env** — `fbbbb36` (feat)
2. **Task 2-01-02: Mirror GradeEnum to TS with byte-for-byte parity test**
   - RED: `609f0ef` (test)
   - GREEN: `a83e11a` (feat)
3. **Task 2-01-03: Lock ReasoningDocument zod schema + SubjectFacts/Band type contracts**
   - RED: `37ac2bb` (test)
   - GREEN: `5d361e4` (feat — includes inline Rule 1 fix: .js extensions on relative imports for NodeNext)

## Files Created/Modified

### Created
- `agent/package.json` — workspace declaration; deps pinned per plan (viem ^2.52.2, @anthropic-ai/sdk ^0.102.0, canonicalize ^3.0.0, zod ^4.4.3, zod-to-json-schema ^3.24.0, vitest ^4.1.8, tsx ^4.22.4, typescript ^5.6.0, @types/node ^22.0.0); `rate` script loads root .env via `tsx --env-file=../.env`
- `agent/tsconfig.json` — ES2022 + NodeNext + strict + isolatedModules + noEmit + types: [node, vitest/globals]
- `agent/vitest.config.ts` — globals, node environment, tests/**/*.test.ts include, 15s testTimeout
- `agent/pnpm-lock.yaml` — pnpm lockfile (73 packages); committed for `pnpm install --frozen-lockfile` reproducibility
- `agent/src/index.ts` — barrel re-exports (grade enum + schema + subjects/dimensions types)
- `agent/src/constants/grade-enum.ts` — GradeEnum TS mirror; PATTERNS §1 constant-mirror exact analog of `src/constants/GradeEnum.sol`
- `agent/src/subjects/types.ts` — SubjectId / Fact / SubjectFacts (D-01, D-12)
- `agent/src/dimensions/types.ts` — Band / BandResult (D-06)
- `agent/src/schema.ts` — ReasoningDoc zod schema + parseReasoningDocument (D-12 lock + T-2-02 mitigation)
- `agent/tests/_setup.ts` — placeholder for Wave 2/3 shared mocks
- `agent/tests/constants/grade-enum.test.ts` — 13 GradeEnum mirror tests
- `agent/tests/schema.test.ts` — 11 ReasoningDocument bound tests

### Modified
- `.gitignore` — added `node_modules/`, `agent/out/`, `agent/dist/` (Rule 3 deviation; see below)

## Decisions Made

- **Package manager:** `pnpm` (not `npm`). PLAN action step says "from inside `agent/`, run `pnpm install` (or `npm install` if pnpm is unavailable — Claude's discretion per CONTEXT)". pnpm 10.33.0 is present and is the canonical choice in all PLAN code excerpts (`pnpm typecheck`, `pnpm test`, `pnpm rate`). Lockfile committed as `agent/pnpm-lock.yaml`.
- **NodeNext + .js extensions:** PLAN code excerpts use bare-specifier imports like `from "../src/schema"`. Vitest tolerates this, but `tsc --noEmit` under NodeNext does not (TS2835). Added `.js` extensions to all 6 relative imports across barrel + 2 test files. Runtime behavior unchanged; ESM `.js` extension is the canonical NodeNext convention.
- **schema_version literal:** Locked as `"1.0.0"`. Researcher recommended this defensive forward-compat field; CONTEXT specifics §schema-versioning-hedge formally proposed it. Easy revert if the user objects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended root .gitignore with node_modules/ and agent build dirs**
- **Found during:** Task 2-01-01 (scaffold)
- **Issue:** Root `.gitignore` did not cover `node_modules/`. `pnpm install` writes ~73 packages into `agent/node_modules/`, which would have appeared as untracked in every subsequent `git status` and (worse) been at risk of accidental commit via `git add agent/`. PLAN-acceptance forbids creating `agent/.gitignore`, so the only safe place to add the rule is root `.gitignore`.
- **Fix:** Added `node_modules/`, `agent/out/`, `agent/dist/` under a new "Node / TypeScript engine (Phase 2 agent/)" section in root `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** `git status --short` shows no `node_modules/` entries after pnpm install. `git check-ignore -q agent/.env` continues to return 0 (existing `.env` / `.env.*` / `!.env.example` rules preserved).
- **Committed in:** `fbbbb36` (Task 2-01-01 commit)

**2. [Rule 1 - Bug] Added .js extensions to relative imports for NodeNext compatibility**
- **Found during:** Task 2-01-03 (schema + types + barrel)
- **Issue:** `tsc --noEmit` failed with TS2835 on 4 imports (`./constants/grade-enum`, `./subjects/types`, `./dimensions/types`, `./schema`, plus 2 test-file imports). NodeNext moduleResolution requires explicit `.js` extensions on relative ESM imports. PLAN code excerpts omitted them. Vitest tolerated the omission (24/24 tests passed), but `pnpm typecheck` — explicitly an acceptance criterion for Task 2-01-01 — did not.
- **Fix:** Added `.js` extensions to all 6 relative imports (barrel + 2 test files). Code excerpts in PLAN were authored with the wrong assumption; behavior unchanged.
- **Files modified:** `agent/src/index.ts`, `agent/tests/constants/grade-enum.test.ts`, `agent/tests/schema.test.ts`
- **Verification:** `pnpm typecheck` exits 0; `pnpm test` still 24/24 green.
- **Committed in:** `5d361e4` (Task 2-01-03 GREEN commit — folded in alongside the schema impl since they're a single conceptual unit)

---

**Total deviations:** 2 auto-fixed (1 blocking — gitignore, 1 bug — NodeNext .js extensions)
**Impact on plan:** Both auto-fixes essential for the plan's own acceptance criteria (`pnpm typecheck` exits 0 + no spurious untracked files). No scope creep. No PLAN code paths or contracts changed.

## Issues Encountered

- None outside the two auto-fixed deviations above.

## Authentication Gates

None — Wave 0 is pure scaffold + locked-contract types. No external services touched.

## Self-Check Results

Files claimed created (all verified present on disk):
- agent/package.json — FOUND
- agent/tsconfig.json — FOUND
- agent/vitest.config.ts — FOUND
- agent/pnpm-lock.yaml — FOUND
- agent/src/index.ts — FOUND
- agent/src/constants/grade-enum.ts — FOUND
- agent/src/subjects/types.ts — FOUND
- agent/src/dimensions/types.ts — FOUND
- agent/src/schema.ts — FOUND
- agent/tests/_setup.ts — FOUND
- agent/tests/constants/grade-enum.test.ts — FOUND
- agent/tests/schema.test.ts — FOUND

Files claimed forbidden (all verified absent on disk):
- agent/.env — ABSENT (T-2-01 mitigation by absence)
- agent/.env.example — ABSENT (single source of env templates is root .env.example)
- agent/.gitignore — ABSENT (root .gitignore covers all required paths)

Commits claimed (all verified via `git log --oneline`):
- fbbbb36 — FOUND
- 609f0ef — FOUND
- a83e11a — FOUND
- 37ac2bb — FOUND
- 5d361e4 — FOUND

Test/typecheck final results:
- `pnpm install --frozen-lockfile` exits 0
- `pnpm typecheck` exits 0
- `pnpm test` exits 0 — 24/24 passing (13 grade-enum + 11 schema)
- No `PRIVATE_KEY` reference in any agent/ file (T-2-01 mitigation, ripgrep verified)

## Self-Check: PASSED

## Threat Flags

None — Wave 0 introduces no network endpoints, auth surface, or external integrations. The two threats addressed (T-2-01 secrets, T-2-02 on-chain bound mirror) were both planned in the threat_model and are mitigated as documented.

## Next Phase Readiness

- Wave 0 contracts ready for Wave 1 (subjects) and Wave 2 (dimensions) to import: `SubjectFacts`, `Band`, `BandResult`, `GRADE_*`, `parseReasoningDocument`, `ReasoningDocument`.
- Engine loads root `.env` correctly via `tsx --env-file=../.env`. Wave 4 CLI work and Wave 3 Claude integration will inherit this single-source-of-secrets path.
- `agent/src/index.ts` barrel is the canonical import surface for Phase 3 (publisher) and Phase 4 (verifier) — they should import from `@touchstone/agent` (workspace) or `../agent/src/index.js` (relative).
- No blockers. Phase 2 Plan 2 (subjects adapters) can begin immediately.

---
*Phase: 02-rating-engine-core*
*Completed: 2026-06-09*
