# PROJECT.md — Touchstone

## Core Value

Touchstone is a credit-ratings agent for on-chain RWA assets on Mantle. It does not trade. It ingests on-chain and off-chain risk data, scores it across deterministic risk dimensions, and uses Claude to synthesize a letter grade (AAA–D) with a cited rationale. Every rating is published on-chain under an ERC-8004 agent identity with a verifiable reasoning hash, building a permanent track record that other Mantle protocols can consume as an oracle.

**Pitch frame:** the Moody's of the agentic economy, with an on-chain track record no rating agency has ever had.

## Target User

- **Primary judges:** DoraHacks reviewers for AI x RWA and AI Alpha & Data tracks; 20 Project Deployment Award reviewers; Best UI/UX reviewers.
- **Demo persona:** a newcomer with no DeFi knowledge who lands on the terminal and immediately grasps which Mantle RWA assets are safe and which are not, and can verify why.
- **Downstream consumer:** other on-chain agents (yield optimizers, vault managers) that would read `latestRating` / `ratingHistory` as an oracle.

## Submission Context

- **Hackathon:** Mantle / Turing — DoraHacks.
- **Official deadline:** 2026-06-15 (DoraHacks).
- **User ship target:** 2026-06-12 (Day 5). Day 6 (2026-06-13) reserved as unused buffer. Plans 7–9 in the original spec are compressed out.
- **Attention split:** Sui Overflow deadline 2026-06-16. The front-loaded 20 Project Deployment Award bar is the floor: even worst-case finish clears it.
- **Track nominations:** AI x RWA, AI Alpha & Data.
- **Award gates targeted:** Main submission, 20 Project Deployment Award, Best UI/UX.

## Locked Decisions (from intel — 13 spec-asserted, treat as working baseline)

<decisions>

### DEC-positioning-ratings-not-yield
Touchstone is a credit-ratings agent, not a yield/trading agent. Rates RWA tokens and protocols on Mantle and publishes structured grades AAA–D on-chain. Source: `Touchstone Project.md` §1.

### DEC-grade-encoding-uint8
Grades AAA–D encoded as `uint8` 0–9. Mapping: 0=AAA, 1=AA, 2=A, 3=BBB, 4=BB, 5=B, 6=CCC, 7=CC, 8=C, 9=D. Lives in a shared constants file consumed by contract, agent, and frontend. Source: `Touchstone Project.md` §3.1.

### DEC-onchain-hash-offchain-reasoning
Store `bytes32 reasoningHash` (keccak256 of reasoning JSON) on-chain; pin full reasoning JSON to IPFS; frontend verifies fetched reasoning against on-chain hash. Source: `Touchstone Project.md` §3.1.

### DEC-five-deterministic-risk-dimensions → REVISED to FOUR
Original spec: five deterministic risk dimensions scored 0–100 each (collateral quality, contract risk, oracle integrity, liquidity and stability, governance and custodian). **Compressed plan applies scope-cut #3 proactively: drop governance-and-custodian dimension. Ship with FOUR deterministic dimensions:** (1) collateral quality, (2) contract risk, (3) oracle integrity, (4) liquidity and stability. Source: `Touchstone Project.md` §3.2 + §8 scope-cut #3, applied per user timeline_override.

### DEC-llm-reasoning-claude
Claude is the LLM reasoning model for grade synthesis and rationale generation. Source: `Touchstone Project.md` §3.3.

### DEC-erc8004-identity-reputation
Use canonical ERC-8004 Identity Registry (ERC-721) for agent identity NFT and Reputation Registry for accuracy feedback. Do not reimplement. If canonical registries are not on Mantle, deploy reference registries and document. Source: `Touchstone Project.md` §3.1.

### DEC-onchain-trigger-requestRating
Public `requestRating(address subject)` callable by anyone emits `RatingRequested`; off-chain agent listens and responds with `publishRating`. Satisfies 20 Project Deployment Award "agent trigger / inference result written on-chain." Even under maximum scope cut, the trigger remains on-chain (manual admin trigger is the floor). Source: `Touchstone Project.md` §3.1.

### DEC-tech-stack
- Contracts: Solidity + Foundry, deployed and verified on Mantle.
- Agent: TypeScript/Node with `RatingRequested` event listener.
- Frontend: Next.js + Tailwind core utility classes only.
- LLM: Claude.
- Storage: IPFS via web3.storage (locked — see DEC-ipfs-provider-web3storage).

Source: `Touchstone Project.md` §3.3 + `Touchstone UI-UX Prompt.md` Tech constraints.

### DEC-aesthetic-direction-editorial
Editorial rating-agency broadsheet meets precision terminal. Default theme: warm paper-light base (true off-white, not pure white), deep ink text, generous margins, single restrained accent. Optional dark variant: deep ink-navy terminal. Pick one and execute completely. Source: `Touchstone UI-UX Prompt.md` Aesthetic direction.

### DEC-typography-editorial-serif-plus-mono
Editorial serif for grades, headlines, agent voice; precise grotesk or monospace for data, tickers, addresses, metrics. Inter, Roboto, Arial, and system fonts are explicitly forbidden. Self-host or load from reliable source. Source: `Touchstone UI-UX Prompt.md` Aesthetic direction.

### DEC-grade-color-ramp
Three-family ramp: (1) investment grade AAA–BBB — calm cool, (2) speculative BB, B — amber/caution, (3) distressed CCC–D — deepening red. Same grade chip component reused everywhere. Letter + text label always accompany color. Source: `Touchstone UI-UX Prompt.md` Grade color system.

### DEC-no-browser-storage-in-artifact-context
No browser `localStorage` or `sessionStorage` in any artifact-rendered context; hold state in React state. Source: `Touchstone UI-UX Prompt.md` Tech constraints.

### DEC-scope-cut-sequence
Ordered scope-cut sequence under time pressure: (1) drop live Reputation Registry accuracy loop, (2) drop multi-source off-chain metadata, (3) drop governance-and-custodian dimension, (4) drop two subjects (rate three instead of five), (5) drop public `requestRating` trigger to manual admin trigger (keep on-chain). **Compressed 5-phase plan applies cuts #1, #3, and #4 proactively at planning time; cuts #2 and #5 remain contingency.** Source: `Touchstone Project.md` §8.

### DEC-ship-core-minimum
Ship-core floor: three subjects rated, deterministic scoring + LLM reasoning, ratings published on-chain under ERC-8004 identity with verifiable hashes, one historical-downgrade proof, three frontend screens (ratings terminal, rating detail, track record). Source: `Touchstone Project.md` §8.

### DEC-subject-set-locked
Three subjects to rate at ship: **USDY** (`0x5be26527e817998a7206475496fde1e68957c5a6` on Mantle), **cmETH** (`0xE6829d9a7ee3040e1276Fa75293Bde931859e8fA` on Mantle), **FBTC** (`0xC96dE26018A54D51c097160568752c4E3BD6C364` on Mantle). cmETH chosen over mETH because mETH on Mantle is a bridge wrapper — its TVL lives on Ethereum L1; cmETH is the Mantle-native restaked variant with real Mantle-side dynamics. USDe held back as substitute (had its own Oct 11 2025 flash depeg, would conflict with rating-it-ourselves narrative). Source: `.planning/phases/01-lock-skeleton/RESEARCH.md` + user lock 2026-06-07.

### DEC-erc8004-canonical-addresses
ERC-8004 canonical registries are live on Mantle Mainnet (deployed 2026-02-11). Use these addresses directly; do NOT deploy reference registries. **Identity Registry:** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. **Reputation Registry:** `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`. This collapses the section 11 contingency in `Touchstone Project.md`. Validation Registry address is Phase 3 lookup, not a Phase 1 blocker. Source: `.planning/phases/01-lock-skeleton/RESEARCH.md` + user lock 2026-06-07.

### DEC-historical-proof-case
**Elixir deUSD collapse, 2025-11-03 to 2025-11-06.** Pre-event signals reconstructable from Ethereum archival RPC (EVM-equivalent, not Mantle — acceptable for the proof). Every one of our four scoring dimensions would have flagged it pre-event: oracle integrity (xUSD oracle hardcoded $1.00 across Morpho/Euler/Elixir lending markets); collateral quality (65% xUSD concentration + circular collateralization); contract risk (private unlisted Morpho markets, 4.1x recursive leverage); liquidity (TVL discrepancy $520M claimed vs $160M actual, 12% yield premium over Aave baseline). Analyst CBB0FE published the leverage analysis 2025-10-28 — 6 days pre-failure. Backup case: USDe Oct 11 2025 flash depeg (in reserve, not built). Source: `.planning/phases/01-lock-skeleton/RESEARCH.md` + user lock 2026-06-07.

### DEC-deployment-target-plan
Iterate on **Mantle Sepolia (chain 5003)** through Days 1-4. Deploy ship artifact to **Mantle Mainnet (chain 5000)** on Day 5 with final code. Verification via Blockscout (`forge verify-contract --verifier blockscout --verifier-url https://explorer.mantle.xyz/api/`) — no API key required. Native MNT gas ~0.05 gwei; deploy cost <$1. Submission contains the Mainnet address. Source: `.planning/phases/01-lock-skeleton/RESEARCH.md` + user lock 2026-06-07.

### DEC-ipfs-provider-web3storage
**web3.storage** is the IPFS pinning provider for reasoning JSON. Picked over Pinata for simpler TS API and more generous free tier. Replaces "web3.storage or Pinata" optionality in DEC-tech-stack. Source: user lock 2026-06-07.

</decisions>

## Deployed Addresses

| Contract | Network | Address | Deploy Tx | Verified |
|----------|---------|---------|-----------|----------|
| RatingRegistry (Phase 1 skeleton) | Mantle Sepolia (5003) | `0x0912bcBd57579179388cE9d4863032406dCfBe18` | [`0x4cba...16c2b`](https://sepolia.mantlescan.xyz/tx/0x4cba0abfe6aee6c69f4d59d1921ce8fdb3dffa154a0505746049ab71f0f16c2b) | [verified on Mantlescan](https://sepolia.mantlescan.xyz/address/0x0912bcBd57579179388cE9d4863032406dCfBe18) |

Agent address (initial, Phase 1): `0xb27c7fa15D25E880Ba4a9a508e166538e106F51e` — Phase 3 will swap onlyAgent modifier to ERC-8004 NFT-holder gate without redeploy.

Mainnet deploy: scheduled for Day 5 / Phase 5 per DEC-deployment-target-plan. The Sepolia artifact above clears the 20 Project Deployment Award technical bar today (2026-06-08).

See `.planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md` for the full deployment record (block number, gas used, smoke-tx hash, verification log).

## Scope Cuts Already Baked Into This Plan

Per the user timeline_override (5 working days, not 8), these cuts are applied at planning time, not as emergency cuts:

| Cut | What | Why |
|-----|------|-----|
| #1 | Live ERC-8004 Reputation Registry accuracy loop dropped | Substituted by historical-downgrade proof as a designed view. The loop is shown as designed/documented behavior backed by the historical proof in track-record. |
| #3 | Governance-and-custodian dimension dropped | Ship with four deterministic dimensions (collateral quality, contract risk, oracle integrity, liquidity and stability). |
| #4 | Two subjects dropped | Ship with three subjects (selection confirmed in Phase 1 Phase-0 verification block — candidates from {USDY, mETH, fBTC, MI4, Ethena USDe}). |

Cuts #2 (multi-source off-chain metadata) and #5 (public trigger → manual admin trigger) remain contingency only.

## Constraints (Pinned)

- **Hard deadline:** 2026-06-15 (DoraHacks). User ship target: 2026-06-12. Buffer day: 2026-06-13.
- **Tech stack:** Foundry/Solidity, TS/Node agent, Next.js + Tailwind frontend, Claude, IPFS (web3.storage or Pinata).
- **Public deployment required:** contract verified on Mantle Mainnet or Testnet with address in DoraHacks submission; frontend on a public URL (not localhost).
- **Demo video ≥ 2 minutes** walking the core use case. Four pre-defined demo moments: terminal load, reasoning drill-down with citations, live rating trigger + on-chain publish, track-record timeline landing the historical-downgrade proof.
- **On-chain AI function required:** the `requestRating` → `publishRating` round-trip is the satisfying flow for the 20 Project Deployment Award.
- **Deterministic scoring code MUST be separate from the LLM step.** Judges inspect the boundary.
- **Evidence-citation enforced in reasoning prompt.** Every rationale names specific data points (TVL value, oracle address, custodian name, audit firm). No generic statements.
- **Verifiability is first-class UI:** reasoning hash + match status visible, not a footnote.
- **Grade signaling never color-alone:** letter + text label + family color.
- **Grade is the largest object on any rating view.**
- **Streaming reasoning is the signature motion moment** — final grade never pops without the journey shown.
- **Loading/empty/error states designed for every async action.** No spinners into the void.
- **Forbidden fonts:** Inter, Roboto, Arial, system fonts.
- **No browser storage** in any artifact-rendered context.

## Non-Goals (v1)

- Touchstone does not trade, optimize yield, or rebalance vaults.
- No multi-source off-chain metadata pipeline (custodian, audit, governance aggregator) — contingency cut #2 only if needed.
- No live ERC-8004 Reputation Registry accuracy loop (replaced by historical-downgrade proof as designed view).
- No fifth deterministic dimension (governance-and-custodian).
- No more than three rated subjects at ship.
- No mobile-native app; responsive web from phone to desktop is the floor.
- No public testnet faucet UX, no wallet onboarding wizard — judges arrive with a wallet.

## Definition of Done (Whole-System)

A newcomer lands on the terminal, immediately grasps which Mantle RWA assets are safe and which are not, opens one, understands why in plain language with every claim traceable to on-chain data, verifies the reasoning against its on-chain hash, and sees a track record proving the agent called a real failure before it happened. It should feel like a financial institution shipped it.

## Provenance

Synthesized from:
- `Touchstone Project.md` (precedence 0) — architecture, contracts, agent pipeline, phasing, submission.
- `Touchstone UI-UX Prompt.md` (precedence 1) — frontend visual design, interaction, AI interaction patterns, accessibility, demo moments.
- Intel synthesis: `.planning/intel/SYNTHESIS.md` (READY, no blockers, no competing variants).
- User timeline_override: 5 working days (2026-06-08 → 2026-06-12), Day 6 buffer.
