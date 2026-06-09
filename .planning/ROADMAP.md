# ROADMAP.md — Touchstone

**Granularity:** standard (5 phases per user timeline_override compressing the original 7-phase spec).
**Coverage:** 15/15 v1 requirements mapped. No orphans.
**Ship window:** 2026-06-08 → 2026-06-12 (5 working days). Day 6 (2026-06-13) reserved as unused buffer. Official deadline 2026-06-15.

## Phases

- [x] **Phase 1: Lock + Skeleton** (Day 1, 2026-06-08) — Phase 0 verification (subjects, ERC-8004, 2025 failure, prize allocation) AND deploy verified `RatingRegistry.sol` skeleton on Mantle with stub `requestRating` → stub `publishRating`. **Complete 2026-06-08** (+ post-review WR-01/WR-02/WR-03/WR-04 hardening redeploy same day). Canonical Sepolia address `0x54163E309f7C8108F7110B086F640882a97f3838`, verified on Mantlescan. Smoke `requestRating` tx from non-agent wallet confirmed. 20 Project Deployment Award technical bar CLEARED. Superseded Phase 1.0 deploy at `0x0912bcBd57579179388cE9d4863032406dCfBe18` left on-chain as historical record. See `.planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md`.
- [ ] **Phase 2: Rating Engine Core** (Day 2, 2026-06-09) — Data ingestion, four deterministic scoring modules, Claude reasoning step. Hardcode three subjects.
- [ ] **Phase 3: On-Chain Publish + ERC-8004 + Historical Reconstruction Start** (Day 3, 2026-06-10) — Real `publishRating`, IPFS pinning, agent identity NFT mint, `latestRating`/`ratingHistory` reads. Begin pre-failure state reconstruction.
- [ ] **Phase 4: Frontend (3 Screens) + Historical Proof Finish** (Day 4, 2026-06-11) — Ratings terminal, reasoning drill-down, track-record view with finished historical-downgrade proof.
- [ ] **Phase 5: Ship** (Day 5, 2026-06-12) — Record ≥ 2-minute demo video, write README with deployed addresses, DoraHacks submission, AI x RWA + AI Alpha & Data nominations, final QA. No new building.

## Phase Details

### Phase 1: Lock + Skeleton
**Day:** 1 — 2026-06-08
**Goal:** End of day, the 20 Project Deployment Award technical bar is cleared and all open Phase-0 questions are resolved so the build path is unblocked.
**Depends on:** Nothing (first phase).
**Requirements:** REQ-15 (full), REQ-02 (skeleton only)
**Success Criteria** (what must be TRUE):
  1. Mantle availability is confirmed and addresses captured for the candidate subject set (USDY, mETH, fBTC, MI4, Ethena USDe); three subjects are committed for ship.
  2. ERC-8004 Identity and Reputation Registry status on Mantle is known: either canonical contracts are located, or reference deployment is planned and timeboxed.
  3. A specific 2025 RWA/stablecoin failure is selected and verified as the historical-downgrade-proof subject, with pre-failure data sources identified.
  4. Skeleton `RatingRegistry.sol` is deployed on Mantle (Mainnet or Testnet), verified on Mantle Explorer, and exposes stub `requestRating` → stub `publishRating` callable on-chain — meeting the 20 Project Deployment Award technical bar.
**Plans:** TBD

**Plans:** 5 plans
Plans:
- [ ] 02-01-scaffold-PLAN.md — agent/ workspace, GradeEnum TS mirror, locked ReasoningDocument zod schema (REQ-01)
- [ ] 02-02-subjects-PLAN.md — viem + Multicall3 + per-subject adapters (USDY, cmETH, FBTC) + versioned static facts (REQ-05)
- [ ] 02-03-dimensions-PLAN.md — 4 banded scorers (collateral, contract, oracle, liquidity) + synthesize() combiner (REQ-01)
- [ ] 02-04-claude-hash-PLAN.md — single-shot Anthropic tool-use synthesis + RFC 8785 JCS hash + 3 golden tests (REQ-01)
- [ ] 02-05-cli-e2e-PLAN.md — rate() orchestrator + pnpm rate CLI + post-hoc citation validation + env-safety + human-verify (REQ-01, REQ-05)

### Phase 3: On-Chain Publish + ERC-8004 + Historical Reconstruction Start
**Day:** 3 — 2026-06-10
**Goal:** Real ratings — produced by the Phase 2 engine — are published on-chain under an enforced ERC-8004 agent identity with verifiable IPFS-pinned reasoning, and historical-state reconstruction is underway.
**Depends on:** Phase 1 (skeleton contract, ERC-8004 plan), Phase 2 (engine output).
**Requirements:** REQ-02 (real publish), REQ-03, REQ-04, REQ-06 (start)
**Success Criteria** (what must be TRUE):
  1. An ERC-8004 Identity Registry NFT is held by the agent on Mantle (canonical if available, reference deployment otherwise), and `publishRating` reverts when called from any other address.
  2. The agent listens for `RatingRequested` events on Mantle, runs the Phase 2 engine, pins the reasoning JSON to IPFS, and writes `publishRating(subject, grade, reasoningHash, confidence)` such that `reasoningHash == keccak256(canonical reasoning JSON bytes)`.
  3. `latestRating(subject)` and `ratingHistory(subject)` return the published `Rating` struct (subject, grade, reasoningHash, confidence, timestamp, agentIdentity) for at least one subject end-to-end.
  4. Pre-failure on-chain state for the Phase-1-selected 2025 failure is reconstructed and ready for the Phase 4 historical-downgrade proof run.
**Plans:** TBD

### Phase 4: Frontend (3 Screens) + Historical Proof Finish
**Day:** 4 — 2026-06-11
**Goal:** A newcomer can land on the public terminal, understand which Mantle RWA assets are safe and why, verify reasoning against the on-chain hash, and see the agent called a real 2025 failure before it happened.
**Depends on:** Phase 3 (on-chain ratings + identity + IPFS).
**Requirements:** REQ-06 (finish), REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12, REQ-13
**Success Criteria** (what must be TRUE):
  1. The ratings terminal home view loads the three published ratings as a ranked board where the grade chip (letter + text label + family color) is the largest object on each row, with sort/filter, sparkline, last-updated timestamp, and a staggered reveal page-load animation.
  2. The rating detail view shows a large grade, four risk dimensions as scored bars with one-line summaries, expandable to cited rationale where every claim links to its on-chain data source, plus a visible reasoning-hash verify control reporting match status against IPFS.
  3. The live request flow triggers on-chain `requestRating` from the UI and streams reasoning dimension by dimension before the final grade resolves; loading, empty, and error states are designed for every async edge.
  4. The track-record view renders the historical-downgrade proof as a timeline (agent low/deteriorating grade → real 2025 failure) and surfaces the agent's ERC-8004 identity address as a permanent record; reasoning cites the specific weakness that later broke.
  5. A first-time user with no DeFi knowledge can read what each grade and dimension means via inline plain-language explanations and jargon tooltips, keyboard-navigate the app with visible focus states, and reach legibility on a narrow screen sized for live demo.
**Plans:** TBD
**UI hint**: yes

### Phase 5: Ship
**Day:** 5 — 2026-06-12
**Goal:** Touchstone is submitted to DoraHacks with every award-gate deliverable in place, no new code being written, and one buffer day held in reserve.
**Depends on:** Phase 4 (public-accessible frontend + all on-chain artifacts).
**Requirements:** REQ-14
**Success Criteria** (what must be TRUE):
  1. A demo video ≥ 2 minutes is recorded walking the four pre-defined moments: terminal load, reasoning drill-down with citations, live rating trigger + on-chain publish, track-record timeline landing the historical-downgrade proof.
  2. The GitHub repo is public with a README covering setup, architecture, the deployed and verified Mantle contract address, the ERC-8004 identity address, the IPFS pinning service used, and the public demo URL.
  3. The DoraHacks submission is filed with the deployed contract address and the public demo URL, and nominated to both AI x RWA and AI Alpha & Data tracks.
  4. Final QA confirms the public demo is reachable (not localhost), `requestRating` → `publishRating` runs end-to-end on a fresh wallet, and the reasoning-hash verify control reports match on at least one rating.
**Plans:** TBD

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Lock + Skeleton | 3/3 | Complete | 2026-06-08 |
| 2. Rating Engine Core | 0/5 | Planned | - |
| 3. On-Chain Publish + ERC-8004 + Historical Start | 0/0 | Not started | - |
| 4. Frontend (3 Screens) + Historical Finish | 0/0 | Not started | - |
| 5. Ship | 0/0 | Not started | - |

## Coverage Notes

- 15/15 v1 requirements mapped to exactly one owning phase (REQ-02 skeleton work happens in Phase 1 but ownership of the full requirement sits in Phase 3; REQ-06 start happens in Phase 3 but completion is owned by Phase 4).
- Scope cuts already applied at planning time per DEC-scope-cut-sequence: #1 (live reputation loop), #3 (governance/custodian dimension), #4 (subjects 5 → 3). See `.planning/PROJECT.md` and v2 deferred list in `.planning/REQUIREMENTS.md`.
- Contingency cuts available if a phase slips: #2 (off-chain metadata depth), then #5 (public `requestRating` → manual admin trigger, on-chain preserved).
- Buffer: 2026-06-13 is held empty. Official deadline 2026-06-15 gives an additional 2 days of true emergency margin.
