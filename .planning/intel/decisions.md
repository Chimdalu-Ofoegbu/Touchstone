# Decisions (synthesized from ingested SPECs)

No ADRs were classified in this ingest. The classified docs are both SPEC type. The architecture- and product-level decisions embedded in the project spec are captured below as "spec-locked decisions" so downstream consumers can trace provenance. They are NOT ADR-locked — they remain overridable by a future ADR.

---

## DEC-positioning-ratings-not-yield

- Source: `Touchstone Project.md` §1
- Status: spec-asserted (not locked)
- Decision: Touchstone is a credit-ratings agent, not a yield/trading agent. It does not trade. It rates RWA tokens and protocols on Mantle and publishes structured grades AAA–D on-chain.
- Scope: Product positioning, competitive differentiation
- Rationale: Differentiates from the yield-first crowd in AI x RWA track; positions Touchstone as upstream infrastructure other agents consume.

## DEC-grade-encoding-uint8

- Source: `Touchstone Project.md` §3.1
- Status: spec-asserted (not locked)
- Decision: Grades AAA–D are encoded as `uint8` 0–9, mapping AAA=0, AA=1, A=2, BBB=3, BB=4, B=5, CCC=6, CC=7, C=8, D=9.
- Scope: Smart contract, agent, frontend (shared constants file)
- Rationale: Compact on-chain representation, shared mapping across contract/agent/frontend.

## DEC-onchain-hash-offchain-reasoning

- Source: `Touchstone Project.md` §3.1
- Status: spec-asserted (not locked)
- Decision: Store `bytes32 reasoningHash` (keccak256 of reasoning JSON) on-chain; pin full reasoning JSON to IPFS; frontend verifies fetched reasoning against on-chain hash.
- Scope: Contract storage, agent publish flow, frontend verification UI
- Rationale: Keeps gas low while preserving verifiability; matches ERC-8004 recommended pattern (compact signal on-chain, full record off-chain).

## DEC-five-deterministic-risk-dimensions

- Source: `Touchstone Project.md` §3.2; reinforced in `Touchstone UI-UX Prompt.md` §"Rating detail"
- Status: spec-asserted (not locked)
- Decision: Five deterministic risk dimensions scored 0–100 each: (1) collateral quality, (2) contract risk, (3) oracle integrity, (4) liquidity and stability, (5) governance and custodian.
- Scope: Rating engine, frontend reasoning drill-down
- Rationale: Deterministic anchor separates math from LLM synthesis; judges can see grades are not hallucinated.

## DEC-llm-reasoning-claude

- Source: `Touchstone Project.md` §3.3
- Status: spec-asserted (not locked)
- Decision: Claude is the LLM reasoning model for grade synthesis and rationale generation.
- Scope: Off-chain agent
- Rationale: Reasoning step fuses deterministic scores with cited rationale; serves AI Alpha & Data Insight Value criterion.

## DEC-erc8004-identity-reputation

- Source: `Touchstone Project.md` §3.1
- Status: spec-asserted (not locked)
- Decision: Use canonical ERC-8004 Identity Registry (ERC-721) for agent identity NFT and Reputation Registry for accuracy feedback. Do not reimplement. If canonical registries are not deployed on Mantle, deploy reference registries and document.
- Scope: Smart contracts, agent publishing, frontend identity surfacing
- Rationale: Standards-compliance; on-chain accuracy track record is the differentiator.

## DEC-onchain-trigger-requestRating

- Source: `Touchstone Project.md` §3.1
- Status: spec-asserted (not locked)
- Decision: Public `requestRating(address subject)` callable by anyone emits `RatingRequested` event; off-chain agent listens and responds with `publishRating`. This satisfies the 20 Project Deployment Award requirement of "agent trigger / inference result written on-chain."
- Scope: RatingRegistry.sol, agent event listener
- Rationale: Award gate; first-come/first-served deployment award depends on this.

## DEC-tech-stack

- Source: `Touchstone Project.md` §3.3; reinforced in `Touchstone UI-UX Prompt.md` §"Tech constraints"
- Status: spec-asserted (not locked)
- Decision:
  - Contracts: Solidity + Foundry, deployed and verified on Mantle.
  - Agent: TypeScript/Node service with `RatingRequested` event listener.
  - Frontend: Next.js + Tailwind utility classes.
  - Storage: IPFS (web3.storage or Pinata).
- Scope: All build phases
- Rationale: Single shared stack; both source docs agree on Next.js for frontend.

## DEC-aesthetic-direction-editorial

- Source: `Touchstone UI-UX Prompt.md` §"Aesthetic direction"
- Status: spec-asserted (not locked)
- Decision: Aesthetic is editorial rating-agency broadsheet meets precision terminal. Default theme: warm paper-light base (true off-white, not pure white), deep ink text, generous margins, single restrained accent. Optional dark variant: deep ink-navy terminal (not pure black). Pick one and execute completely.
- Scope: Frontend visual design
- Rationale: Distinctive aesthetic; Visual Design 30% of Best UI/UX rubric.

## DEC-typography-editorial-serif-plus-mono

- Source: `Touchstone UI-UX Prompt.md` §"Aesthetic direction"
- Status: spec-asserted (not locked)
- Decision: Editorial serif for grades, headlines, and the agent's voice; precise grotesk or monospace for data, tickers, addresses, metrics. Inter, Roboto, Arial, and system fonts are explicitly forbidden.
- Scope: Frontend typography tokens
- Rationale: Gravitas + credibility; distinctive Visual Design.

## DEC-grade-color-ramp

- Source: `Touchstone UI-UX Prompt.md` §"Grade color system"
- Status: spec-asserted (not locked)
- Decision: Coherent three-family color ramp for AAA–D: (1) investment grade (AAA, AA, A, BBB) — calm cool trustworthy progressing strongest→weakest, (2) speculative (BB, B) — amber/caution, (3) distressed (CCC, CC, C, D) — deepening warning red. Same grade chip component reused everywhere a grade appears. Never color-alone signaling; letter + text label always accompany.
- Scope: Frontend tokens, grade chip component
- Rationale: Data-viz core; accessibility (never color alone); consistent visual language.

## DEC-no-browser-storage-in-artifact-context

- Source: `Touchstone UI-UX Prompt.md` §"Tech constraints"
- Status: spec-asserted (not locked)
- Decision: No browser `localStorage` or `sessionStorage` in any artifact-rendered context; hold state in React state.
- Scope: Frontend implementation
- Rationale: Artifact-environment constraint.

## DEC-scope-cut-sequence

- Source: `Touchstone Project.md` §8
- Status: spec-asserted (not locked, but ordered)
- Decision: Under time pressure, cut in this order: (1) drop live Reputation Registry accuracy loop, (2) drop multi-source off-chain metadata, (3) drop governance-and-custodian dimension (run four dimensions), (4) drop two subjects (rate three instead of five), (5) drop public `requestRating` trigger to manual admin trigger (keep on-chain to preserve deployment-award bar).
- Scope: Phase planning, ship gating
- Rationale: Pre-decided ordering avoids panic-cut decisions at the deadline.

## DEC-ship-core-minimum

- Source: `Touchstone Project.md` §8
- Status: spec-asserted (not locked)
- Decision: Ship-core minimum: three subjects rated, deterministic scoring + LLM reasoning, ratings published on-chain under ERC-8004 identity with verifiable hashes, one historical-downgrade proof, three frontend screens (ratings terminal, rating detail, track record).
- Scope: Submission gating
- Rationale: Defines the "complete, defensible submission" floor.
