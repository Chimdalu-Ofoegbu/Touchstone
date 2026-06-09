---
phase: 2
slug: rating-engine-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (TypeScript, ESM-first, fast watch mode) |
| **Config file** | `agent/vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `pnpm --filter agent test -- --run --reporter=dot` |
| **Full suite command** | `pnpm --filter agent test -- --run` |
| **Estimated runtime** | ~15 seconds for quick run; ~30 seconds full (without live RPC/Anthropic) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (unit + scoped golden)
- **After every plan wave:** Run full suite (unit + golden + hash determinism)
- **Before `/gsd-verify-work`:** Full suite must be green AND `pnpm rate USDY` produces a valid ReasoningDocument on disk
- **Max feedback latency:** 30 seconds (CI without live API)

Live RPC + Anthropic integration is gated by `RUN_LIVE=1` and runs once per wave commit on the engineer's machine (not in CI).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | REQ-01 | T-2-01 | Engine package compiles; tsc strict mode passes; no leak of `ANTHROPIC_API_KEY` in build output | unit | `pnpm --filter agent build` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | REQ-01 | — | GradeEnum TS mirror equals Solidity uint8 mapping byte-for-byte | unit | `pnpm --filter agent test -- grade-enum.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 0 | REQ-01 | T-2-02 | ReasoningDocument zod schema rejects out-of-range grade (>9) and confidence (>100) | unit | `pnpm --filter agent test -- schema.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | REQ-05 | T-2-03 | USDY adapter calls Multicall3 once at pinned block; returns SubjectFacts with `missing_facts` populated for unread keys | unit | `pnpm --filter agent test -- subjects/usdy.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | REQ-05 | T-2-03 | cmETH adapter same contract; honors blockNumber | unit | `pnpm --filter agent test -- subjects/cmeth.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | REQ-05 | T-2-03 | FBTC adapter same contract; honors blockNumber | unit | `pnpm --filter agent test -- subjects/fbtc.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 1 | REQ-05 | — | Static facts file is versioned (`schema_version`) and frozen at load time | unit | `pnpm --filter agent test -- subjects/static.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | REQ-01 | T-2-04 | collateral_quality scorer: band lookup deterministic; missing fact → score=50 + confidence-5 | unit | `pnpm --filter agent test -- dimensions/collateral.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | REQ-01 | T-2-04 | contract_risk scorer same contract | unit | `pnpm --filter agent test -- dimensions/contract-risk.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 2 | REQ-01 | T-2-04 | oracle_integrity scorer same contract | unit | `pnpm --filter agent test -- dimensions/oracle.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-04 | 03 | 2 | REQ-01 | T-2-04 | liquidity_stability scorer same contract | unit | `pnpm --filter agent test -- dimensions/liquidity.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 3 | REQ-01 | T-2-05 | Anthropic adapter forces `submit_rating` tool; one-retry path on schema mismatch wired | unit (mock) | `pnpm --filter agent test -- claude.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-02 | 04 | 3 | REQ-01 | T-2-06 | `canonicalize() + keccak256` matches a fixed-input golden hash | unit | `pnpm --filter agent test -- hash.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-03 | 04 | 3 | REQ-01 | T-2-06 | Re-canonicalize same ReasoningDocument twice → identical hash (determinism) | unit | `pnpm --filter agent test -- hash-determinism.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-04 | 04 | 3 | REQ-01 | — | Per-subject golden ReasoningDocument fixture matches at a pinned mock-fact set | golden | `pnpm --filter agent test -- goldens/` | ❌ W0 | ⬜ pending |
| 2-05-01 | 05 | 4 | REQ-01,REQ-05 | T-2-07 | CLI `pnpm rate USDY` produces a valid ReasoningDocument JSON to stdout AND a file under `agent/.out/` | e2e | `pnpm --filter agent rate -- USDY --mock` | ❌ W0 | ⬜ pending |
| 2-05-02 | 05 | 4 | REQ-05 | — | All 3 subjects pass the CLI smoke test in `--mock` mode | e2e | `pnpm --filter agent test:cli` | ❌ W0 | ⬜ pending |
| 2-05-03 | 05 | 4 | REQ-01 | T-2-01 | `.env.example` exists; `ANTHROPIC_API_KEY` referenced in README; no key in committed files | unit | `pnpm --filter agent test -- env-safety.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `agent/package.json` — declares `vitest`, `viem`, `@anthropic-ai/sdk`, `canonicalize`, `zod`, `tsx` deps + `pnpm rate` script
- [ ] `agent/tsconfig.json` — strict, ESNext, NodeNext, no `any`
- [ ] `agent/vitest.config.ts` — globals, environment node, `include: ['src/**/*.test.ts', 'tests/**/*.test.ts']`
- [ ] NO `agent/.env.example` is created — engine reads root project `.env` via `tsx --env-file=../.env` in pnpm `rate` script (see Plan 01 Task 2-01-01). `ANTHROPIC_API_KEY`, `MANTLE_RPC_URL`, `CLAUDE_MODEL` all live in root `.env`. Locked CLAUDE_MODEL default in code (Plan 04): `claude-opus-4-8`.
- [ ] `agent/src/constants/grade-enum.ts` — Solidity-mirror with locked-byte assertion
- [ ] `agent/src/schema.ts` — zod schema for ReasoningDocument; `parseReasoningDocument()` export
- [ ] `agent/tests/conftest-style helpers under tests/_setup.ts` — mock Anthropic client + mock RPC fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Mantle Mainnet RPC reads succeed at `latest` block | REQ-05 | RPC quota / availability is environmental; CI cannot guarantee | Set `RUN_LIVE=1`, run `pnpm rate USDY` and confirm the output JSON references a real recent `ingest_block` |
| Live Anthropic call produces a citation-grounded rationale | REQ-01 | Costs money and needs API key | Set `RUN_LIVE=1`, `ANTHROPIC_API_KEY` exported; run `pnpm rate USDY`; eyeball the `dimensions[*].rationale` for `[1]`-style citations and that the citations array maps to real fact labels |
| Hash recomputed in Phase 4 frontend matches Phase 2 hash | REQ-01 (cross-phase) | Phase 4 doesn't exist yet | Defer to Phase 4. Phase 2 records the hash + canonical JSON to `agent/.out/{subject}.json` + `.hash` for Phase 4 to compare |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
