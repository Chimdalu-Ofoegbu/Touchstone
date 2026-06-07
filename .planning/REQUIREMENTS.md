# REQUIREMENTS.md — Touchstone

Derived from `.planning/intel/requirements.md` (14 ingested requirements). Re-IDed under stable `REQ-NN` form for traceability. Original intel IDs retained as `Origin` for provenance. Scope reflects the compressed 5-phase plan (governance/custodian dropped, live reputation loop replaced with designed view, three subjects).

## v1 (Ship Scope)

### REQ-01 — Rating Engine Pipeline
- **Origin:** REQ-rating-engine-pipeline
- **Category:** AGENT
- **Description:** Off-chain rating engine that ingests on-chain (and limited off-chain) data for an RWA subject, scores it across **four** deterministic risk dimensions (collateral quality, contract risk, oracle integrity, liquidity and stability), performs an LLM (Claude) reasoning step, and publishes a grade + reasoning hash + confidence on-chain.
- **Acceptance:**
  - Pipeline executes Ingest → Score (4 dimensions, 0–100 each) → Reason (Claude) → Publish (IPFS pin + `publishRating`).
  - Deterministic scoring code is separated from the LLM step in the codebase (CON-deterministic-vs-llm-separation).
  - LLM reasoning prompt enforces evidence-citation: every rationale names specific on-chain data points (CON-llm-prompt-evidence-citation).
- **Scope:** TS/Node agent.

### REQ-02 — RatingRegistry Contract
- **Origin:** REQ-rating-registry-contract
- **Category:** CONTRACT
- **Description:** `RatingRegistry.sol` deployed and verified on Mantle, storing published ratings keyed by subject.
- **Acceptance:**
  - `publishRating(address subject, uint8 grade, bytes32 reasoningHash, uint8 confidence)` callable only by registered agent identity; emits `RatingPublished` (CON-publishRating-signature).
  - `requestRating(address subject)` callable by anyone; emits `RatingRequested` (CON-requestRating-signature).
  - `latestRating(address subject)` and `ratingHistory(address subject)` exposed as views (CON-read-interface).
  - Grade encoded as `uint8` 0–9 (CON-grade-encoding).
  - `Rating` struct fields: subject, grade, reasoningHash, confidence, timestamp, agentIdentity (CON-rating-schema).
  - Deployed and verified on Mantle Mainnet or Testnet (CON-public-deployment).
- **Scope:** Solidity + Foundry.

### REQ-03 — ERC-8004 Identity Mint and Enforcement
- **Origin:** REQ-erc8004-identity-mint
- **Category:** CONTRACT/AGENT
- **Description:** Agent mints and holds an ERC-8004 Identity Registry NFT. `publishRating` only succeeds when called from the registered agent identity. Identity is surfaced in the frontend track-record view.
- **Acceptance:**
  - Agent identity NFT minted on Mantle (canonical ERC-8004 if available; reference deployment of ERC-8004 if not, documented in README — CON-erc8004-identity).
  - `publishRating` enforces identity check.
  - Identity address surfaced in frontend track-record view.
- **Scope:** Contracts + agent + frontend.

### REQ-04 — IPFS Reasoning Pin + Hash Verification
- **Origin:** REQ-ipfs-reasoning-pin
- **Category:** AGENT/FRONTEND
- **Description:** Full reasoning JSON is pinned to IPFS; `bytes32` keccak256 hash is stored on-chain; frontend verifies fetched reasoning against the hash.
- **Acceptance:**
  - Reasoning JSON pinned via web3.storage or Pinata.
  - Reasoning JSON contains per-dimension scores (0–100), per-dimension rationale with cited evidence, synthesized letter grade, confidence, overall rationale (CON-reasoning-json-schema).
  - On-chain `reasoningHash == keccak256(canonical reasoning JSON bytes)`.
  - Frontend exposes verifiability control with visible match status (CON-verifiability-first-class).
- **Scope:** Agent + frontend.

### REQ-05 — Three Mantle RWA Subjects Rated
- **Origin:** REQ-subjects-rated (compressed from 5 to 3 per DEC-scope-cut-sequence #4)
- **Category:** AGENT/DATA
- **Description:** At demo time, three Mantle RWA subjects each have at least one published rating on-chain.
- **Acceptance:**
  - Three subjects selected from {USDY, mETH, fBTC, MI4, Ethena USDe} based on Phase 1 Mantle availability verification.
  - Selection criterion: live on Mantle with confirmable addresses, sufficient on-chain data for the four deterministic dimensions, and at least one distinguishable grade across the three (mix of grades is better demo than three identical AAAs).
  - Each subject has at least one `RatingPublished` event on Mantle by demo time.
- **Scope:** Agent + frontend data.

### REQ-06 — Historical-Downgrade Proof
- **Origin:** REQ-historical-downgrade-proof
- **Category:** AGENT/FRONTEND
- **Description:** Demonstrate the agent would have warned of a real 2025 RWA/stablecoin failure by reconstructing pre-failure on-chain state and showing the agent produces a low/deteriorating grade with reasoning naming the specific weakness that later broke.
- **Acceptance:**
  - One documented 2025 failure selected and verified in Phase 1 (candidate categories: tokenized-yield/synthetic-dollar depeg, lending-market bad-debt, RWA custodian failure).
  - Pre-failure on-chain state reconstructed transparently.
  - Agent run against historical state produces a low or deteriorating grade.
  - Reasoning cites the specific weakness that later broke.
  - Timeline shown in track-record view: agent downgrade → real-world failure.
- **Scope:** Agent + frontend.

### REQ-07 — Frontend: Ratings Terminal (Home)
- **Origin:** REQ-frontend-ratings-terminal
- **Category:** FRONTEND
- **Description:** Home view — ranked board of rated Mantle RWA subjects.
- **Acceptance:**
  - Each row shows: subject name + ticker, grade chip (letter + text label + family color, CON-grade-signaling-never-color-only), confidence, last-updated timestamp, sparkline of grade history.
  - Grade is the largest object on the row (CON-grade-is-largest-object).
  - Sort and subject filter controls.
  - Row tap opens detail view.
  - Page-load animation: staggered reveals composing into place.
- **Scope:** Frontend.

### REQ-08 — Frontend: Rating Detail / Reasoning Drill-down
- **Origin:** REQ-frontend-rating-detail
- **Category:** FRONTEND
- **Description:** Detail view for one subject with the agent's reasoning made transparent. This is where the AI Interaction Design 25% rubric criterion is won.
- **Acceptance:**
  - Large grade + confidence (grade is the largest object on screen).
  - Four risk dimensions (per scope cut), each rendered as a scored bar with a one-line plain-language summary.
  - Each dimension expandable to full rationale.
  - Every claim in the rationale links to the on-chain data point that backs it.
  - On-chain reasoning hash surfaced with a verify control showing match status.
  - Dimension bars animate to their scores once on reveal.
- **Scope:** Frontend.

### REQ-09 — Frontend: Track Record View
- **Origin:** REQ-frontend-track-record
- **Category:** FRONTEND
- **Description:** View of the agent's accuracy over time, anchored by the historical-downgrade proof.
- **Acceptance:**
  - Timeline shows agent grade(s) → real-world failure that followed.
  - Agent's ERC-8004 identity surfaced as a documented permanent record.
  - Agent's reputation record surfaced as a designed view (live reputation loop substituted by historical proof per DEC-scope-cut-sequence #1).
- **Scope:** Frontend.

### REQ-10 — Frontend: Live Request Flow + Streaming Reasoning
- **Origin:** REQ-frontend-live-request-flow + REQ-ai-interaction-design (streaming portion)
- **Category:** FRONTEND/AGENT
- **Description:** Lightweight flow where a user picks a subject, triggers `requestRating` on-chain, and watches the agent produce and publish a rating live with reasoning streaming dimension by dimension.
- **Acceptance:**
  - On-chain `requestRating` fires from the UI.
  - Reasoning streams as it forms, dimension by dimension (CON-ai-interaction-streaming-reasoning).
  - Final grade resolves visibly — never pops without the journey shown.
  - Designed loading/empty/error states for every async edge (CON-loading-states-required).
- **Scope:** Frontend + agent stream.

### REQ-11 — Frontend: Accessibility + Newcomer Comprehension
- **Origin:** REQ-frontend-accessibility
- **Category:** FRONTEND
- **Description:** Newcomer with no DeFi knowledge can understand what a grade means and why.
- **Acceptance:**
  - Plain-language one-sentence explanation for every grade and every dimension.
  - Jargon (TVL, oracle, depeg, custodian) defined inline on first use via tooltip or glossary affordance.
  - Full keyboard navigation, visible focus states, semantic HTML, real contrast ratios.
  - Grade signaling never color-alone — letter + text label always accompany.
  - Responsive from phone to desktop; legible on narrow screen for live demo.
- **Scope:** Frontend.

### REQ-12 — AI Interaction Design: Voice, Citation, Confidence, Verifiability
- **Origin:** REQ-ai-interaction-design (non-streaming portion)
- **Category:** FRONTEND
- **Description:** Agent's reasoning presented transparently and naturally throughout the UI — beyond the streaming flow.
- **Acceptance:**
  - Confidence is visually expressed (more certain at high confidence, more cautious at low), not just a bare number.
  - Every assertion is cited — reasoning text links to on-chain metric or contract.
  - Verifiability (reasoning hash + match status) is a first-class UI element, not a footnote.
  - Agent voice is consistent, calm, analyst-like — plain, precise, never hype.
- **Scope:** Frontend.

### REQ-13 — Design Tokens
- **Origin:** REQ-design-tokens
- **Category:** FRONTEND
- **Description:** Design tokens defined as CSS variables.
- **Acceptance:**
  - 6-step neutral ink ramp.
  - Single accent + two tints.
  - Full grade color system (per DEC-grade-color-ramp).
  - Type scale: at minimum display / heading / body / mono / caption (editorial serif + grotesk/mono; forbidden fonts excluded — CON-typography-forbidden-fonts).
  - 8px-based spacing scale.
  - Two radii, two shadow levels.
- **Scope:** Frontend.

### REQ-14 — Submission Deliverables
- **Origin:** REQ-submission-deliverables
- **Category:** SHIP
- **Description:** Submission clears the DoraHacks main submission, the 20 Project Deployment Award gates, and the Best UI/UX gates.
- **Acceptance:**
  - Open-source GitHub repo with README (setup, architecture, deployed contract address, ERC-8004 identity address, IPFS pinning service, demo URL).
  - Runnable demo publicly accessible (not localhost) — CON-public-deployment.
  - Contract deployed AND verified on Mantle Mainnet or Testnet; address in DoraHacks submission.
  - At least one AI-powered function callable on-chain (`requestRating` → `publishRating`) — CON-onchain-trigger-required.
  - Demo video ≥ 2 minutes walking the four pre-defined demo moments (CON-demo-video-min-length).
  - Nominated to AI x RWA and AI Alpha & Data tracks.
- **Scope:** Ship + submission.

### REQ-15 — Phase 0 Discovery + Award-Bar Deployment
- **Origin:** REQ-phase-0-discovery
- **Category:** DISCOVERY
- **Description:** Day 1 discovery resolves four open items and deploys the skeleton contract to clear the 20 Project Deployment Award technical bar.
- **Acceptance:**
  - Confirm live Mantle availability and addresses for USDY, mETH, fBTC, MI4, Ethena USDe and relevant lending markets; commit three-subject selection.
  - Confirm whether canonical ERC-8004 Identity and Reputation Registries are deployed on Mantle; if absent, plan reference deployment.
  - Select and verify the specific 2025 failure for the historical-downgrade proof.
  - Confirm per-track prize allocation if Mantle has published it.
  - Skeleton `RatingRegistry.sol` (stub `requestRating` → stub `publishRating`) deployed and verified on Mantle Explorer by end of Day 1.
- **Scope:** Phase 1 gate.

## v2 (Out of Scope, Deferred)

| ID | Description | Why Deferred |
|----|-------------|--------------|
| v2-01 | Live ERC-8004 Reputation Registry accuracy loop with automated adverse-event listener | DEC-scope-cut-sequence #1 applied; substituted by REQ-06 historical-downgrade proof as designed view. |
| v2-02 | Fifth deterministic risk dimension (governance and custodian) | DEC-scope-cut-sequence #3 applied; four dimensions for ship. |
| v2-03 | Two additional rated subjects (5 total) | DEC-scope-cut-sequence #4 applied; three subjects for ship. |
| v2-04 | Multi-source off-chain metadata pipeline (custodian, audit, governance aggregator) | DEC-scope-cut-sequence #2; contingency only. |
| v2-05 | Manual admin trigger fallback if `requestRating` flow becomes blocking | DEC-scope-cut-sequence #5; contingency only. On-chain trigger remains required per CON-onchain-trigger-required. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 Rating Engine Pipeline | Phase 2 | Pending |
| REQ-02 RatingRegistry Contract | Phase 1 (skeleton) → Phase 3 (real publish) | Pending |
| REQ-03 ERC-8004 Identity Mint | Phase 3 | Pending |
| REQ-04 IPFS Reasoning Pin + Hash Verification | Phase 3 | Pending |
| REQ-05 Three Mantle RWA Subjects Rated | Phase 2 | Pending |
| REQ-06 Historical-Downgrade Proof | Phase 3 (start) → Phase 4 (finish) | Pending |
| REQ-07 Frontend Ratings Terminal | Phase 4 | Pending |
| REQ-08 Frontend Rating Detail | Phase 4 | Pending |
| REQ-09 Frontend Track Record | Phase 4 | Pending |
| REQ-10 Live Request Flow + Streaming | Phase 4 | Pending |
| REQ-11 Accessibility + Newcomer Comprehension | Phase 4 | Pending |
| REQ-12 AI Interaction Design (voice, citation, confidence, verifiability) | Phase 4 | Pending |
| REQ-13 Design Tokens | Phase 4 | Pending |
| REQ-14 Submission Deliverables | Phase 5 | Pending |
| REQ-15 Phase 0 Discovery + Award-Bar Deployment | Phase 1 | Pending |

**Coverage:** 15/15 v1 requirements mapped. No orphans. REQ-02 and REQ-06 each span two phases by design (skeleton → real, and start → finish respectively); each remains owned by the later phase for completion.
