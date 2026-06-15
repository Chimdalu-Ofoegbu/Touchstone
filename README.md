# Touchstone

**On-chain credit ratings for Mantle real-world assets — issued by an AI agent, published on-chain with reasoning anyone can verify.**

A touchstone is the dark stone assayers struck gold against to judge its purity. This one does the same for on-chain assets. Every other RWA agent competes on returns — yield optimizers, rebalancers, vault managers. **Touchstone does not trade. It rates.** It issues structured credit ratings (AAA → D) for RWA tokens on Mantle, publishes each rating on-chain under an [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) identity bound to a reasoning hash, and is upstream of every yield agent in the room: the Moody's of the agentic economy, with an on-chain track record no rating agency has ever had.

> Built for the **Mantle Turing Test Hackathon 2026** — tracks: AI × RWA, AI Alpha & Data.

---

## Live on Mantle Mainnet

| Artifact | Address | |
|---|---|---|
| **RatingRegistry** | `0xF16d03965E1870Fc3235198468C56dEC65E5606D` | [explorer ↗](https://mantlescan.xyz/address/0xF16d03965E1870Fc3235198468C56dEC65E5606D) |
| **Agent identity** (ERC-8004 NFT #114) | `0xb27c7fa15D25E880Ba4a9a508e166538e106F51e` | [explorer ↗](https://mantlescan.xyz/address/0xb27c7fa15D25E880Ba4a9a508e166538e106F51e) |
| **ERC-8004 Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | [explorer ↗](https://mantlescan.xyz/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |

🔗 **Live demo:** <!-- TODO: paste the deployed frontend URL here before submitting --> _deploying — URL to follow_

The RatingRegistry is verified on Mantlescan. `publishRating` is gated to the holder of agent identity NFT #114 (a live `ownerOf` check against the canonical ERC-8004 Identity Registry); `requestRating(address)` is open to anyone, so any wallet can trigger the agent on-chain.

---

## What a rating is

Each subject is scored on **four deterministic risk dimensions**, each 0–100:

| Dimension | What it measures |
|---|---|
| **Collateral quality** | What backs the token — transparency, audits, concentration of the backing. |
| **Contract risk** | Verified source, upgradeability, admin powers, timelocks, audit status. |
| **Oracle integrity** | How the price/peg is sourced and settled on-chain — a single trusted feed is fragile. |
| **Liquidity & stability** | Depth of on-chain liquidity and how stable the peg/value has held. |

The four scores are combined with **equal 25% weight** into a **composite (0–100)**, and the composite maps to a letter through a fixed ladder:

| | AAA | AA | A | BBB | BB | B | CCC | CC | C | D |
|---|---|---|---|---|---|---|---|---|---|---|
| **composite ≥** | 90 | 80 | 70 | 60 | 50 | 40 | 30 | 20 | 10 | 0 |

**Grade ≠ confidence.** The **grade** is what the composite earns on the ladder. **Confidence** (0–100) is a separate measure of how much evidence was actually readable on-chain — it falls as facts go missing. A high-confidence BBB means "we're sure it's a BBB," not "it's nearly an A."

### The pipeline

```
            on-chain reads (viem, block-pinned)        Claude (Opus 4.8)
RWA subject ───────────────────────────────► 4 deterministic ───► letter grade
  on Mantle    TVL · oracle config · collateral      scorers          + cited rationale
               mix · verified source · admin     (0–100 each)         + confidence
               authority (EIP-1967 + multisig)        │                     │
                                                       ▼                     ▼
                                            composite + grade ──► canonical JSON (RFC 8785)
                                                                          │ keccak256
                                                                          ▼
                                          pin to IPFS  ◄────────►  publishRating(subject,
                                          (Pinata)                   grade, reasoningHash,
                                                                     confidence, cid)
```

Deterministic scoring is **strictly separated** from the LLM step: the metrics anchor the grade, Claude synthesizes and explains it. Judges can see the agent isn't hallucinating grades.

---

## Verifiable by anyone

The on-chain record stores a `reasoningHash` (the `keccak256` of the canonical reasoning JSON) and the IPFS `cid` — written **atomically in the same transaction**, so a stored hash always has retrievable reasoning. The frontend fetches the full JSON from IPFS, re-computes the hash (RFC 8785 JCS canonicalization + keccak256), and shows it matches the on-chain value. The agent's track record cannot be retroactively edited.

---

## The three live subjects

Rated against live Mantle Mainnet state. Each subject's **upgrade authority is resolved on-chain and verified to be a multisig** (EIP-1967 admin slot → ProxyAdmin → Gnosis Safe, then `getOwners`/`getThreshold`), so governance centralization is scored from proof, not assumption.

| Subject | | Grade | Composite | Governance (verified on-chain) |
|---|---|---|---|---|
| **USDY** — Ondo U.S. Dollar Yield | tokenized US Treasuries + bank deposits | **A** | 72 / 100 | 4-of-7 Gnosis Safe |
| **cmETH** — Mantle Restaked ETH | mETH restaked across EigenLayer, Symbiotic, Karak | **BBB** | 64 / 100 | 6-of-14 Gnosis Safe |
| **FBTC** — FunctionBTC | BTC under an institutional custodian network | **BBB** | 69 / 100 | 5-of-8 Gnosis Safe |

All three carry **High** confidence (85–90). Full cited rationale and the IPFS-verify control live on each subject's detail page.

---

## Historical-downgrade proof: Elixir deUSD

The most persuasive thing a rating agency can show is that it would have warned you *before* a failure. The **unmodified** Touchstone engine — no special-casing — was run against Elixir **deUSD**'s pre-failure on-chain state on **2025-10-28** and produced a **B (speculative, composite 44)**, flagging:

- 65% xUSD concentration with circular collateralization (xUSD ↔ deUSD),
- 4.1× recursive leverage in private, unlisted Morpho markets,
- an xUSD oracle hardcoded at $1.00 across lending venues,
- $520M claimed TVL vs ~$160M actual.

deUSD collapsed **2025-11-03..06 — roughly six days later.** This is presented honestly as a historical reconstruction (Ethereum mainnet state), not a live Mantle rating. See the **Track record** page.

---

## Repository layout

```
.
├── src/ · script/ · test/ · lib/   Foundry contracts (RatingRegistry, GradeEnum, ERC-8004 gate)
├── agent/                          off-chain TypeScript rating engine (the "AI agent")
│   ├── src/dimensions/             4 threshold-banded deterministic scorers + synthesize
│   ├── src/subjects/               viem adapters per subject (USDY/cmETH/FBTC)
│   ├── src/admin.ts                on-chain upgrade-authority resolution + multisig verification
│   ├── src/claude/                 single-shot Anthropic tool-use synthesis
│   └── src/hash.ts                 RFC 8785 JCS canonicalization → keccak256 reasoningHash
└── web/                            Next.js 15 ratings terminal (board, detail+verify, methodology, track record)
```

---

## Run it locally

Prerequisites: **Node 20+**, **pnpm**, and (for contracts) **Foundry**.

### Frontend — the ratings terminal

```bash
pnpm -C web install
pnpm -C web dev          # http://localhost:3001
```

Reads live on-chain data by default (public Mantle RPC + the deployed registry); no env vars required to browse.

### Agent — the rating engine

```bash
cd agent && pnpm install
pnpm rate USDY                    # rate USDY at the latest Mantle block
pnpm rate cmETH --block 75000000  # rate at a pinned historical block
pnpm rate FBTC --mock             # deterministic offline run (no RPC / Anthropic)
pnpm test                         # full vitest suite (no live services needed)
```

Live runs read secrets from the **root** `.env` (copy `.env.example`): `ANTHROPIC_API_KEY` (required for non-`--mock`), `MANTLE_RPC_URL`, `PINATA_JWT` (for publishing). See [`agent/README.md`](agent/README.md) for the full engine reference.

### Contracts

```bash
forge test          # contract test suite
forge build
```

---

## Deploying the frontend

The app is a standard Next.js 15 project in `web/`. On **Vercel**: import the repo and set **Root Directory = `web`** (framework auto-detected; build `next build`, install `pnpm install`). Or from the CLI: `cd web && vercel`.

All runtime config has safe public defaults, so it deploys with **zero required env vars**. For production, set:

| Env var | Why |
|---|---|
| `NEXT_PUBLIC_MANTLE_RPC_URL` | A private/dedicated Mantle RPC (the public endpoint rate-limits under demo load). |
| `NEXT_PUBLIC_RERATE_COOLDOWN_S` | Re-rate cooldown; set `21600` (6h) for production (default is 60s for demos). |
| `NEXT_PUBLIC_IPFS_GATEWAY` | A dedicated IPFS gateway for faster reasoning-doc fetches. |

---

## Tech stack

- **Contracts:** Solidity 0.8.24, Foundry — deployed + verified on Mantle Mainnet.
- **Agent:** TypeScript, [viem](https://viem.sh) (on-chain reads), Anthropic Claude (Opus 4.8) for synthesis, Pinata for IPFS pinning, Vitest.
- **Frontend:** Next.js 15, React 19, Tailwind CSS, viem.
- **Identity:** canonical ERC-8004 Identity Registry on Mantle.

---

## License

MIT.
