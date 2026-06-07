# STATE.md — Touchstone

> Project memory. Updated by orchestrators after each phase/plan transition.

## Project Reference

- **Project:** Touchstone
- **Core value:** Credit-ratings agent for on-chain RWA assets on Mantle. Ingests risk data, scores deterministic dimensions, uses Claude to synthesize a letter grade (AAA–D) with cited rationale, publishes on-chain under an ERC-8004 identity with a verifiable reasoning hash. Moody's of the agentic economy.
- **Current focus:** Phase 1 — Lock + Skeleton.
- **Ship target:** 2026-06-12 (user). Buffer: 2026-06-13. Official deadline: 2026-06-15.
- **Today:** 2026-06-07.

## Current Position

- **Phase:** 1 — Lock + Skeleton
- **Plan:** None yet (awaiting `/gsd-plan-phase 1`)
- **Status:** Roadmap drafted; not yet started building.
- **Progress:** `[          ] 0/5 phases complete`

## Performance Metrics

- **Phases planned:** 5
- **Phases complete:** 0
- **Requirements mapped:** 15/15 (100% coverage)
- **v1 requirements:** 15
- **v2 deferred:** 5
- **Days of runway (user target):** 5 working days (2026-06-08 → 2026-06-12)
- **Days of runway (official deadline):** 8 days (2026-06-08 → 2026-06-15)

## Accumulated Context

### Locked Decisions (13, spec-asserted)

Listed in `.planning/PROJECT.md` under `<decisions>`. Two were modified at planning time per user timeline_override:
- **DEC-five-deterministic-risk-dimensions → FOUR.** Governance/custodian dimension dropped per DEC-scope-cut-sequence #3.
- **DEC-scope-cut-sequence applied proactively** for cuts #1, #3, #4 (not just contingency).

### Open Discovery Items (resolve in Phase 1)

1. **Mantle availability + addresses** for USDY, mETH, fBTC, MI4, Ethena USDe + relevant lending markets. Output: confirmed three-subject selection.
2. **ERC-8004 status on Mantle.** Are canonical Identity and Reputation Registries deployed? If not, reference deployment plan.
3. **2025 failure selection** for historical-downgrade proof. Verify specifics before committing (tokenized-yield depeg, synthetic-dollar depeg, lending bad-debt, or RWA custodian failure).
4. **Per-track prize allocation** if Mantle has published it.

### Risks Tracked

- **Cherry-picked accuracy** → mitigated by historical-downgrade proof on a real 2025 failure (REQ-06).
- **AI x RWA crowding** → ratings-first positioning, upstream-of-yield framing in pitch.
- **ERC-8004 not on Mantle** → Phase 1 confirmation; reference deployment is the fallback.
- **Reasoning reads as generic** → CON-llm-prompt-evidence-citation enforced in agent prompt.
- **Attention split with Sui Overflow** (deadline 2026-06-16) → Phase 1 front-loads the 20 Project Deployment Award bar so worst-case finish still clears it.
- **Compressed timeline** (5 days vs 8) → cuts already baked in; cuts #2 and #5 remain contingency.

### Open Todos

- [ ] Phase 1 — execute Phase-0 discovery and skeleton deployment (see ROADMAP Phase 1).
- [ ] User: confirm IPFS pinning provider (web3.storage vs Pinata) before Phase 3.
- [ ] User: pick light vs dark variant of editorial aesthetic before Phase 4 (DEC-aesthetic-direction-editorial — "pick one and execute completely").
- [ ] User: confirm whether contract goes on Mantle Mainnet or Testnet for ship.

### Blockers

None. Intel marked READY (no blockers, no competing variants).

## Session Continuity

- **Last session:** 2026-06-07 — Planning artifacts generated from intel by `gsd-roadmapper` under `new-project-from-ingest` mode with `timeline_override` compressing 7 spec phases to 5 working-day phases.
- **Next session:** `/gsd-plan-phase 1` to decompose Phase 1 into executable plans.
- **Artifacts written this session:**
  - `.planning/PROJECT.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/ROADMAP.md`
  - `.planning/STATE.md`
- **Intel sources consulted:**
  - `.planning/intel/SYNTHESIS.md`
  - `.planning/intel/decisions.md`
  - `.planning/intel/requirements.md`
  - `.planning/intel/constraints.md`
  - `.planning/intel/context.md`
