# Requirements (synthesized from ingested SPECs)

No PRDs were classified in this ingest. The user-facing and system-functional requirements implied by the two SPECs are extracted below with stable IDs. Acceptance criteria are derived from explicit "must" / "non-negotiable" / "definition of done" / "submission checklist" language in the source docs.

---

## REQ-rating-engine-pipeline

- Source: `Touchstone Project.md` §3.2
- Description: An off-chain rating engine that ingests on-chain and off-chain data for an RWA subject, scores it across five deterministic risk dimensions, performs an LLM reasoning step, and publishes a grade + reasoning hash + confidence on-chain.
- Acceptance criteria:
  - Pipeline executes in the documented order: Ingest → Score (five dimensions, 0–100 each) → Reason (LLM) → Publish (IPFS pin + `publishRating` call) → Track accuracy.
  - Deterministic scoring is separated from the LLM step in code so judges can inspect the boundary.
  - The LLM reasoning prompt enforces evidence-citation: every rationale must name specific on-chain or audit data points (not generic statements).
- Scope: Off-chain agent

## REQ-rating-registry-contract

- Source: `Touchstone Project.md` §3.1
- Description: `RatingRegistry.sol` deployed to Mantle storing published ratings keyed by subject.
- Acceptance criteria:
  - `publishRating(address subject, uint8 grade, bytes32 reasoningHash, uint8 confidence)` is callable only by the registered agent identity. Emits `RatingPublished`.
  - `requestRating(address subject)` is callable by anyone. Emits `RatingRequested`.
  - `latestRating(address subject) view returns (Rating)` exposes the read interface.
  - `ratingHistory(address subject) view` exposes the full timeline.
  - Grade encoding: `uint8` 0–9 → AAA, AA, A, BBB, BB, B, CCC, CC, C, D.
  - Contract deployed and verified on Mantle Mainnet or Testnet.
- Scope: Smart contract

## REQ-erc8004-identity-mint

- Source: `Touchstone Project.md` §3.1, §3.2 step 4
- Description: The agent mints and holds an ERC-8004 Identity Registry NFT; `publishRating` only succeeds when called from the registered agent identity.
- Acceptance criteria:
  - Agent identity NFT minted on Mantle (canonical ERC-8004 Identity Registry, or reference deployed by this project if not yet on Mantle).
  - `publishRating` enforces identity check.
  - Identity is surfaced in the frontend (track record view).
- Scope: Contracts + agent + frontend

## REQ-erc8004-reputation-loop

- Source: `Touchstone Project.md` §3.2 step 5
- Description: When a rated subject later experiences a documented adverse event, accuracy feedback is written to the agent's ERC-8004 Reputation Registry record.
- Acceptance criteria:
  - Adverse event recorded against the agent's Reputation Registry record.
  - If live loop is cut (per scope-cut #1), the historical-downgrade proof substitutes as a designed view.
- Scope: Contracts + frontend (cuttable, per DEC-scope-cut-sequence)

## REQ-ipfs-reasoning-pin

- Source: `Touchstone Project.md` §3.1, §3.2 step 4
- Description: Full reasoning JSON is pinned to IPFS; `bytes32` keccak256 hash is stored on-chain; frontend verifies fetched reasoning against the hash.
- Acceptance criteria:
  - Reasoning JSON pinned via web3.storage or Pinata.
  - On-chain `reasoningHash == keccak256(reasoningJSON)`.
  - Frontend exposes a verifiability control surfacing match status.
- Scope: Agent + frontend

## REQ-subjects-rated

- Source: `Touchstone Project.md` §2, §8 ship-core minimum
- Description: At demo time, rate a defined set of Mantle RWA subjects.
- Acceptance criteria:
  - Target: five subjects — USDY, mETH, fBTC, MI4, Ethena USDe (Mantle availability confirmed in Phase 0).
  - Ship-core floor: three subjects.
  - Each subject has at least one published rating at demo time.
- Scope: Agent + frontend data

## REQ-historical-downgrade-proof

- Source: `Touchstone Project.md` §6; reinforced in `Touchstone UI-UX Prompt.md` §"Track record"
- Description: Demonstrate the agent would have warned of a real 2025 RWA/stablecoin failure by reconstructing pre-failure on-chain state and showing the agent produces a low or deteriorating grade with reasoning that names the specific weakness that later broke.
- Acceptance criteria:
  - One documented 2025 failure selected and verified.
  - Pre-failure on-chain state reconstructed transparently.
  - Agent run against historical state produces low/deteriorating grade.
  - Reasoning cites the specific weakness that later broke.
  - Timeline shown in track-record view: agent downgrade → real-world failure.
- Scope: Agent + frontend track record view

## REQ-frontend-ratings-terminal

- Source: `Touchstone UI-UX Prompt.md` §"Ratings terminal (home)"
- Description: Home view — ranked board of rated Mantle RWA subjects.
- Acceptance criteria:
  - Each row shows: subject name + ticker, grade chip, confidence, last-updated timestamp, sparkline of grade history.
  - Grade is the largest object on the row.
  - Sort and subject filter controls.
  - Row tap opens detail view.
  - Page-load animation: staggered reveals composing into place (signature first impression).
- Scope: Frontend

## REQ-frontend-rating-detail

- Source: `Touchstone UI-UX Prompt.md` §"Rating detail + reasoning drill-down"
- Description: Detail view for one subject with the agent's reasoning made transparent.
- Acceptance criteria:
  - Large grade + confidence.
  - Five risk dimensions, each rendered as a scored bar with a one-line plain-language summary.
  - Each dimension expandable to the full rationale.
  - Every claim in the rationale links to the on-chain data point that backs it.
  - On-chain reasoning hash surfaced with a verify control showing match status.
  - Dimension bars animate to their scores once on reveal.
- Scope: Frontend (this view is where AI Interaction Design 25% is won)

## REQ-frontend-track-record

- Source: `Touchstone UI-UX Prompt.md` §"Track record"
- Description: View of the agent's accuracy over time, anchored by the historical-downgrade proof.
- Acceptance criteria:
  - Timeline shows agent grade(s) → real-world failure that followed.
  - Agent's ERC-8004 identity surfaced as a documented permanent record.
  - Agent's reputation record surfaced.
- Scope: Frontend

## REQ-frontend-live-request-flow

- Source: `Touchstone UI-UX Prompt.md` §"Core screens" supporting; `Touchstone Project.md` deployment-award flow
- Description: A lightweight flow where a user picks a subject, triggers `requestRating`, and watches the agent produce + publish a rating live.
- Acceptance criteria:
  - On-chain `requestRating` fires from the UI.
  - Reasoning streams as it forms, dimension by dimension.
  - Final grade resolves visibly.
  - Designed loading / empty / error states (no spinners into the void).
- Scope: Frontend + agent stream

## REQ-frontend-accessibility

- Source: `Touchstone UI-UX Prompt.md` §"Accessibility requirements"
- Description: Newcomer with no DeFi knowledge can understand what a grade means and why.
- Acceptance criteria:
  - Plain-language one-sentence explanation for every grade and every dimension.
  - Jargon (TVL, oracle, depeg, custodian) defined inline on first use via tooltip or glossary affordance.
  - Full keyboard navigation, visible focus states, semantic HTML, real contrast ratios.
  - Grade signaling never color-alone — letter + text label always accompany.
  - Responsive from phone to desktop; legible on narrow screen for live demo.
- Scope: Frontend

## REQ-ai-interaction-design

- Source: `Touchstone UI-UX Prompt.md` §"AI Interaction Design requirements"
- Description: Agent's reasoning presented transparently and naturally throughout the UI.
- Acceptance criteria:
  - Show thinking, not just output — live rating streams reasoning dimension by dimension.
  - Confidence is visually expressed (more certain at high confidence, more cautious at low), not just a bare number.
  - Every assertion is cited — reasoning text links to the on-chain metric or contract that supports it; no unbacked claims.
  - Verifiability is a first-class UI element — reasoning hash and match status shown with quiet confidence.
  - Agent voice is consistent, calm, analyst-like — plain, precise, never hype.
- Scope: Frontend (this is the AI Interaction Design 25% rubric criterion)

## REQ-submission-deliverables

- Source: `Touchstone Project.md` §9
- Description: Submission must clear the DoraHacks main submission, the 20 Project Deployment Award gates, and the Best UI/UX gates.
- Acceptance criteria:
  - DoraHacks: open-source GitHub repo with README (setup, architecture, deployed contract address); runnable demo (publicly accessible, not localhost); project pitch; nominated to AI x RWA and AI Alpha & Data.
  - 20 Project Deployment Award (first-come, first-served): contract deployed on Mantle Mainnet or Testnet; contract verified on Mantle Explorer; at least one AI-powered function callable on-chain (`requestRating` → `publishRating`); frontend demo publicly accessible; deployment address in DoraHacks submission; demo video ≥ 2 minutes walking the core use case.
  - Best UI/UX: runnable frontend interface; demo video or public link.
- Scope: Ship + submission

## REQ-design-tokens

- Source: `Touchstone UI-UX Prompt.md` §"Design tokens"
- Description: Define design tokens as CSS variables.
- Acceptance criteria:
  - 6-step neutral ink ramp.
  - Single accent + two tints.
  - Full grade color system (per DEC-grade-color-ramp).
  - Type scale: at minimum display / heading / body / mono / caption.
  - 8px-based spacing scale.
  - Two radii, two shadow levels.
- Scope: Frontend tokens

## REQ-phase-0-discovery

- Source: `Touchstone Project.md` §11
- Description: Phase 0 (Day 1, non-negotiable) resolves four open items before any further build.
- Acceptance criteria:
  - Confirm live Mantle availability and addresses for USDY, mETH, fBTC, MI4, Ethena USDe and relevant lending markets.
  - Confirm whether canonical ERC-8004 Identity and Reputation Registries are deployed on Mantle; if absent, plan reference deployment.
  - Select and verify the specific 2025 failure for the historical-downgrade proof.
  - Confirm per-track prize allocation if Mantle has published it.
  - Skeleton `RatingRegistry.sol` deployed to Mantle testnet and verified on Mantle Explorer at end of Day 1 (meets 20 Project Deployment Award technical bar).
- Scope: Phase 0 gate
