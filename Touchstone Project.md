# project.md — Touchstone

**On-chain credit ratings for RWA protocols and tokens, issued by an AI agent and recorded permanently on Mantle.**

- **Hackathon:** Mantle Turing Test Hackathon 2026, Phase 2 (AI Awakening)
- **Primary track:** AI x RWA (Path A, Human-Driven RWA Infrastructure)
- **Secondary track:** AI Alpha & Data (Path A, Data & Analytics)
- **Prize stack targeted:** AI x RWA First Prize, AI Alpha & Data First Prize, Grand Champion, Best UI/UX, 20 Project Deployment Award
- **Deadline:** June 15, 2026. Current runway: ~9 days, shared with the Sui Overflow build (deadline June 16). Treat attention as split; see Phase Plan for what is non-negotiable.
- **Frontend spec:** lives in the separate `prompt.md`. This file owns architecture, agent logic, contracts, phasing, and submission. The UI/UX prize is won in `prompt.md`.

---

## 1. One-paragraph positioning

A touchstone is the dark stone assayers struck gold against to judge its purity. This one does the same for on-chain assets. Every other RWA agent in this hackathon will compete on returns: yield optimizers, rebalancers, vault managers. Touchstone does not trade. It rates. It issues structured credit ratings (AAA through D) for the RWA tokens and protocols available on Mantle, publishes each rating on-chain with a reasoning hash under its ERC-8004 identity, and accrues reputation from accuracy over time. It is upstream of every yield agent in the room, which means competitors are potential consumers, not just rivals. For a panel that includes Nansen, Hashed, and Caladan, all of whom do credit work for a living, the pitch lands in one sentence: the Moody's of the agentic economy, with an on-chain track record no rating agency has ever had.

---

## 2. What we are building (scope)

A working system with four parts:

1. **Rating engine (off-chain agent).** Ingests on-chain and off-chain data about an RWA subject, scores it across defined risk dimensions, and uses an LLM reasoning step to synthesize a letter grade plus a written rationale and a confidence value.
2. **On-chain registry (Mantle contracts).** Stores each published rating (subject, grade, reasoning hash, confidence, timestamp, agent identity) and exposes a read interface other contracts and agents can query.
3. **ERC-8004 identity and reputation.** The agent holds an Identity Registry NFT; rating accuracy is recorded against its Reputation Registry record over time.
4. **Frontend.** A ratings terminal that makes the agent's reasoning legible and contends for Best UI/UX. Full spec in `prompt.md`.

**Subjects to rate at demo time (pick 5, verify each is live on Mantle before building):** USDY (Ondo tokenized US Treasury), mETH (Mantle staked ETH), fBTC, MI4, Ethena USDe, plus the lending markets that accept them as collateral (e.g. on Mantle-native money markets). Confirm current Mantle availability and contract addresses in Phase 0.

---

## 3. Architecture

```
                    +-----------------------------+
                    |        Frontend (Next.js)    |
                    |   ratings terminal + reason  |  <-- prompt.md owns this
                    |   drill-down + track record  |
                    +--------------+--------------+
                                   | reads
                                   v
   +-------------------+    publishRating    +--------------------------+
   |  Rating engine    | ------------------> |   RatingRegistry.sol     |
   |  (off-chain agent)|                     |   (Mantle Network)       |
   |                   | <------------------ |   requestRating event    |
   |  - data ingest    |    requestRating    +-----------+--------------+
   |  - risk scoring   |                                 | references
   |  - LLM reasoning  |                                 v
   |  - confidence     |                     +--------------------------+
   +---------+---------+                     |  ERC-8004 Identity NFT   |
             |                               |  ERC-8004 Reputation rec |
             | reads                         +--------------------------+
             v
   +-------------------+
   |   Data sources    |
   |  - Mantle RPC     |  on-chain: TVL, oracle config, collateral mix,
   |  - verified ABI   |             holder concentration, contract code
   |  - off-chain meta |  off-chain: custodian, audit status, governance
   +-------------------+
```

### 3.1 Smart contracts (Solidity, deploy to Mantle)

- **`RatingRegistry.sol`** — core contract.
  - `publishRating(address subject, uint8 grade, bytes32 reasoningHash, uint8 confidence)` — callable only by the registered agent identity. Emits `RatingPublished`.
  - `requestRating(address subject)` — anyone can call; emits `RatingRequested`, which the off-chain agent listens for. This is the on-chain AI trigger that satisfies the 20 Project Deployment Award requirement ("agent trigger / inference result written on-chain").
  - `latestRating(address subject) view returns (Rating)` — the read interface other agents consume.
  - `ratingHistory(address subject) view` — full timeline, used by the track-record view.
  - Grade encoding: `uint8` 0–9 mapping to AAA, AA, A, BBB, BB, B, CCC, CC, C, D. Keep the mapping in a shared constants file used by contract, agent, and frontend.
- **ERC-8004 integration** — do not reimplement the standard. Use the canonical Identity Registry (ERC-721) to mint the agent's identity NFT, and write accuracy feedback to the Reputation Registry. Confirm whether canonical ERC-8004 registry contracts are deployed on Mantle in Phase 0; if not, deploy the reference registries to Mantle and document this in the README.
- **`reasoningHash`** is `keccak256` of the full reasoning JSON, which is pinned to IPFS. On-chain stores the hash; the frontend fetches the full reasoning from IPFS and verifies it against the hash. This keeps gas low while keeping reasoning verifiable, the exact pattern ERC-8004 itself recommends (compact signal on-chain, full record off-chain).

### 3.2 Rating engine (off-chain agent)

Pipeline, in order:

1. **Ingest.** For a subject, pull: TVL and 30/90-day TVL volatility, oracle configuration and update cadence, collateral composition and holder concentration, verified contract source from Mantle Explorer, and off-chain metadata (custodian, audit reports, governance structure).
2. **Score dimensions (deterministic where possible).** Five dimensions, each 0–100:
   - **Collateral quality** — what backs it, how liquid, how concentrated.
   - **Contract risk** — verified source, upgradeability, access control, known audit findings.
   - **Oracle integrity** — source, redundancy, manipulation resistance, staleness.
   - **Liquidity and stability** — TVL depth, volatility, depeg history.
   - **Governance and custodian** — who controls it, custodian reputation, centralization.
3. **Reason (LLM step).** Feed the dimension scores plus the raw evidence into the model with a strict rubric prompt. Output: a letter grade, a confidence value, and a written rationale that cites the specific evidence behind the grade. The reasoning must reference real data points, not generic statements; this is what wins the AI Alpha & Data Insight Value criterion and survives institutional scrutiny.
4. **Publish.** Pin reasoning JSON to IPFS, call `publishRating` with the grade, hash, and confidence.
5. **Track accuracy.** When a rated subject later experiences a documented adverse event (depeg, exploit, large loss), record whether the agent's prior rating anticipated it. This feeds the Reputation Registry and the track-record view.

Keep the deterministic scoring separate from the LLM step so judges can see the agent is not hallucinating grades; the model synthesizes and explains, the metrics anchor.

### 3.3 Tech stack

- Contracts: Solidity, Foundry, deployed and verified on Mantle.
- Agent: TypeScript service (Node) with an event listener on `RatingRequested`, the scoring modules, and the LLM reasoning call. Claude as the reasoning model.
- Frontend: Next.js (see `prompt.md`).
- Storage: IPFS (web3.storage or Pinata) for reasoning JSON.

---

## 4. How this scores against the rubric (30/25/25/20)

- **Technical Depth (30%).** Real contract analysis, multi-source on-chain ingestion, deterministic scoring fused with LLM reasoning, on-chain publication with verifiable hashes, ERC-8004 reputation loop. This is a genuine system, not a wrapper.
- **Innovation (25%).** Structured AI credit ratings published on-chain are not being done. The entire field is yield-first. Ratings-first is the novel paradigm.
- **Mantle Ecosystem (25%).** Rates Mantle-native RWA assets, consumes Mantle on-chain data as the core source, and produces an oracle other Mantle agents can build on. Substantive, not name-dropped.
- **Product Completeness (20%).** Runnable demo, verified contracts, a polished terminal. The historical-downgrade proof (Section 6) is what converts "interesting" into "complete."

---

## 5. Submission answers (draft now, refine before filming)

**AI x RWA — "What type of real-world asset are you bringing on-chain? How does AI play a role? How is it realized on Mantle?"**
> Touchstone does not tokenize a new asset; it makes existing tokenized real-world assets on Mantle (USDY, mETH and the markets built on them) safer to use by issuing AI-generated credit ratings. The AI ingests on-chain and off-chain risk data, scores five risk dimensions, and reasons to a letter grade with a cited rationale. Every rating is published on-chain under an ERC-8004 identity, so the agent builds a permanent, verifiable accuracy record on Mantle that any other protocol can consume as an oracle.

**AI Alpha & Data — "Which data sources does your project use? What role does AI play? How does it generate verifiable value on Mantle?"**
> Core data source is Mantle on-chain state: TVL and its volatility, oracle configuration, collateral composition, holder concentration, and verified contract source, supplemented by off-chain custodian and audit metadata. The AI fuses deterministic risk scores with a reasoning step that produces a grade and a cited rationale. Value is verifiable because every rating, its reasoning hash, and its subsequent accuracy are recorded on Mantle; the agent's track record cannot be retroactively edited.

---

## 6. Demo centerpiece: the historical-downgrade proof

The single most persuasive thing in the demo is showing the agent would have warned you before a real failure. Build this:

1. Select a documented 2025 RWA or stablecoin failure with on-chain history available on an EVM chain. **Verify the specifics before relying on any of these** — candidate events to research: a tokenized-yield or synthetic-dollar depeg, a lending-market bad-debt event, or an RWA protocol custodian failure from 2025. Do not assert details you have not confirmed.
2. Reconstruct the subject's on-chain state as of a date *before* the failure.
3. Run the agent against that historical state and show it produces a low or deteriorating grade with reasoning that names the specific weakness that later broke.
4. Show the timeline: agent downgrade, then the real-world failure after it.

This is the proof that the ratings mean something. Without it, judges suspect the grades are decorative. With it, the institutional seats lean forward.

---

## 7. Phase plan (9 days, split attention with Sui Overflow)

Front-load the deployment bar so the **20 Project Deployment Award** (first-come, first-served, only 20 spots) is locked while the field is still ramping.

- **Phase 0 — Lock (Day 1, non-negotiable).** Verify which subjects and ERC-8004 registries are live on Mantle and capture addresses. Resolve the five rating dimensions and the grade encoding. Deploy skeleton `RatingRegistry.sol` to Mantle testnet, verify on Mantle Explorer, wire a trivial `requestRating` to a stub `publishRating`. **At end of Day 1 you already meet the deployment-award technical bar.**
- **Phase 1 — Rating engine core (Days 2–3, non-negotiable).** Data ingestion from Mantle RPC and Explorer, the five deterministic scoring modules, and the LLM reasoning step producing grade + rationale + confidence. Hardcode the five subjects.
- **Phase 2 — ERC-8004 + on-chain publish (Day 4, non-negotiable).** Mint the agent identity NFT, wire `publishRating` for real, pin reasoning to IPFS, store the hash, implement `latestRating` and `ratingHistory` reads.
- **Phase 3 — Frontend (Days 5–6, non-negotiable for Best UI/UX).** Build per `prompt.md`. The ratings terminal, the reasoning drill-down, and the track-record view are the three screens that must exist.
- **Phase 4 — Historical-downgrade proof (Day 7, high value).** Section 6. This is the demo's spine.
- **Phase 5 — Reputation accuracy loop (Day 8, cuttable).** Write accuracy feedback to the Reputation Registry. If time is short, this can be shown as a designed view backed by the historical proof rather than a live loop.
- **Phase 6 — Ship (Day 9, non-negotiable).** Record the 2-minute-plus demo video, write the README (setup, architecture, deployed addresses), push the open-source repo, complete the DoraHacks submission with the deployment address, and submit to both tracks.

If Sui Overflow consumes more than expected: Phases 0–3 and 6 are the irreducible core. Phase 4 is the highest-value addition. Phase 5 is the first thing to cut.

---

## 8. Pre-planned scope cut lines (in order)

Cut in this sequence under time pressure:

1. Drop the live Reputation Registry accuracy loop; present accuracy via the historical proof instead.
2. Drop multi-source off-chain metadata; rate on on-chain data plus audit status only.
3. Drop the governance-and-custodian dimension; run four dimensions.
4. Drop two subjects; rate three instead of five.
5. Drop the `requestRating` public trigger to a manual admin trigger (keep it on-chain to preserve the deployment-award bar).

**Ship-core minimum:** three subjects rated, deterministic scoring plus LLM reasoning, ratings published on-chain under an ERC-8004 identity with verifiable hashes, one historical-downgrade proof, and the three frontend screens. That alone is a complete, defensible submission.

---

## 9. Submission checklist

DoraHacks main submission:
- [ ] Open-source GitHub repo with README (setup, architecture overview, deployed contract address)
- [ ] Runnable demo (publicly accessible frontend, not localhost)
- [ ] Project pitch
- [ ] Nominated to AI x RWA and AI Alpha & Data

20 Project Deployment Award (clear all, first-come):
- [ ] Contract deployed on Mantle Mainnet or Testnet
- [ ] Contract verified on Mantle Explorer
- [ ] At least one AI-powered function callable on-chain (the `requestRating` to `publishRating` flow)
- [ ] Frontend demo publicly accessible
- [ ] Deployment address in the DoraHacks submission
- [ ] Demo video ≥ 2 minutes walking the core use case

Best UI/UX:
- [ ] Runnable frontend interface (per `prompt.md`)
- [ ] Demo video or public link

---

## 10. Risks and mitigations

- **Judges suspect cherry-picked accuracy.** Mitigation: the historical-downgrade proof on a real, checkable 2025 failure, with the pre-failure on-chain state reconstructed transparently.
- **AI x RWA is the most crowded track (22%+ of submissions in the prior Mantle hackathon).** Mitigation: ratings-first positioning differentiates from the yield-first crowd; lean on "upstream infrastructure other agents consume."
- **ERC-8004 registries may not be deployed on Mantle.** Mitigation: confirm in Phase 0; if absent, deploy the reference registries and document it as an ecosystem contribution.
- **Reasoning reads as generic.** Mitigation: enforce evidence-citation in the reasoning prompt; every rationale must name specific data points.
- **Time loss to Sui Overflow.** Mitigation: the front-loaded deployment bar means even a worst-case finish still clears the 20 Project Deployment Award and a minimum viable submission.

---

## 11. Open items to resolve in Phase 0

1. Confirm live Mantle availability and addresses for USDY, mETH, fBTC, MI4, Ethena USDe and the relevant lending markets.
2. Confirm whether canonical ERC-8004 Identity and Reputation registries are deployed on Mantle; if not, plan to deploy references.
3. Select and verify the specific 2025 failure for the historical-downgrade proof.
4. Confirm the per-track prize allocation if Mantle has published it, to validate that AI x RWA plus Alpha is still the best stack versus pivoting the primary.
