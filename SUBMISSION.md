# DoraHacks submission — paste-ready copy

Fill the two placeholders before submitting: **`<DEMO_URL>`** (deployed frontend) and **`<VIDEO_URL>`** (≥2-min demo). Everything else is final.

---

## Project name
Touchstone

## Tagline (one line)
On-chain credit ratings for Mantle real-world assets — issued by an AI agent, published on-chain with reasoning anyone can verify.

## Tracks
- AI × RWA (primary)
- AI Alpha & Data (secondary)

## Links
- **Live demo:** `<DEMO_URL>`
- **GitHub:** https://github.com/Chimdalu-Ofoegbu/Touchstone
- **Demo video:** `<VIDEO_URL>`
- **RatingRegistry (Mantle Mainnet, verified):** https://mantlescan.xyz/address/0xF16d03965E1870Fc3235198468C56dEC65E5606D
- **Agent identity (ERC-8004 NFT #114):** https://mantlescan.xyz/address/0xb27c7fa15D25E880Ba4a9a508e166538e106F51e

---

## Short description (elevator pitch)

Every other RWA agent in this hackathon competes on returns — yield optimizers, rebalancers, vault managers. Touchstone doesn't trade; it **rates**. It issues structured credit ratings (AAA → D) for real-world-asset tokens on Mantle, scoring four deterministic on-chain risk dimensions and using Claude to synthesize a letter grade with a cited rationale. Every rating is published on-chain under an ERC-8004 identity, bound to a reasoning hash anyone can re-verify against IPFS. It's the Moody's of the agentic economy — upstream infrastructure other yield agents consume, with an on-chain track record no rating agency has ever had.

---

## Full description

**The problem.** Tokenized real-world assets on Mantle — treasuries, restaked ETH, wrapped BTC — carry real, differentiated risk: how they're collateralized, who can upgrade the contract, how the peg is sourced, how deep the liquidity is. Today that risk is opaque. Yield agents allocate into these assets with no standardized, independent credit signal, and no way to tell whether a "rating" was honest or retrofitted after the fact.

**The solution.** Touchstone is an autonomous credit-rating agent. For each subject it:

1. **Ingests live Mantle on-chain state** with viem — TVL, oracle configuration, collateral composition, verified contract source, and the contract's upgrade authority (resolved through the EIP-1967 admin slot → ProxyAdmin → the controlling Gnosis Safe).
2. **Scores four deterministic risk dimensions** (0–100 each): collateral quality, contract risk, oracle integrity, liquidity & stability. These are threshold-banded scorers, not LLM output — the metrics anchor the grade.
3. **Synthesizes with Claude (Opus 4.8):** the dimension scores plus raw evidence go to a single tool-use call that returns a letter grade, a confidence value, and a rationale that **cites the specific on-chain data** behind each judgment.
4. **Publishes on-chain.** The full reasoning JSON is canonicalized (RFC 8785 JCS), hashed (keccak256), and pinned to IPFS; `publishRating` writes the grade, hash, confidence, and IPFS CID to the RatingRegistry in one transaction.

**Why it's trustworthy.** Deterministic scoring is strictly separated from the LLM step, so the agent can't hallucinate a grade — the model explains, the metrics decide. The on-chain `reasoningHash` lets anyone fetch the reasoning from IPFS, re-hash it, and confirm it matches the chain. `publishRating` is gated to the holder of the agent's ERC-8004 identity NFT (#114) via a live `ownerOf` check, while `requestRating(address)` is open to any wallet — so the AI trigger is genuinely on-chain.

**What's live.** Three subjects are rated against real Mantle Mainnet state, each with its governance multisig verified on-chain (`getOwners`/`getThreshold`):

| Subject | Grade | Composite | Governance |
|---|---|---|---|
| USDY (Ondo U.S. Dollar Yield) | A | 72/100 | 4-of-7 Gnosis Safe |
| cmETH (Mantle Restaked ETH) | BBB | 64/100 | 6-of-14 Gnosis Safe |
| FBTC (FunctionBTC) | BBB | 69/100 | 5-of-8 Gnosis Safe |

**The proof it means something.** The *unmodified* engine — no special-casing — was run on Elixir **deUSD**'s pre-failure on-chain state on 2025-10-28 and returned a **B (speculative)**, flagging 65% xUSD concentration with circular collateralization, 4.1× recursive leverage in private Morpho markets, a hardcoded $1.00 oracle, and $520M claimed vs ~$160M actual TVL. deUSD collapsed 2025-11-03..06 — about six days later. Shown honestly as a historical reconstruction, it's the demo's spine: the agent would have warned you first.

---

## Track answers

**AI × RWA — "What real-world asset are you bringing on-chain? How does AI play a role? How is it realized on Mantle?"**

> Touchstone doesn't tokenize a new asset; it makes the tokenized real-world assets already on Mantle (USDY, cmETH, FBTC) safer to use by issuing AI-generated credit ratings. The AI ingests on-chain risk data, scores four deterministic risk dimensions, and reasons to a letter grade with a cited rationale. Every rating is published on-chain under an ERC-8004 identity, so the agent builds a permanent, verifiable accuracy record on Mantle that any other protocol can consume as a credit oracle.

**AI Alpha & Data — "Which data sources do you use? What role does AI play? How does it generate verifiable value on Mantle?"**

> The core data source is Mantle on-chain state: TVL, oracle configuration, collateral composition, verified contract source, and the contract's upgrade authority resolved through the EIP-1967 proxy admin slot down to the controlling multisig. The AI fuses deterministic risk scores with a reasoning step that produces a grade and a rationale citing those exact data points. Value is verifiable because every rating, its reasoning hash, and its IPFS reasoning document are recorded on Mantle — the track record cannot be retroactively edited, and anyone can re-hash the reasoning to confirm it.

---

## Tech stack
Solidity 0.8.24 + Foundry (contracts, verified on Mantle Mainnet) · TypeScript + viem + Anthropic Claude Opus 4.8 (rating engine) · Next.js 15 + React 19 + Tailwind (ratings terminal) · IPFS/Pinata (reasoning storage) · canonical ERC-8004 Identity Registry on Mantle.

## 20 Project Deployment Award checklist
- [x] Contract deployed on Mantle Mainnet (`0xF16d…606D`)
- [x] Contract verified on Mantle Explorer
- [x] AI-powered function callable on-chain (`requestRating` → `publishRating`)
- [ ] Frontend demo publicly accessible — `<DEMO_URL>`
- [ ] Deployment address in the DoraHacks submission (use the link above)
- [ ] Demo video ≥ 2 minutes — `<VIDEO_URL>`
